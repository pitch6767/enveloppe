import { CATEGORIES_DEFAUT, SEUIL_CONFIANCE } from "./categories";
import { genererCode, genererId, normaliserLibelle, calculerEnveloppe, projeter, chf } from "./lib";
import { evaluerAcces, peutEcrire, prolongerUnAn, type Acces } from "./acces";
import { analyserImage, elucider, type CategorieRow } from "./vision";
import { pageEntree, pageAdmin, pageApp, pageReglages, pageDepenses, pageCategories, pageClasser } from "./pages";

export interface Env {
  DB: D1Database;
  ANTHROPIC_API_KEY: string;
  ADMIN_CODE: string;
  ANTHROPIC_MODEL?: string;
}

const COOKIE = "env_code";

function html(corps: string, init: ResponseInit = {}): Response {
  return new Response(corps, {
    ...init,
    headers: { "content-type": "text/html; charset=utf-8", ...(init.headers ?? {}) },
  });
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

function lireCookie(req: Request, nom: string): string | null {
  const brut = req.headers.get("cookie") ?? "";
  for (const part of brut.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === nom) return decodeURIComponent(v.join("="));
  }
  return null;
}

function poserCookie(code: string): string {
  return `${COOKIE}=${encodeURIComponent(code)}; Path=/; Max-Age=31536000; HttpOnly; Secure; SameSite=Lax`;
}

interface Session {
  compte_id: string;
  nom: string;
  salaire: number;
  epargne: number;
  acces: Acces;
}

async function session(env: Env, code: string | null): Promise<Session | null> {
  if (!code || !/^\d{6}$/.test(code)) return null;

  const row = await env.DB.prepare(
    `SELECT c.id, c.nom, c.statut, c.salaire, c.epargne, c.expire_le
       FROM codes k JOIN comptes c ON c.id = k.compte_id
      WHERE k.code = ?1`,
  ).bind(code).first<any>();

  if (!row) return null;

  const acces = evaluerAcces({ statut: row.statut, expire_le: row.expire_le }, new Date());
  if (acces.niveau === "ferme") return null;

  return { compte_id: row.id, nom: row.nom, salaire: row.salaire, epargne: row.epargne, acces };
}

/** Crée un espace avec ses catégories et son premier code. */
async function creerEspace(env: Env, nom: string, gratuit: boolean): Promise<{ id: string; code: string }> {
  const id = genererId("cpt");
  const code = genererCode();
  const expire = gratuit ? null : prolongerUnAn(null, new Date());

  const stmts: D1PreparedStatement[] = [
    env.DB.prepare(
      `INSERT INTO comptes (id, nom, statut, expire_le) VALUES (?1, ?2, ?3, ?4)`,
    ).bind(id, nom, gratuit ? "exempt" : "actif", expire),
    env.DB.prepare(
      `INSERT INTO codes (id, compte_id, code, label) VALUES (?1, ?2, ?3, ?4)`,
    ).bind(genererId("cod"), id, code, "principal"),
  ];

  CATEGORIES_DEFAUT.forEach((c, i) => {
    stmts.push(env.DB.prepare(
      `INSERT INTO categories (id, compte_id, nom, description, couleur, systeme, ordre)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)`,
    ).bind(genererId("cat"), id, c.nom, c.description, c.couleur, c.systeme, i));
  });

  await env.DB.batch(stmts);
  return { id, code };
}

function moisCourant(): { debut: string; fin: string } {
  const n = new Date();
  const debut = new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), 1));
  const fin = new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth() + 1, 1));
  return { debut: debut.toISOString().slice(0, 10), fin: fin.toISOString().slice(0, 10) };
}

