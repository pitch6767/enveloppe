-- enveloppe — migration 0002
-- Paiement en cash : suivi par date d'échéance, plus de Stripe.
-- SQLite ne sait pas DROP COLUMN proprement ici : on recrée la table.

CREATE TABLE comptes_nouveau (
  id         TEXT PRIMARY KEY,
  nom        TEXT NOT NULL,
  statut     TEXT NOT NULL DEFAULT 'actif'
             CHECK (statut IN ('exempt','actif','archive')),
  salaire    REAL NOT NULL DEFAULT 0,
  epargne    REAL NOT NULL DEFAULT 0,
  expire_le  TEXT,          -- NULL = illimité (comptes exempts)
  note       TEXT,          -- mémo libre : "payé cash 18.08.2026"
  cree_le    TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT INTO comptes_nouveau (id, nom, statut, salaire, epargne, expire_le, note, cree_le)
SELECT id,
       nom,
       CASE WHEN statut = 'impaye' THEN 'actif' ELSE statut END,
       salaire,
       epargne,
       CASE WHEN statut = 'exempt' THEN NULL
            ELSE date(cree_le, '+1 year') END,
       NULL,
       cree_le
FROM comptes;

DROP TABLE comptes;
ALTER TABLE comptes_nouveau RENAME TO comptes;

CREATE INDEX idx_comptes_expire ON comptes(expire_le);
