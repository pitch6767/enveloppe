SELECT c.id, c.nom, c.statut, c.salaire, c.epargne,
       (SELECT code FROM codes WHERE compte_id = c.id LIMIT 1) AS code,
       (SELECT COUNT(*) FROM fixes WHERE compte_id = c.id) AS nb_fixes,
       (SELECT COUNT(*) FROM depenses WHERE compte_id = c.id) AS nb_dep,
       (SELECT COUNT(*) FROM categories WHERE compte_id = c.id AND budget IS NOT NULL) AS nb_budgets
  FROM comptes c ORDER BY c.cree_le;