async function etatDuMois(env: Env, s: Session) {
  const { debut, fin } = moisCourant();

  const fixes = await env.DB.prepare(
    `SELECT id, libelle, montant FROM fixes WHERE compte_id = ?1 AND actif = 1 ORDER BY montant DESC`,
  ).bind(s.compte_id).all<any>();

  const totalFixes = (fixes.results ?? []).reduce((a, f) => a + f.montant, 0);
  const env_ = calculerEnveloppe(s.salaire, totalFixes, s.epargne);

  const cats = await env.DB.prepare(
    `SELECT c.id, c.nom, c.description, c.budget, c.couleur, c.systeme,
            COALESCE(SUM(CASE WHEN d.date >= ?2 AND d.date < ?3 THEN l.montant END), 0) AS depense
       FROM categories c
       LEFT JOIN lignes l ON l.categorie_id = c.id
       LEFT JOIN depenses d ON d.id = l.depense_id
      WHERE c.compte_id = ?1
      GROUP BY c.id
      ORDER BY c.ordre`,
  ).bind(s.compte_id, debut, fin).all<any>();

  const totalDepense = (cats.results ?? []).reduce((a, c) => a + c.depense, 0);

  const aVerifier = await env.DB.prepare(
    `SELECT COUNT(*) AS n FROM lignes WHERE compte_id = ?1 AND confiance < ?2`,
  ).bind(s.compte_id, SEUIL_CONFIANCE).first<any>();

  return {
    enveloppe: env_,
    fixes: fixes.results ?? [],
    categories: cats.results ?? [],
    projection: projeter(totalDepense, env_.disponible, new Date()),
    aVerifier: aVerifier?.n ?? 0,
  };
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    const p = url.pathname;

    // Lien direct /483927 : pose le cookie et redirige.
    const direct = p.match(/^\/(\d{6})$/);
    if (direct) {
      const s = await session(env, direct[1]);
      if (!s) return html(pageEntree("Ce code n'existe pas ou l'accès est clos."), { status: 404 });
      return new Response(null, { status: 302, headers: { location: "/", "set-cookie": poserCookie(direct[1]) } });
    }

    if (p === "/admin") return admin(req, env);
    if (p.startsWith("/api/admin/")) return apiAdmin(req, env, p);

    const code = lireCookie(req, COOKIE);
    const s = await session(env, code);

    if (p === "/entrer" && req.method === "POST") {
      const f = await req.formData();
      const saisi = String(f.get("code") ?? "").replace(/\D/g, "");
      const ok = await session(env, saisi);
      if (!ok) return html(pageEntree("Code inconnu."), { status: 401 });
      return new Response(null, { status: 302, headers: { location: "/", "set-cookie": poserCookie(saisi) } });
    }

    if (!s) return html(pageEntree());

    if (p === "/") return html(pageApp(s, await etatDuMois(env, s)));
    if (p === "/classer") {
      const l = await env.DB.prepare(
        `SELECT l.id, l.libelle, l.montant, d.marchand, d.date
           FROM lignes l JOIN depenses d ON d.id = l.depense_id
          WHERE l.compte_id = ?1 AND l.confiance < ?2
          ORDER BY d.date DESC, l.montant DESC`,
      ).bind(s.compte_id, SEUIL_CONFIANCE).all<any>();
      const c = await env.DB.prepare(
        `SELECT id, nom, couleur FROM categories WHERE compte_id = ?1 ORDER BY ordre`,
      ).bind(s.compte_id).all<any>();
      return html(pageClasser(l.results ?? [], c.results ?? []));
    }

    if (p === "/depenses") {
      const d = await env.DB.prepare(
        `SELECT id, date, marchand, total, source FROM depenses
          WHERE compte_id = ?1 ORDER BY date DESC, cree_le DESC LIMIT 40`,
      ).bind(s.compte_id).all<any>();
      const l = await env.DB.prepare(
        `SELECT id, depense_id, libelle, montant, categorie_id, confiance
           FROM lignes WHERE compte_id = ?1`,
      ).bind(s.compte_id).all<any>();
      const c = await env.DB.prepare(
        `SELECT id, nom, systeme FROM categories WHERE compte_id = ?1 ORDER BY ordre`,
      ).bind(s.compte_id).all<any>();
      return html(pageDepenses(d.results ?? [], l.results ?? [], c.results ?? []));
    }

    if (p === "/categories") {
      const { debut, fin } = moisCourant();
      const c = await env.DB.prepare(
        `SELECT c.id, c.nom, c.description, c.budget, c.couleur, c.systeme,
                COALESCE(SUM(CASE WHEN d.date >= ?2 AND d.date < ?3 THEN l.montant END), 0) AS depense
           FROM categories c
           LEFT JOIN lignes l ON l.categorie_id = c.id
           LEFT JOIN depenses d ON d.id = l.depense_id
          WHERE c.compte_id = ?1 GROUP BY c.id ORDER BY c.ordre`,
      ).bind(s.compte_id, debut, fin).all<any>();
      return html(pageCategories(c.results ?? []));
    }

    if (p === "/reglages") {
      const f = await env.DB.prepare(
        `SELECT id, libelle, montant FROM fixes WHERE compte_id = ?1 AND actif = 1 ORDER BY montant DESC`,
      ).bind(s.compte_id).all<any>();
      return html(pageReglages(s, f.results ?? []));
    }
    if (p.startsWith("/api/")) return api(req, env, s, p);

    return new Response("Introuvable", { status: 404 });
  },
};

