// Catégories de départ, copiées dans chaque nouvel espace.
// `description` alimente le prompt Vision : sans elle, le modèle ne sait pas classer.

export interface CategorieDefaut {
  nom: string;
  description: string;
  couleur: string;
  systeme: 0 | 1;
}

export const CATEGORIES_DEFAUT: CategorieDefaut[] = [
  { nom: "Nourriture",        description: "courses alimentaires, épicerie, boulangerie, marché", couleur: "#3b7a3b", systeme: 0 },
  { nom: "Restaurant",        description: "restaurant, take-away, livraison, café, cantine",     couleur: "#5a8f4a", systeme: 0 },
  { nom: "Alcool",            description: "vin, bière, spiritueux, apéritifs — JAMAIS dans Nourriture", couleur: "#7b3fa0", systeme: 1 },
  { nom: "Tabac",             description: "cigarettes, tabac, puff, accessoires — JAMAIS dans Nourriture", couleur: "#9b4fc0", systeme: 1 },
  { nom: "Ménage / Hygiène",  description: "lessive, produits d'entretien, papier, savon, dentifrice", couleur: "#4a7f8f", systeme: 0 },
  { nom: "Transport",         description: "essence, CFF, parking, vignette, entretien véhicule",  couleur: "#3f6fa0", systeme: 0 },
  { nom: "Santé",             description: "pharmacie, médecin, dentiste, opticien, franchise",    couleur: "#c05f5f", systeme: 0 },
  { nom: "Vêtements",         description: "habits, chaussures, retouches",                        couleur: "#a0623f", systeme: 0 },
  { nom: "Loisirs",           description: "sport, cinéma, livres, sorties, matériel de loisir",   couleur: "#c0913f", systeme: 0 },
  { nom: "Abonnements",       description: "téléphone, internet, streaming, applications",         couleur: "#6f6f8f", systeme: 0 },
  { nom: "Beauté / Coiffeur", description: "coiffeur, esthétique, parfumerie, soins",              couleur: "#b06f8f", systeme: 0 },
  { nom: "Cadeaux",           description: "cadeaux, fleurs, dons",                                couleur: "#8f5fa0", systeme: 0 },
  { nom: "Divers",            description: "tout ce qui n'entre nulle part ailleurs — catégorie de repli", couleur: "#7f7f7f", systeme: 0 },
];

export const CATEGORIE_REPLI = "Divers";
export const SEUIL_CONFIANCE = 0.6;
