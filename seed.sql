DELETE FROM lignes     WHERE compte_id IN (SELECT compte_id FROM codes WHERE code = '039887');
DELETE FROM depenses   WHERE compte_id IN (SELECT compte_id FROM codes WHERE code = '039887');
DELETE FROM regles     WHERE compte_id IN (SELECT compte_id FROM codes WHERE code = '039887');
DELETE FROM fixes      WHERE compte_id IN (SELECT compte_id FROM codes WHERE code = '039887');
DELETE FROM categories WHERE compte_id IN (SELECT compte_id FROM codes WHERE code = '039887');
DELETE FROM comptes    WHERE id IN (SELECT compte_id FROM codes WHERE code = '039887');
DELETE FROM codes      WHERE code = '039887';