async function admin(req: Request, env: Env): Promise<Response> {
  const code = lireCookie(req, "env_admin");
  if (code !== env.ADMIN_CODE) {
    if (req.method === "POST") {
      const f = await req.formData();
      if (String(f.get("code")) === env.ADMIN_CODE) {
        return new Response(null, {
          status: 302,
          headers: {
            location: "/admin",
            "set-cookie": `env_admin=${env.ADMIN_CODE}; Path=/admin; Max-Age=31536000; HttpOnly; Secure; SameSite=Lax`,
          },
        });
      }
    }
    return html(pageEntree(undefined, true));
  }

  const comptes = await env.DB.prepare(
    `SELECT c.id, c.nom, c.statut, c.expire_le, c.note,
            (SELECT code FROM codes WHERE compte_id = c.id ORDER BY cree_le LIMIT 1) AS code
       FROM comptes c ORDER BY c.cree_le DESC`,
  ).all<any>();

  const base = new URL(req.url).origin;
  return html(pageAdmin(comptes.results ?? [], base));
}

async function apiAdmin(req: Request, env: Env, p: string): Promise<Response> {
  if (lireCookie(req, "env_admin") !== env.ADMIN_CODE) return json({ erreur: "refuse" }, 403);
  if (req.method !== "POST") return json({ erreur: "methode" }, 405);

  const corps = await req.json<any>();

  if (p === "/api/admin/creer") {
    const nom = String(corps.nom ?? "").trim();
    if (!nom) return json({ erreur: "nom manquant" }, 400);
    const r = await creerEspace(env, nom, !!corps.gratuit);
    return json(r);
  }

  if (p === "/api/admin/prolonger") {
    const c = await env.DB.prepare(`SELECT expire_le FROM comptes WHERE id = ?1`)
      .bind(corps.id).first<any>();
    if (!c) return json({ erreur: "inconnu" }, 404);
    const nouvelle = prolongerUnAn(c.expire_le, new Date());
    await env.DB.prepare(`UPDATE comptes SET expire_le = ?2, statut = 'actif' WHERE id = ?1`)
      .bind(corps.id, nouvelle).run();
    return json({ expire_le: nouvelle });
  }

  return json({ erreur: "route" }, 404);
}

