// Rend chaque page, extrait les <script> du HTML produit, valide la syntaxe.
import { describe, it, expect } from "vitest";
import { pageEntree, pageAdmin, pageApp, pageReglages, pageDepenses, pageCategories, pageClasser } from "../src/pages";
import { calculerEnveloppe, projeter } from "../src/lib";

const cats = [
  { id: "cat_1", nom: "Nourriture", description: "courses", budget: 600, couleur: "#3b7a3b", systeme: 0, depense: 412.5 },
  { id: "cat_2", nom: "Alcool", description: "vin", budget: null, couleur: "#7b3fa0", systeme: 1, depense: 64 },
];
const deps = [{ id: "dep_1", date: "2026-08-17", marchand: "Coop", total: 87, source: "scan", exceptionnel: 0 }];
const lignes = [
  { id: "lig_1", depense_id: "dep_1", libelle: "Pain", montant: 5.6, categorie_id: "cat_1", confiance: 0.95 },
  { id: "lig_2", depense_id: "dep_1", libelle: "Vin rouge", montant: 18, categorie_id: "cat_2", confiance: 0.4 },
];
const etat = {
  enveloppe: calculerEnveloppe(5000, 2500, 1000),
  fixes: [{ id: "fix_1", libelle: "Loyer", montant: 2500 }],
  categories: cats,
  projection: projeter(476.5, 1500, new Date(2026, 7, 10)),
  aVerifier: 1,
  horsRythme: 0,
  totalDepense: 476.5,
};
const s = { nom: "Pitch", salaire: 5000, epargne: 1000, acces: { niveau: "ouvert", joursRestants: null } as const };

const pages: Record<string, string> = {
  entree: pageEntree("Code inconnu."),
  admin: pageAdmin([{ id: "cpt_1", nom: "Sandrine", statut: "actif", expire_le: "2027-08-18", code: "483927" }],
                   "https://enveloppe.pitch67.workers.dev"),
  app: pageApp(s, etat),
  reglages: pageReglages(s, etat.fixes),
  depenses: pageDepenses(deps, lignes, cats),
  categories: pageCategories(cats),
  classer: pageClasser(
    [{ id: "lig_2", depense_id: "dep_1", libelle: "DYSON PISTON ANIMA", montant: 599, marchand: "Fnac", date: "2026-08-19" }],
    cats,
  ),
  classerVide: pageClasser([], cats),
};

describe("pages rendues", () => {
  for (const [nom, html] of Object.entries(pages)) {
    it(`${nom} : le JavaScript embarqué est syntaxiquement valide`, () => {
      const blocs = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
      for (const b of blocs) {
        expect(() => new Function(b), `script de ${nom}`).not.toThrow();
      }
    });

    it(`${nom} : aucune interpolation non résolue`, () => {
      expect(html).not.toContain("${");
      expect(html).not.toContain("undefined");
      expect(html).not.toContain("[object Object]");
    });
  }
});

describe("contenu des pages", () => {
  it("l'app propose la photo et le fichier", () => {
    expect(pages.app).toContain('capture="environment"');
    expect(pages.app).toContain("Prendre une photo");
  });

  it("les noms de catégories ne sont pas renommables", () => {
    expect(pages.categories).not.toContain('value="Nourriture"');
    expect(pages.categories).toContain("Nourriture");
  });

  it("les catégories système ne se suppriment pas", () => {
    const bloc = pages.categories.split("Alcool")[1] ?? "";
    expect(bloc).not.toContain("Supprimer</button>");
    expect(bloc).toContain("verrouillée");
  });

  it("le budget reste modifiable sur toutes les catégories", () => {
    expect((pages.categories.match(/placeholder="budget"/g) ?? []).length).toBe(cats.length);
  });

  it("l'alerte de rythme apparaît quand la projection dépasse", () => {
    const serre = { ...etat, projection: projeter(1400, 1500, new Date(2026, 7, 10)) };
    expect(pageApp(s, serre)).toContain("À ce rythme");
  });

  it("aucune alerte quand le rythme tient", () => {
    const calme = { ...etat, projection: projeter(100, 1500, new Date(2026, 7, 10)) };
    expect(pageApp(s, calme)).not.toContain("À ce rythme");
  });

  it("chaque ligne de dépense offre toutes les catégories", () => {
    expect(pages.depenses).toContain("Scinder");
    expect((pages.depenses.match(/<select/g) ?? []).length).toBe(lignes.length);
  });

  it("l'écran de classement propose toutes les catégories", () => {
    for (const c of cats) expect(pages.classer).toContain(c.nom);
    expect(pages.classer).toContain("599");
  });

  it("l'écran de classement vide ne montre pas de boutons", () => {
    expect(pages.classerVide).toContain("Tout est classé");
    expect(pages.classerVide).not.toContain("choisir(");
  });

  it("le badge d'accueil renvoie vers le classement", () => {
    expect(pages.app).toContain('href="/classer"');
  });

  it("l'image est réduite avant envoi", () => {
    expect(pages.app).toContain("createImageBitmap");
  });

  it("la case exceptionnel est proposée sur chaque ticket", () => {
    expect(pages.depenses).toContain("Achat exceptionnel");
    expect(pages.depenses).toContain("exceptionnel('dep_1'");
  });

  it("l'accueil explique le rythme quand un achat est exclu", () => {
    const avec = { ...etat, horsRythme: 599, totalDepense: 1075.5,
                   projection: projeter(476.5, 901, new Date(2026, 7, 10)) };
    expect(pageApp(s, avec)).toContain("achats exceptionnels");
    expect(pageApp(s, etat)).not.toContain("achats exceptionnels");
  });

  it("un ticket s'annule depuis les deux écrans", () => {
    expect(pages.depenses).toContain("Annuler ce ticket");
    expect(pages.classer).toContain("Annuler tout ce ticket");
  });

  it("le bandeau d'échéance s'affiche en lecture seule", () => {
    const expire = { ...s, acces: { niveau: "lecture", joursDepasses: 8 } as const };
    expect(pageApp(expire, etat)).toContain("échéance");
  });
});
