-- enveloppe — migration 0003
-- Une dépense exceptionnelle pèse sur le disponible du mois mais ne doit pas
-- être extrapolée en rythme quotidien : un aspirateur n'est pas une habitude.

ALTER TABLE depenses ADD COLUMN exceptionnel INTEGER NOT NULL DEFAULT 0;
