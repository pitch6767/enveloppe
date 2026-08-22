// Droits d'accès d'un espace, déduits du statut et de l'échéance.

export type Statut = "exempt" | "actif" | "archive";

export interface CompteAcces {
  statut: Statut;
  expire_le: string | null;
}

export type Acces =
  | { niveau: "ouvert"; joursRestants: number | null }
  | { niveau: "bientot"; joursRestants: number }
  | { niveau: "lecture"; joursDepasses: number }
  | { niveau: "ferme" };

const JOUR = 86_400_000;
const PREAVIS = 21;

/** Jours pleins entre deux dates, en UTC pour éviter les décalages d'heure d'été. */
export function joursEntre(de: Date, a: Date): number {
  const d = Date.UTC(de.getFullYear(), de.getMonth(), de.getDate());
  const b = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
  return Math.round((b - d) / JOUR);
}

/**
 * Un compte exempt est toujours ouvert.
 * Un compte payant devient lecture seule à l'échéance : rien n'est jamais effacé.
 */
export function evaluerAcces(c: CompteAcces, maintenant: Date): Acces {
  if (c.statut === "archive") return { niveau: "ferme" };
  if (c.statut === "exempt" || !c.expire_le) {
    return { niveau: "ouvert", joursRestants: null };
  }

  const echeance = new Date(`${c.expire_le}T00:00:00Z`);
  if (Number.isNaN(echeance.getTime())) return { niveau: "ouvert", joursRestants: null };

  const restants = joursEntre(maintenant, echeance);

  if (restants < 0) return { niveau: "lecture", joursDepasses: -restants };
  if (restants <= PREAVIS) return { niveau: "bientot", joursRestants: restants };
  return { niveau: "ouvert", joursRestants: restants };
}

/** Les scans et l'ajout de dépenses s'arrêtent à l'échéance, la consultation reste. */
export function peutEcrire(a: Acces): boolean {
  return a.niveau === "ouvert" || a.niveau === "bientot";
}

/**
 * Prolonge de N mois. Repart d'aujourd'hui si l'échéance est déjà passée,
 * pour ne jamais offrir une période déjà écoulée.
 */
export function prolonger(expire_le: string | null, mois: number, maintenant: Date): string {
  const base = expire_le ? new Date(`${expire_le}T00:00:00Z`) : null;
  const depart = base && !Number.isNaN(base.getTime()) && base > maintenant ? base : maintenant;
  const d = new Date(Date.UTC(depart.getUTCFullYear(), depart.getUTCMonth() + mois, depart.getUTCDate()));
  return d.toISOString().slice(0, 10);
}

/** Un an, cas courant. */
export function prolongerUnAn(expire_le: string | null, maintenant: Date): string {
  return prolonger(expire_le, 12, maintenant);
}
