-- enveloppe — migration 0001
-- Schéma multi-comptes (foyer = 1 compte, N codes)

CREATE TABLE comptes (
  id                 TEXT PRIMARY KEY,
  nom                TEXT NOT NULL,
  statut             TEXT NOT NULL DEFAULT 'actif'
                     CHECK (statut IN ('exempt','actif','impaye','archive')),
  salaire            REAL NOT NULL DEFAULT 0,
  epargne            REAL NOT NULL DEFAULT 0,
  stripe_customer_id TEXT,
  stripe_sub_id      TEXT,
  cree_le            TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE codes (
  id         TEXT PRIMARY KEY,
  compte_id  TEXT NOT NULL REFERENCES comptes(id) ON DELETE CASCADE,
  code       TEXT NOT NULL,
  label      TEXT,
  cree_le    TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE UNIQUE INDEX idx_codes_code ON codes(code);
CREATE INDEX idx_codes_compte ON codes(compte_id);

CREATE TABLE fixes (
  id         TEXT PRIMARY KEY,
  compte_id  TEXT NOT NULL REFERENCES comptes(id) ON DELETE CASCADE,
  libelle    TEXT NOT NULL,
  montant    REAL NOT NULL,
  actif      INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX idx_fixes_compte ON fixes(compte_id);

CREATE TABLE categories (
  id          TEXT PRIMARY KEY,
  compte_id   TEXT NOT NULL REFERENCES comptes(id) ON DELETE CASCADE,
  nom         TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',   -- injectée dans le prompt Vision
  budget      REAL,
  couleur     TEXT,
  systeme     INTEGER NOT NULL DEFAULT 0, -- 1 = Alcool / Tabac, non supprimables
  ordre       INTEGER NOT NULL DEFAULT 0
);
CREATE UNIQUE INDEX idx_cat_compte_nom ON categories(compte_id, nom);
CREATE INDEX idx_cat_compte ON categories(compte_id);

CREATE TABLE depenses (
  id         TEXT PRIMARY KEY,
  compte_id  TEXT NOT NULL REFERENCES comptes(id) ON DELETE CASCADE,
  date       TEXT NOT NULL,
  marchand   TEXT,
  source     TEXT NOT NULL DEFAULT 'scan'
             CHECK (source IN ('scan','screenshot','manuel')),
  total      REAL NOT NULL,
  cree_le    TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_dep_compte_date ON depenses(compte_id, date);

CREATE TABLE lignes (
  id           TEXT PRIMARY KEY,
  depense_id   TEXT NOT NULL REFERENCES depenses(id) ON DELETE CASCADE,
  compte_id    TEXT NOT NULL REFERENCES comptes(id) ON DELETE CASCADE,
  libelle      TEXT NOT NULL,
  montant      REAL NOT NULL,
  categorie_id TEXT REFERENCES categories(id) ON DELETE SET NULL,
  confiance    REAL NOT NULL DEFAULT 1
);
CREATE INDEX idx_lig_compte ON lignes(compte_id);
CREATE INDEX idx_lig_depense ON lignes(depense_id);
CREATE INDEX idx_lig_cat ON lignes(categorie_id);

CREATE TABLE regles (
  id           TEXT PRIMARY KEY,
  compte_id    TEXT NOT NULL REFERENCES comptes(id) ON DELETE CASCADE,
  libelle_norm TEXT NOT NULL,
  categorie_id TEXT NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  hits         INTEGER NOT NULL DEFAULT 1,
  maj_le       TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE UNIQUE INDEX idx_regles_compte_lib ON regles(compte_id, libelle_norm);
