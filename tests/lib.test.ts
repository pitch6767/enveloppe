import { describe, it, expect } from "vitest";
import { normaliserLibelle, calculerEnveloppe, projeter, niveau, genererCode } from "../src/lib";
import { parserReponse, construirePrompt } from "../src/vision";
import { CATEGORIES_DEFAUT } from "../src/categories";

describe("normaliserLibelle", () => {
  it("efface chiffres, accents et ponctuation", () => {
    expect(normaliserLibelle("SULFATE  CUIVRE 5KG  x2")).toBe("sulfate cuivre kg x");
    expect(normaliserLibelle("Café Crème 2.50")).toBe("cafe creme");
  });
  it("est stable sur variantes de casse et d'espaces", () => {
    expect(normaliserLibelle("  MIGROS   BIO  ")).toBe(normaliserLibelle("migros bio"));
  });
});

describe("calculerEnveloppe", () => {
  it("calcule le disponible et les pourcentages reels", () => {
    const e = calculerEnveloppe(5000, 2500, 1000);
    expect(e.disponible).toBe(1500);
    expect(e.pctEpargne).toBe(20);
    expect(e.pctFixes).toBe(50);
  });
  it("ne divise pas par zero sans salaire", () => {
    const e = calculerEnveloppe(0, 0, 0);
    expect(e.pctEpargne).toBe(0);
  });
  it("accepte un disponible negatif", () => {
    expect(calculerEnveloppe(3000, 2500, 1000).disponible).toBe(-500);
  });
});

describe("projeter", () => {
  it("projette le rythme sur le mois complet", () => {
    const p = projeter(500, 1500, new Date(2026, 7, 10)); // 10 aout, 31 jours
    expect(p.joursDuMois).toBe(31);
    expect(p.projete).toBeCloseTo(1550, 5);
    expect(p.ecart).toBeCloseTo(-50, 5);
  });
  it("annonce le jour de rupture", () => {
    const p = projeter(1000, 1500, new Date(2026, 7, 10)); // 100/jour
    expect(p.jourDeRupture).toBe(15);
  });
  it("ne signale aucune rupture si le rythme tient", () => {
    expect(projeter(100, 1500, new Date(2026, 7, 10)).jourDeRupture).toBeNull();
  });
  it("gere fevrier bissextile", () => {
    expect(projeter(100, 1000, new Date(2028, 1, 5)).joursDuMois).toBe(29);
  });
});

describe("niveau", () => {
  it("classe selon le budget", () => {
    expect(niveau(50, 100)).toBe("ok");
    expect(niveau(70, 100)).toBe("attention");
    expect(niveau(101, 100)).toBe("exces");
    expect(niveau(50, null)).toBe("neutre");
    expect(niveau(50, 0)).toBe("neutre");
  });
});

describe("genererCode", () => {
  it("produit 6 chiffres non triviaux", () => {
    for (let i = 0; i < 300; i++) {
      const c = genererCode();
      expect(c).toMatch(/^\d{6}$/);
      expect(c).not.toMatch(/^(\d)\1{5}$/);
      expect(c).not.toBe("123456");
    }
  });
});

describe("construirePrompt", () => {
  it("injecte les categories du compte", () => {
    const p = construirePrompt([{ id: "1", nom: "Vigne", description: "sulfate, piquets, secateurs" }]);
    expect(p).toContain("Vigne — sulfate, piquets, secateurs");
  });
  it("porte la regle alcool/tabac", () => {
    expect(construirePrompt([])).toContain("JAMAIS dans Nourriture");
  });
});

describe("parserReponse", () => {
  it("parse du JSON nu", () => {
    const t = parserReponse('{"marchand":"Coop","date":"2026-08-17","total":87.00,"lignes":[{"libelle":"Vin rouge","montant":18,"categorie":"Alcool","confiance":0.95}]}');
    expect(t.marchand).toBe("Coop");
    expect(t.lignes[0].categorie).toBe("Alcool");
  });
  it("survit aux backticks Markdown", () => {
    const t = parserReponse('```json\n{"marchand":"Galaxus","total":129.8,"lignes":[]}\n```');
    expect(t.total).toBe(129.8);
  });
  it("survit a du texte autour", () => {
    const t = parserReponse('Voici le resultat :\n{"marchand":"Migros","total":42,"lignes":[]}\nVoila.');
    expect(t.marchand).toBe("Migros");
  });
  it("comble les champs manquants", () => {
    const t = parserReponse('{"total":10}');
    expect(t.lignes).toEqual([]);
    expect(t.date).toBeNull();
  });
  it("rejette une reponse illisible", () => {
    expect(() => parserReponse("desole je ne peux pas lire")).toThrow();
  });
});

describe("CATEGORIES_DEFAUT", () => {
  it("marque Alcool et Tabac en systeme", () => {
    const sys = CATEGORIES_DEFAUT.filter((c) => c.systeme === 1).map((c) => c.nom);
    expect(sys).toEqual(["Alcool", "Tabac"]);
  });
  it("donne une description a chacune", () => {
    for (const c of CATEGORIES_DEFAUT) expect(c.description.length).toBeGreaterThan(10);
  });
  it("n'a pas de doublon de nom", () => {
    const noms = CATEGORIES_DEFAUT.map((c) => c.nom);
    expect(new Set(noms).size).toBe(noms.length);
  });
});