async function api(req: Request, env: Env, s: Session, p: string): Promise<Response> {
  const ecriture = peutEcrire(s.acces);

  if (p === "/api/reglages" && req.method === "POST") {
    if (!ecriture) return json({ erreur: "echeance" }, 402);
    const c = await req.json<any>();
    await env.DB.prepare(`UPDATE comptes SET salaire = ?2, epargne = ?3 WHERE id = ?1`)
      .bind(s.compte_id, Number(c.salaire) || 0, Number(c.epargne) || 0).run();
    return json({ ok: true });
  }

  if (p === "/api/fixe" && req.method === "POST") {
    if (!ecriture) return json({ erreur: "echeance" }, 402);
    const c = await req.json<any>();
    await env.DB.prepare(
      `INSERT INTO fixes (id, compte_id, libelle, montant) VALUES (?1, ?2, ?3, ?4)`,
    ).bind(genererId("fix"), s.compte_id, String(c.libelle), Number(c.montant) || 0).run();
    return json({ ok: true });
  }

  if (p.startsWith("/api/fixe/") && req.method === "DELETE") {
    await env.DB.prepare(`DELETE FROM fixes WHERE id = ?1 AND compte_id = ?2`)
      .bind(p.split("/")[3], s.compte_id).run();
    return json({ ok: true });
  }

  if (p === "/api/categorie" && req.method === "POST") {
    if (!ecriture) return json({ erreur: "echeance" }, 402);
    const c = await req.json<any>();
    await env.DB.prepare(
      `INSERT INTO categories (id, compte_id, nom, description, budget, couleur, ordre)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, 99)`,
    ).bind(genererId("cat"), s.compte_id, String(c.nom), String(c.description ?? ""),
           c.budget ? Number(c.budget) : null, String(c.couleur ?? "#7f7f7f")).run();
    return json({ ok: true });
  }

  if (p.startsWith("/api/categorie/") && req.method === "DELETE") {
    const id = p.split("/")[3];
    const cat = await env.DB.prepare(`SELECT systeme FROM categories WHERE id = ?1 AND compte_id = ?2`)
      .bind(id, s.compte_id).first<any>();
    if (!cat) return json({ erreur: "inconnue" }, 404);
    if (cat.systeme === 1) return json({ erreur: "categorie systeme" }, 403);

    const repli = await env.DB.prepare(
      `SELECT id FROM categories WHERE compte_id = ?1 AND nom = 'Divers'`,
    ).bind(s.compte_id).first<any>();

    await env.DB.batch([
      env.DB.prepare(`UPDATE lignes SET categorie_id = ?2 WHERE categorie_id = ?1`).bind(id, repli?.id ?? null),
      env.DB.prepare(`DELETE FROM regles WHERE categorie_id = ?1`).bind(id),
      env.DB.prepare(`DELETE FROM categories WHERE id = ?1 AND compte_id = ?2`).bind(id, s.compte_id),
    ]);
    return json({ ok: true });
  }

  if (p === "/api/scan" && req.method === "POST") {
    if (!ecriture) return json({ erreur: "ton accès est arrivé à échéance" }, 402);
    try {
      return await scanner(req, env, s);
    } catch (e: any) {
      // Sans message lisible, un échec de scan est indébogable depuis un téléphone.
      const m = String(e?.message ?? e);
      const clair = m.includes("credit") || m.includes("balance")
        ? "crédit Anthropic épuisé"
        : m.includes("401") || m.includes("authentication")
          ? "clé Anthropic invalide ou absente (secret ANTHROPIC_API_KEY)"
          : m.includes("too large") || m.includes("413")
            ? "image trop lourde"
            : m.slice(0, 200);
      return json({ erreur: clair }, 500);
    }
  }

  if (p.startsWith("/api/ligne/") && p.endsWith("/scinder") && req.method === "POST") {
    if (!ecriture) return json({ erreur: "echeance" }, 402);
    const id = p.split("/")[3];
    const c = await req.json<any>();
    const part = Number(c.montant) || 0;

    const ligne = await env.DB.prepare(
      `SELECT libelle, montant, depense_id FROM lignes WHERE id = ?1 AND compte_id = ?2`,
    ).bind(id, s.compte_id).first<any>();
    if (!ligne) return json({ erreur: "inconnue" }, 404);
    if (part <= 0 || part >= ligne.montant) {
      return json({ erreur: "le montant scindé doit être strictement compris entre 0 et le total de la ligne" }, 400);
    }

    await env.DB.batch([
      env.DB.prepare(`UPDATE lignes SET montant = ?2 WHERE id = ?1`).bind(id, ligne.montant - part),
      env.DB.prepare(
        `INSERT INTO lignes (id, depense_id, compte_id, libelle, montant, categorie_id, confiance)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, 1)`,
      ).bind(genererId("lig"), ligne.depense_id, s.compte_id, ligne.libelle, part, c.categorie_id),
    ]);
    return json({ ok: true });
  }

  if (p.startsWith("/api/ligne/") && req.method === "PATCH") {
    if (!ecriture) return json({ erreur: "echeance" }, 402);
    const id = p.split("/")[3];
    const c = await req.json<any>();
    const ligne = await env.DB.prepare(
      `SELECT libelle, montant, categorie_id FROM lignes WHERE id = ?1 AND compte_id = ?2`,
    ).bind(id, s.compte_id).first<any>();
    if (!ligne) return json({ erreur: "inconnue" }, 404);

    const cat = c.categorie_id ?? ligne.categorie_id;
    const montant = c.montant === undefined ? ligne.montant : Number(c.montant) || 0;

    const stmts = [
      env.DB.prepare(`UPDATE lignes SET categorie_id = ?2, montant = ?3, confiance = 1 WHERE id = ?1`)
        .bind(id, cat, montant),
    ];

    // Une catégorie corrigée à la main devient une règle : plus d'appel Vision pour ce libellé.
    if (c.categorie_id && c.categorie_id !== ligne.categorie_id) {
      stmts.push(env.DB.prepare(
        `INSERT INTO regles (id, compte_id, libelle_norm, categorie_id)
         VALUES (?1, ?2, ?3, ?4)
         ON CONFLICT(compte_id, libelle_norm)
         DO UPDATE SET categorie_id = excluded.categorie_id, hits = hits + 1, maj_le = datetime('now')`,
      ).bind(genererId("reg"), s.compte_id, normaliserLibelle(ligne.libelle), c.categorie_id));
    }

    await env.DB.batch(stmts);
    return json({ ok: true });
  }

  if (p.startsWith("/api/categorie/") && req.method === "PATCH") {
    if (!ecriture) return json({ erreur: "echeance" }, 402);
    const id = p.split("/")[3];
    const c = await req.json<any>();
    const cat = await env.DB.prepare(`SELECT systeme, nom FROM categories WHERE id = ?1 AND compte_id = ?2`)
      .bind(id, s.compte_id).first<any>();
    if (!cat) return json({ erreur: "inconnue" }, 404);

    // Seul le budget est modifiable : les noms de catégories ne se renomment pas.
    await env.DB.prepare(
      `UPDATE categories SET budget = ?2 WHERE id = ?1 AND compte_id = ?3`,
    ).bind(id, c.budget === null || c.budget === "" ? null : Number(c.budget) || null, s.compte_id).run();
    return json({ ok: true });
  }

  if (p.startsWith("/api/depense/") && req.method === "DELETE") {
    await env.DB.prepare(`DELETE FROM depenses WHERE id = ?1 AND compte_id = ?2`)
      .bind(p.split("/")[3], s.compte_id).run();
    return json({ ok: true });
  }

  return json({ erreur: "route" }, 404);
}

