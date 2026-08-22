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