describe("parserElucidation", () => {
  it("lit un resultat de recherche", async () => {
    const { parserElucidation } = await import("../src/vision");
    const r = parserElucidation('{"resultats":[{"libelle":"DYSON PISTON ANIMA","quoi":"aspirateur sans fil","categorie":"Ménage / Hygiène","confiance":0.92}]}');
    expect(r[0].quoi).toBe("aspirateur sans fil");
    expect(r[0].categorie).toBe("Ménage / Hygiène");
  });
  it("survit aux backticks", async () => {
    const { parserElucidation } = await import("../src/vision");
    const r = parserElucidation('```json\n{"resultats":[{"libelle":"X","categorie":"Divers","confiance":0.2}]}\n```');
    expect(r).toHaveLength(1);
  });
  it("rend une liste vide plutot que d'echouer", async () => {
    const { parserElucidation } = await import("../src/vision");
    expect(parserElucidation("je n'ai rien trouve")).toEqual([]);
    expect(parserElucidation('{"resultats": pas du json}')).toEqual([]);
  });
});

describe("construirePromptRecherche", () => {
  it("numerote les articles et liste les categories", async () => {
    const { construirePromptRecherche } = await import("../src/vision");
    const p = construirePromptRecherche(["BABYLISS MT996E"], [{ id: "1", nom: "Ménage / Hygiène", description: "rasoir, tondeuse" }]);
    expect(p).toContain("1. BABYLISS MT996E");
    expect(p).toContain("Ménage / Hygiène — rasoir, tondeuse");
  });
});

describe("dateValide", () => {
  it("accepte une vraie date", async () => {
    const { dateValide } = await import("../src/vision");
    expect(dateValide("2026-03-14")).toBe("2026-03-14");
  });
  it("rejette le gabarit recopie", async () => {
    const { dateValide } = await import("../src/vision");
    expect(dateValide("AAAA-MM-JJ")).toBeNull();
    expect(dateValide("YYYY-MM-DD")).toBeNull();
  });
  it("rejette une date impossible", async () => {
    const { dateValide } = await import("../src/vision");
    expect(dateValide("2026-02-31")).toBeNull();
    expect(dateValide("2026-13-01")).toBeNull();
  });
  it("rejette les autres formats et le vide", async () => {
    const { dateValide } = await import("../src/vision");
    expect(dateValide("14.03.2026")).toBeNull();
    expect(dateValide("")).toBeNull();
    expect(dateValide(null)).toBeNull();
    expect(dateValide(20260314)).toBeNull();
  });
  it("un ticket sans date lisible tombe a null", async () => {
    const { parserReponse } = await import("../src/vision");
    expect(parserReponse('{"marchand":"Fnac","date":"AAAA-MM-JJ","total":10,"lignes":[]}').date).toBeNull();
  });
});

describe("parJour", () => {
  it("divise le disponible par le nombre de jours du mois", async () => {
    const { parJour } = await import("../src/lib");
    // août : 31 jours
    const j = parJour(3382, 0, new Date(2026, 7, 20));
    expect(j.montant).toBeCloseTo(3382 / 31, 5);
  });
  it("s'adapte a la longueur du mois", async () => {
    const { parJour } = await import("../src/lib");
    expect(parJour(3000, 0, new Date(2026, 8, 10)).montant).toBeCloseTo(100, 5); // septembre, 30
    expect(parJour(2800, 0, new Date(2026, 1, 10)).montant).toBeCloseTo(100, 5); // fevrier, 28
    expect(parJour(2900, 0, new Date(2028, 1, 10)).montant).toBeCloseTo(100, 5); // fevrier bissextile
  });
  it("est vert quand le rythme reste sous l'allocation", async () => {
    const { parJour } = await import("../src/lib");
    // 31 jours, 3100 dispo = 100/j ; au 10, 500 depenses = 50/j
    expect(parJour(3100, 500, new Date(2026, 7, 10)).niveau).toBe("ok");
  });
  it("est orange quand on frole l'allocation", async () => {
    const { parJour } = await import("../src/lib");
    // au 10, 950 depenses = 95/j pour 100/j
    expect(parJour(3100, 950, new Date(2026, 7, 10)).niveau).toBe("attention");
  });
  it("est rouge des qu'on depasse", async () => {
    const { parJour } = await import("../src/lib");
    expect(parJour(3100, 1200, new Date(2026, 7, 10)).niveau).toBe("exces");
  });
  it("est rouge si le disponible est nul ou negatif", async () => {
    const { parJour } = await import("../src/lib");
    expect(parJour(0, 0, new Date(2026, 7, 10)).niveau).toBe("exces");
    expect(parJour(-200, 0, new Date(2026, 7, 10)).niveau).toBe("exces");
  });
  it("le premier jour sans depense reste vert", async () => {
    const { parJour } = await import("../src/lib");
    expect(parJour(3100, 0, new Date(2026, 7, 1)).niveau).toBe("ok");
  });
});