async function scanner(req: Request, env: Env, s: Session): Promise<Response> {
  const form = await req.formData();
  const fichier = form.get("image");
  if (!(fichier instanceof File)) return json({ erreur: "image manquante" }, 400);

  const octets = new Uint8Array(await fichier.arrayBuffer());
  let bin = "";
  for (let i = 0; i < octets.length; i += 8192) {
    bin += String.fromCharCode(...octets.subarray(i, i + 8192));
  }
  const base64 = btoa(bin);

  const cats = await env.DB.prepare(
    `SELECT id, nom, description FROM categories WHERE compte_id = ?1 ORDER BY ordre`,
  ).bind(s.compte_id).all<CategorieRow>();
  const categories = cats.results ?? [];

  const extrait = await analyserImage(env.ANTHROPIC_API_KEY, base64, fichier.type || "image/jpeg", categories, env.ANTHROPIC_MODEL);

  const regles = await env.DB.prepare(
    `SELECT libelle_norm, categorie_id FROM regles WHERE compte_id = ?1`,
  ).bind(s.compte_id).all<any>();
  const parRegle = new Map((regles.results ?? []).map((r) => [r.libelle_norm, r.categorie_id]));
  const parNom = new Map(categories.map((c) => [c.nom, c.id]));
  const divers = parNom.get("Divers") ?? categories[categories.length - 1]?.id ?? null;

  // Deuxième passe : ce que Vision n'a pas su nommer, on va le chercher sur le web.
  const incertaines = extrait.lignes.filter(
    (l) => !parRegle.has(normaliserLibelle(l.libelle)) && l.confiance < SEUIL_CONFIANCE,
  );
  if (incertaines.length) {
    try {
      const trouve = await elucider(env.ANTHROPIC_API_KEY, incertaines.map((l) => l.libelle), categories, env.ANTHROPIC_MODEL);
      for (const t of trouve) {
        const cible = incertaines.find(
          (l) => normaliserLibelle(l.libelle) === normaliserLibelle(t.libelle),
        );
        if (cible && t.confiance > cible.confiance && parNom.has(t.categorie)) {
          cible.categorie = t.categorie;
          cible.confiance = t.confiance;
          if (t.quoi) cible.libelle = `${cible.libelle} (${t.quoi})`;
        }
      }
    } catch {
      // La recherche est un confort : son échec ne doit pas perdre le ticket.
    }
  }

  const depId = genererId("dep");
  const source = form.get("source") === "screenshot" ? "screenshot" : "scan";
  const stmts: D1PreparedStatement[] = [
    env.DB.prepare(
      `INSERT INTO depenses (id, compte_id, date, marchand, source, total) VALUES (?1, ?2, ?3, ?4, ?5, ?6)`,
    ).bind(depId, s.compte_id, extrait.date ?? new Date().toISOString().slice(0, 10),
           extrait.marchand, source, extrait.total),
  ];

  for (const l of extrait.lignes) {
    const norm = normaliserLibelle(l.libelle);
    const parRegleId = parRegle.get(norm);
    const catId = parRegleId ?? parNom.get(l.categorie) ?? divers;
    const conf = parRegleId ? 1 : l.confiance;
    stmts.push(env.DB.prepare(
      `INSERT INTO lignes (id, depense_id, compte_id, libelle, montant, categorie_id, confiance)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)`,
    ).bind(genererId("lig"), depId, s.compte_id, l.libelle, l.montant, catId, conf));
  }

  await env.DB.batch(stmts);

  const aClasser = extrait.lignes.filter((l) => {
    const parRegleId = parRegle.get(normaliserLibelle(l.libelle));
    return !parRegleId && l.confiance < SEUIL_CONFIANCE;
  }).length;

  return json({
    id: depId, marchand: extrait.marchand, total: chf(extrait.total),
    lignes: extrait.lignes.length, aClasser,
  });
}
