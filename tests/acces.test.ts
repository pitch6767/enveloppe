import { describe, it, expect } from "vitest";
import { evaluerAcces, peutEcrire, prolongerUnAn, joursEntre } from "../src/acces";

const N = (s: string) => new Date(`${s}T12:00:00Z`);

describe("evaluerAcces", () => {
  it("laisse un compte exempt toujours ouvert", () => {
    const a = evaluerAcces({ statut: "exempt", expire_le: null }, N("2026-08-18"));
    expect(a).toEqual({ niveau: "ouvert", joursRestants: null });
  });
  it("ignore une echeance posee par erreur sur un exempt", () => {
    const a = evaluerAcces({ statut: "exempt", expire_le: "2020-01-01" }, N("2026-08-18"));
    expect(a.niveau).toBe("ouvert");
  });
  it("ouvre un compte payant loin de l'echeance", () => {
    const a = evaluerAcces({ statut: "actif", expire_le: "2027-08-18" }, N("2026-08-18"));
    expect(a).toEqual({ niveau: "ouvert", joursRestants: 365 });
  });
  it("previent 21 jours avant", () => {
    const a = evaluerAcces({ statut: "actif", expire_le: "2026-08-30" }, N("2026-08-18"));
    expect(a).toEqual({ niveau: "bientot", joursRestants: 12 });
  });
  it("bascule en lecture seule apres l'echeance", () => {
    const a = evaluerAcces({ statut: "actif", expire_le: "2026-08-10" }, N("2026-08-18"));
    expect(a).toEqual({ niveau: "lecture", joursDepasses: 8 });
  });
  it("reste ouvert le jour meme de l'echeance", () => {
    const a = evaluerAcces({ statut: "actif", expire_le: "2026-08-18" }, N("2026-08-18"));
    expect(a.niveau).toBe("bientot");
  });
  it("ferme un compte archive", () => {
    expect(evaluerAcces({ statut: "archive", expire_le: null }, N("2026-08-18")).niveau).toBe("ferme");
  });
});

describe("peutEcrire", () => {
  it("autorise avant l'echeance, refuse apres", () => {
    expect(peutEcrire({ niveau: "ouvert", joursRestants: null })).toBe(true);
    expect(peutEcrire({ niveau: "bientot", joursRestants: 3 })).toBe(true);
    expect(peutEcrire({ niveau: "lecture", joursDepasses: 1 })).toBe(false);
    expect(peutEcrire({ niveau: "ferme" })).toBe(false);
  });
});

describe("prolongerUnAn", () => {
  it("ajoute un an a une echeance future", () => {
    expect(prolongerUnAn("2027-03-10", N("2026-08-18"))).toBe("2028-03-10");
  });
  it("repart d'aujourd'hui si l'echeance est passee", () => {
    expect(prolongerUnAn("2026-01-01", N("2026-08-18"))).toBe("2027-08-18");
  });
  it("gere un compte sans echeance", () => {
    expect(prolongerUnAn(null, N("2026-08-18"))).toBe("2027-08-18");
  });
  it("gere le 29 fevrier", () => {
    expect(prolongerUnAn("2028-02-29", N("2027-01-01"))).toBe("2029-03-01");
  });
});

describe("joursEntre", () => {
  it("compte des jours pleins", () => {
    expect(joursEntre(N("2026-08-18"), N("2026-08-20"))).toBe(2);
    expect(joursEntre(N("2026-08-20"), N("2026-08-18"))).toBe(-2);
  });
  it("n'est pas fausse par l'heure d'ete", () => {
    expect(joursEntre(new Date("2026-03-28T23:00:00Z"), new Date("2026-03-30T01:00:00Z"))).toBe(2);
  });
});

describe("cookies d'administration", () => {
  const lire = (entete: string, nom: string): string[] => {
    const out: string[] = [];
    for (const part of entete.split(";")) {
      const [k, ...v] = part.trim().split("=");
      if (k === nom) out.push(decodeURIComponent(v.join("=")));
    }
    return out;
  };

  it("lit toutes les valeurs homonymes, pas seulement la premiere", () => {
    // Le navigateur envoie d'abord la variante au chemin le plus specifique.
    const entete = "env_admin=perime; env_code=330293; env_admin=330293";
    expect(lire(entete, "env_admin")).toEqual(["perime", "330293"]);
    expect(lire(entete, "env_admin").includes("330293")).toBe(true);
  });

  it("un entete sans le cookie ne rend rien", () => {
    expect(lire("autre=1", "env_admin")).toEqual([]);
    expect(lire("", "env_admin")).toEqual([]);
  });
});
