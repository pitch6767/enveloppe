-- enveloppe — migration 0004
-- Statut « suspendu » : l'accès est coupé en écriture sans rien effacer,
-- le temps qu'un paiement soit régularisé. SQLite ne modifie pas une
-- contrainte CHECK en place, la table est recréée.

CREATE TABLE comptes_nouveau (
  id         TEXT PRIMARY KEY,
  nom        TEXT NOT NULL,
  statut     TEXT NOT NULL DEFAULT 'actif'
             CHECK (statut IN ('exempt','actif','suspendu','archive')),
  salaire    REAL NOT NULL DEFAULT 0,
  epargne    REAL NOT NULL DEFAULT 0,
  expire_le  TEXT,
  note       TEXT,
  cree_le    TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT INTO comptes_nouveau (id, nom, statut, salaire, epargne, expire_le, note, cree_le)
SELECT id, nom, statut, salaire, epargne, expire_le, note, cree_le FROM comptes;

DROP TABLE comptes;
ALTER TABLE comptes_nouveau RENAME TO comptes;

CREATE INDEX idx_comptes_expire ON comptes(expire_le);
