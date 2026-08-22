-- Réparation après la migration 0004 : les cascades ont vidé les tables enfants.

-- 1. Supprimer le doublon Marie Christine (le plus récent).
DELETE FROM comptes WHERE id = (
  SELECT id FROM comptes WHERE nom = 'Marie Christine' ORDER BY cree_le DESC LIMIT 1
) AND (SELECT COUNT(*) FROM comptes WHERE nom = 'Marie Christine') > 1;

-- 2. Recréer les codes d'accès.
INSERT INTO codes (id, compte_id, code, label)
SELECT 'cod_' || lower(hex(randomblob(10))), id, '330293', 'principal'
  FROM comptes WHERE nom = 'Pitch'
   AND NOT EXISTS (SELECT 1 FROM codes WHERE compte_id = comptes.id);

INSERT INTO codes (id, compte_id, code, label)
SELECT 'cod_' || lower(hex(randomblob(10))), id, '263943', 'principal'
  FROM comptes WHERE nom = 'Marie Christine'
   AND NOT EXISTS (SELECT 1 FROM codes WHERE compte_id = comptes.id);

-- 3. Recréer les catégories pour tout compte qui n'en a plus.
WITH modele(nom, description, couleur, systeme, ordre) AS (VALUES
  ('Nourriture','courses alimentaires, épicerie, boulangerie, marché','#3b7a3b',0,0),
  ('Restaurant','restaurant, take-away, livraison, café, cantine','#5a8f4a',0,1),
  ('Alcool','vin, bière, spiritueux, apéritifs — JAMAIS dans Nourriture','#7b3fa0',1,2),
  ('Tabac','cigarettes, tabac, puff, accessoires — JAMAIS dans Nourriture','#9b4fc0',1,3),
  ('Ménage / Hygiène','lessive, produits d''entretien, papier, savon, dentifrice, rasoir, tondeuse à barbe, aspirateur et petit électroménager du foyer','#4a7f8f',0,4),
  ('Transport','essence, CFF, parking, vignette, entretien véhicule','#3f6fa0',0,5),
  ('Santé','pharmacie, médecin, dentiste, opticien, franchise','#c05f5f',0,6),
  ('Vêtements','habits, chaussures, retouches','#a0623f',0,7),
  ('Loisirs','sport, cinéma, livres, sorties, matériel de loisir','#c0913f',0,8),
  ('Abonnements','téléphone, internet, streaming, applications','#6f6f8f',0,9),
  ('Beauté / Coiffeur','coiffeur, esthétique, parfumerie, soins','#b06f8f',0,10),
  ('Cadeaux','cadeaux, fleurs, dons','#8f5fa0',0,11),
  ('Divers','tout ce qui n''entre nulle part ailleurs — catégorie de repli','#7f7f7f',0,12)
)
INSERT INTO categories (id, compte_id, nom, description, couleur, systeme, ordre)
SELECT 'cat_' || lower(hex(randomblob(10))), c.id, m.nom, m.description, m.couleur, m.systeme, m.ordre
  FROM comptes c, modele m
 WHERE NOT EXISTS (SELECT 1 FROM categories WHERE compte_id = c.id);
