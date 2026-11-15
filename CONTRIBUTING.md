# Guide de contribution — XeuySil

## Règles de collaboration

### Branches

- La branche `main` est **protégée** : aucun push direct n'est autorisé.
- Créez une branche à partir de `main` pour chaque tâche :
  - `feature/nom-de-la-fonctionnalite` pour les nouvelles fonctionnalités
  - `fix/description-du-bug` pour les corrections
  - `docs/sujet` pour la documentation
  - `ci/description` pour les changements CI/CD

### Pull Requests

- Toute modification doit passer par une **Pull Request** (PR).
- Chaque PR nécessite **au moins 1 approbation** avant fusion.
- Décrivez clairement vos changements dans la PR.
- Les PR obsolètes sont automatiquement invalidées après un nouveau push.

### Commits

- Messages de commit en **français**, clairs et concis.
- Format : `type: description courte`
  - Exemples : `feature: ajout du endpoint de candidature`
  - `fix: correction du calcul des places restantes`
  - `docs: mise à jour du README`

### Ce qu'il ne faut PAS faire

- **Ne committez jamais** de fichiers `.env`, tokens, clés API ou mots de passe.
- **Ne poussez pas** directement sur `main`.
- **Ne modifiez pas** les fichiers `Jenkinsfile`, `Dockerfile` ou `docker-compose.yml` sans en discuter avec Boubacar.
- **Ne supprimez pas** de fichiers de configuration CI/CD existants.

### Avant de soumettre une PR

1. Vérifiez que votre code compile : `pnpm build` (backend) ou `npx expo lint` (frontend)
2. Lancez les tests si disponibles : `pnpm test` (backend)
3. Vérifiez qu'aucun secret n'est inclus dans vos fichiers
4. Relisez vos changements avec `git diff`

## Équipe

| Membre | Rôle | Dépôt principal |
|--------|------|-----------------|
| Mariama Ciré Diallo | Conception du produit (UML) | Tous |
| Ibrahima Diallo | Backend | serveur-ic |
| Malick Cissoko | Frontend | client-ic |
| Boubacar NIANG | Déploiement et CI/CD | deploiement-dc |
