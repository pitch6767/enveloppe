// Rend chaque page, extrait les <script> du HTML produit, valide la syntaxe.
import { describe, it, expect } from "vitest";
import { pageEntree, pageAdmin, pageApp, pageReglages, pageDepenses, pageCategories } from "../src/pages";
import { calculerEnveloppe, projeter } from "../src/lib";

const cats = [
  { id: "cat_1", nom: "Nourriture", description: "courses", budget: 600, couleur: "#3b7a3b", systeme: 0, depense: 412.5 },
  { id: "cat_2", nom: "Alcool", description: "vin", budget: null, couleur: "#7b3fa0", systeme: 1, depense: 64 },
];
const deps = [{ id: "dep_1", date: "2026-08-17", marchand: "Coop", total: 87, source: "scan" }];
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

  it("les catégories système ne sont pas modifiables", () => {
    const bloc = pages.categories.split("Alcool")[1] ?? "";
    expect(pages.categories).toContain("disabled");
    expect(bloc).not.toContain("Supprimer</button>");
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

  it("le bandeau d'échéance s'affiche en lecture seule", () => {
    const expire = { ...s, acces: { niveau: "lecture", joursDepasses: 8 } as const };
    expect(pageApp(expire, etat)).toContain("échéance");
  });
});
