import 'reflect-metadata';
import { writeFileSync } from 'fs';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from '../src/app.module';

const PLAIN_KEY = /^[A-Za-z0-9_$./{}<>-]+$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function toYaml(value: unknown, indent = 0): string {
  const pad = ' '.repeat(indent);
  if (value === null || value === undefined) return 'null';
  if (typeof value === 'string') return JSON.stringify(value);
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) {
    if (!value.length) return '[]';
    return value.map((item) => {
      if (isRecord(item)) return `${pad}-\n${toYaml(item, indent + 2)}`;
      return `${pad}- ${toYaml(item, indent + 2)}`;
    }).join('\n');
  }
  const entries = Object.entries(value as Record<string, unknown>);
  if (!entries.length) return '{}';
  return entries.map(([key, item]) => {
    const keyText = PLAIN_KEY.test(key) ? key : JSON.stringify(key);
    const isExpandable = isRecord(item)
      ? Object.keys(item).length > 0
      : Array.isArray(item) && item.length > 0;
    if (isExpandable) return `${pad}${keyText}:\n${toYaml(item, indent + 2)}`;
    return `${pad}${keyText}: ${toYaml(item, indent + 2)}`;
  }).join('\n');
}

async function generate(): Promise<void> {
  const app = await NestFactory.create(AppModule, { logger: false });
  const config = new DocumentBuilder()
    .setTitle('XeuySil API')
    .setDescription(
      [
        'API REST de la plateforme XeuySil (NestJS + Prisma + PostgreSQL).',
        'Supabase Auth est utilisé uniquement pour l’identité : confirmation de compte et réinitialisation de mot de passe.',
        'Toutes les données métier sont stockées dans PostgreSQL et les photos de profil dans le bucket Supabase `pictureProfile`.',
        'Les réponses `photoUrl` renvoient toujours une URL : l’avatar par défaut `/avatars/default.svg` est utilisé quand aucune photo n’a été fournie.',
      ].join('\n\n'),
    )
    .setVersion('1.0.0')
    .setContact('XeuySil Platform Team', '', 'platform@xeuysil.com')
    .addServer('http://localhost:3000', 'Local NestJS backend')
    .addServer('https://api.xeuysil.com', 'Production API')
    .addTag('Auth', 'Inscription, connexion, mot de passe et session utilisateur.')
    .addTag('Bootstrap', 'Données initiales nécessaires au démarrage du front.')
    .addTag('Reference - Jobs', 'Référentiel métier centralisé et contrôlé.')
    .addTag('Reference - Zones', 'Structure géographique hiérarchique.')
    .addTag('Workers', 'Profil, disponibilités et activités du travailleur.')
    .addTag('Recruiters', 'Profil recruteur et suivi d’activité.')
    .addTag('Agents', 'Profil agent et proposition de travailleurs.')
    .addTag('Missions', 'Création, publication, clôture et suivi des missions.')
    .addTag('Applications', 'Candidatures, sélection, confirmation et rejet.')
    .addTag('Availability', 'Disponibilités journalières et créneaux de travail.')
    .addTag('Commissions', 'Commissions, paiements, soldes et restrictions.')
    .addTag('Notifications', 'Notifications utilisateur et messagerie WhatsApp.')
    .addTag('Dashboard', 'Indicateurs et synthèses métier par profil.')
    .addTag('Admin', 'Administration système et gestion de plateforme.')
    .addTag('WhatsApp', 'Webhooks et envoi de messages WhatsApp.')
    .addTag('Settings', 'Paramètres globaux applicatifs.')
    .addTag('Profile', 'Photo de profil et préférences utilisateur.')
    .addTag('Avatars', 'Ressources statiques d’avatar par défaut.')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  writeFileSync('openapi.yaml', `${toYaml(document)}\n`, 'utf8');
  await app.close();
}

void generate();
