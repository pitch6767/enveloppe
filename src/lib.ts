// Utilitaires partagés.

/** Code à 6 chiffres, aléatoire cryptographique, jamais de séquence triviale. */
export function genererCode(): string {
  const buf = new Uint32Array(1);
  for (;;) {
    crypto.getRandomValues(buf);
    const n = buf[0] % 1_000_000;
    const code = String(n).padStart(6, "0");
    if (/^(\d)\1{5}$/.test(code)) continue; // 000000, 111111...
    if (code === "123456" || code === "654321") continue;
    return code;
  }
}

export function genererId(prefixe: string): string {
  return `${prefixe}_${crypto.randomUUID().replace(/-/g, "").slice(0, 20)}`;
}

/**
 * Normalise un libellé de ticket pour la table `regles`.
 * "SULFATE  CUIVRE 5KG  x2" -> "sulfate cuivre kg"
 */
export function normaliserLibelle(brut: string): string {
  return brut
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[0-9]+([.,][0-9]+)?/g, " ")
    .replace(/[^a-z ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export interface Enveloppe {
  salaire: number;
  fixes: number;
  epargne: number;
  disponible: number;
  pctEpargne: number;
  pctFixes: number;
}

export function calculerEnveloppe(salaire: number, fixes: number, epargne: number): Enveloppe {
  const disponible = salaire - fixes - epargne;
  return {
    salaire,
    fixes,
    epargne,
    disponible,
    pctEpargne: salaire > 0 ? (epargne / salaire) * 100 : 0,
    pctFixes: salaire > 0 ? (fixes / salaire) * 100 : 0,
  };
}

export interface Projection {
  depense: number;
  disponible: number;
  jourCourant: number;
  joursDuMois: number;
  projete: number;
  ecart: number;
  jourDeRupture: number | null;
}

/**
 * Projection linéaire du rythme de dépense sur le mois complet.
 * `jourDeRupture` = jour du mois où l'enveloppe tombe à zéro au rythme actuel.
 */
export function projeter(depense: number, disponible: number, aujourdhui: Date): Projection {
  const jourCourant = aujourdhui.getDate();
  const joursDuMois = new Date(
    aujourdhui.getFullYear(),
    aujourdhui.getMonth() + 1,
    0,
  ).getDate();

  const rythme = jourCourant > 0 ? depense / jourCourant : 0;
  const projete = rythme * joursDuMois;

  let jourDeRupture: number | null = null;
  if (rythme > 0) {
    const j = Math.ceil(disponible / rythme);
    if (j <= joursDuMois) jourDeRupture = j;
  }

  return {
    depense,
    disponible,
    jourCourant,
    joursDuMois,
    projete,
    ecart: disponible - projete,
    jourDeRupture,
  };
}

/** vert < 70% du budget, ambre 70-100%, rouge > 100%. */
export function niveau(depense: number, budget: number | null): "neutre" | "ok" | "attention" | "exces" {
  if (!budget || budget <= 0) return "neutre";
  const r = depense / budget;
  if (r > 1) return "exces";
  if (r >= 0.7) return "attention";
  return "ok";
}

export function chf(n: number): string {
  return new Intl.NumberFormat("fr-CH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    .format(n);
}

export interface Journalier {
  montant: number;
  depenseParJour: number;
  niveau: "ok" | "attention" | "exces";
}

/**
 * Ce qu'on peut dépenser par jour pour tenir le mois, et où l'on en est.
 * Le rythme réel est comparé à cette allocation : vert en dessous,
 * orange dans la dernière dizaine de pourcents, rouge au-dessus.
 */
export function parJour(disponible: number, depense: number, aujourdhui: Date): Journalier {
  const joursDuMois = new Date(
    aujourdhui.getFullYear(),
    aujourdhui.getMonth() + 1,
    0,
  ).getDate();
  const jourCourant = aujourdhui.getDate();

  const montant = disponible / joursDuMois;
  const depenseParJour = jourCourant > 0 ? depense / jourCourant : 0;

  let niveau: Journalier["niveau"];
  if (montant <= 0) {
    niveau = "exces";
  } else if (depenseParJour > montant) {
    niveau = "exces";
  } else if (depenseParJour >= montant * 0.9) {
    niveau = "attention";
  } else {
    niveau = "ok";
  }

  return { montant, depenseParJour, niveau };
}
