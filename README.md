# enveloppe

Budget par enveloppe. Salaire → charges fixes → épargne → **disponible**.
Le disponible se répartit en catégories, alimentées par scan de tickets et de captures d'écran.

Cloudflare Workers + D1. Déploiement automatique sur push `main`.

## Principe

```
Salaire          5'000
− Fixes          2'500   éditable ligne par ligne
− Épargne        1'000   montant fixe, % réel affiché à côté
= Disponible     1'500   ← les catégories vivent là-dedans
```

Une projection linéaire prévient quand le rythme mène dans le mur :
« À ce rythme : −340 CHF le 31. À sec le 22. »

## Décisions verrouillées

- **Alcool et Tabac** sont des catégories système : non supprimables, non fusionnables,
  jamais confondues avec Nourriture. C'est le point de départ du projet.
- **Multi-comptes dès l'origine.** `compte_id` sur chaque table, chaque requête filtrée.
  Une seule instance, jamais de déploiement par utilisateur.
- **1 compte = 1 foyer, N codes.** Deux téléphones, une seule enveloppe.
- **Code à 6 chiffres, jamais de mot de passe.** Le code ne change jamais, même au
  renouvellement — un code qui tourne chaque année génère du support toute l'année.
- **Catégories libres par foyer.** Chacune porte une `description` d'une ligne, injectée
  dans le prompt Vision. Sans description, le modèle ne sait pas classer.
- **Les corrections deviennent des règles.** Réaffecter une ligne écrit dans `regles` :
  le même libellé part directement au bon endroit au scan suivant, sans appel API.
- **Achats en ligne : capture d'écran déposée**, même pipeline que le papier.
  Une confirmation n'est pas un débit — suppression manuelle si retour.
- **Statuts** : `exempt` (offert) · `actif` · `impaye` · `archive`. Stripe branché plus tard,
  les colonnes existent déjà.

## Classement d'une ligne

1. `regles` — correspondance exacte sur libellé normalisé. Gratuit, instantané.
2. Vision — prompt construit à la volée depuis les catégories du compte.
3. Confiance < 0.6 → Divers + pastille orange, badge « à vérifier » sur l'accueil.

## Couleurs

vert < 70 % du budget · ambre 70–100 % · rouge > 100 %.
Alcool et Tabac gardent une teinte violette en permanence, avec cumul annuel.

## Migrations

Appliquées via GitHub Actions (`wrangler d1 migrations apply`).
Secrets requis : `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`.

## Règles de travail

Une substitution à la fois. `npm run bundle` avant chaque push. Version incrémentée à chaque push.
