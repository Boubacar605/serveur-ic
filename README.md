# XeuySil — Serveur (Intégration Continue)

Dépôt du backend de la plateforme **XeuySil** : mise en relation entre recruteurs et travailleurs journaliers au Sénégal.

## Présentation

Ce dépôt contient le code serveur de l'application, organisé en **4 microservices** :

| Service | Rôle | Port |
|---------|------|------|
| **identity** | Gestion des comptes, profils, métiers, zones et consentements | 3001 |
| **mission** | Publication, suivi et clôture des missions, évaluations | 3002 |
| **matching** | Disponibilités, candidatures, confirmations et mise en relation | 3003 |
| **notification** | Envoi et suivi des messages (WhatsApp, SMS) | 3004 |

## Stack technique

- **NestJS** (TypeScript strict) avec TypeORM
- **PostgreSQL 16** (un schéma par service)
- **Redis** + BullMQ (files de tâches asynchrones)
- **Swagger / OpenAPI** pour la documentation de l'API
- Passerelle **Nginx** en frontal

## Structure attendue

```
serveur-ic/
├── apps/
│   ├── identity/       # Service identité
│   ├── mission/        # Service missions
│   ├── matching/       # Service mise en relation
│   └── notification/   # Service notifications
├── libs/
│   └── common/         # Code partagé entre services
├── docs/
│   └── uml/            # Diagrammes PlantUML
├── tests/              # Tests unitaires et d'intégration
├── Dockerfile
├── Jenkinsfile
├── package.json
├── tsconfig.json
└── README.md
```

## Pipeline CI (à venir)

Le pipeline Jenkins sera configuré après intégration du code applicatif :

1. Récupération du code
2. Installation des dépendances et compilation
3. Vérification du style (lint)
4. Exécution des tests unitaires
5. Analyse de sécurité du code (npm audit)
6. Construction de l'image Docker (multi-étapes, utilisateur non-root)
7. Analyse de vulnérabilités de l'image (Trivy)
8. Publication sur Docker Hub avec tag versionné

## Équipe

| Membre | Responsabilité |
|--------|---------------|
| Ibrahima Diallo | Développement du backend |
| Boubacar NIANG | Intégration continue et déploiement |

## Licence

Projet universitaire — Master 2 SI-SR, UADB (2026-2027).
