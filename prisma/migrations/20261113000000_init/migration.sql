-- CreateEnum
CREATE TYPE "role_enum" AS ENUM ('TRAVAILLEUR', 'RECRUTEUR', 'AGENT', 'ADMINISTRATEUR');

-- CreateEnum
CREATE TYPE "statut_compte_enum" AS ENUM ('ACTIF', 'SUSPENDU', 'SUPPRIME');

-- CreateEnum
CREATE TYPE "type_recruteur_enum" AS ENUM ('PARTICULIER', 'ENTREPRISE');

-- CreateEnum
CREATE TYPE "niveau_zone_enum" AS ENUM ('REGION', 'DEPARTEMENT', 'COMMUNE', 'QUARTIER');

-- CreateEnum
CREATE TYPE "type_horaire_enum" AS ENUM ('TRAVAIL_JOURNALIER', 'DEMI_JOURNEE', 'CRENEAU_PRECIS');

-- CreateEnum
CREATE TYPE "mode_attribution_enum" AS ENUM ('PREMIER_ARRIVE', 'SELECTION');

-- CreateEnum
CREATE TYPE "statut_mission_enum" AS ENUM ('BROUILLON', 'PUBLIEE', 'PARTIELLEMENT_POURVUE', 'POURVUE', 'EN_COURS', 'TERMINEE', 'ANNULEE', 'EXPIREE', 'SUSPENDUE', 'CLOTUREE');

-- CreateEnum
CREATE TYPE "statut_candidature_enum" AS ENUM ('PROPOSEE', 'INTERESSE', 'SELECTIONNEE', 'CONFIRMEE', 'REFUSEE', 'EXPIREE', 'ANNULEE', 'LISTE_ATTENTE', 'RETIREE');

-- CreateEnum
CREATE TYPE "periode_dispo_enum" AS ENUM ('JOURNEE', 'MATIN', 'APRES_MIDI', 'CRENEAU');

-- CreateEnum
CREATE TYPE "canal_enum" AS ENUM ('APPLICATION', 'WHATSAPP', 'SMS', 'APPEL');

-- CreateEnum
CREATE TYPE "presence_enum" AS ENUM ('NON_SAISIE', 'PRESENT', 'ABSENT');

-- CreateEnum
CREATE TYPE "statut_message_enum" AS ENUM ('EN_FILE', 'ENVOYE', 'LIVRE', 'LU', 'ECHEC');

-- CreateTable
CREATE TABLE "profiles" (
    "id" UUID NOT NULL,
    "nom" VARCHAR(255) NOT NULL,
    "telephone" VARCHAR(30),
    "role" "role_enum" NOT NULL DEFAULT 'TRAVAILLEUR',
    "statut" "statut_compte_enum" NOT NULL DEFAULT 'ACTIF',
    "langue" VARCHAR(10) NOT NULL,
    "photo_url" TEXT,
    "is_premium" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agents" (
    "user_id" UUID NOT NULL,
    "perimetre" TEXT,
    "code_parrainage" VARCHAR(50),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "agents_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "travailleurs" (
    "user_id" UUID NOT NULL,
    "score_fiabilite" DECIMAL(5,2),
    "possede_son_materiel" BOOLEAN NOT NULL DEFAULT false,
    "agent_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "travailleurs_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "recruteurs" (
    "user_id" UUID NOT NULL,
    "type_recruteur" "type_recruteur_enum" NOT NULL,
    "raison_sociale" VARCHAR(255) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "recruteurs_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "metiers" (
    "id" UUID NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "libelle" VARCHAR(255) NOT NULL,
    "categorie" VARCHAR(100) NOT NULL,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "metiers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "profil_metiers" (
    "id" UUID NOT NULL,
    "travailleur_id" UUID NOT NULL,
    "metier_id" UUID NOT NULL,
    "experience_annees" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "profil_metiers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "zones" (
    "id" UUID NOT NULL,
    "nom" VARCHAR(255) NOT NULL,
    "niveau" "niveau_zone_enum" NOT NULL,
    "parent_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "zones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "travailleur_zones" (
    "travailleur_id" UUID NOT NULL,
    "zone_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "travailleur_zones_pkey" PRIMARY KEY ("travailleur_id","zone_id")
);

-- CreateTable
CREATE TABLE "disponibilites" (
    "id" UUID NOT NULL,
    "travailleur_id" UUID NOT NULL,
    "date_disponibilite" DATE NOT NULL,
    "periode" "periode_dispo_enum" NOT NULL,
    "heure_debut" TIME(6),
    "heure_fin" TIME(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "disponibilites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "missions" (
    "id" UUID NOT NULL,
    "recruteur_id" UUID NOT NULL,
    "metier_id" UUID NOT NULL,
    "zone_id" UUID NOT NULL,
    "description" TEXT,
    "nombre_postes" INTEGER NOT NULL,
    "remuneration_fcfa" BIGINT NOT NULL,
    "date_mission" DATE NOT NULL,
    "date_publication" DATE,
    "date_cloture" DATE,
    "type_horaire" "type_horaire_enum",
    "heure_debut" TIME(6),
    "heure_fin" TIME(6),
    "urgente" BOOLEAN NOT NULL DEFAULT false,
    "mode_attribution" "mode_attribution_enum" NOT NULL DEFAULT 'PREMIER_ARRIVE',
    "statut" "statut_mission_enum" NOT NULL DEFAULT 'BROUILLON',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "missions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mission_status_history" (
    "id" UUID NOT NULL,
    "mission_id" UUID NOT NULL,
    "ancien_statut" "statut_mission_enum",
    "nouveau_statut" "statut_mission_enum" NOT NULL,
    "changed_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mission_status_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "candidatures" (
    "id" UUID NOT NULL,
    "mission_id" UUID NOT NULL,
    "travailleur_id" UUID NOT NULL,
    "statut" "statut_candidature_enum" NOT NULL,
    "canal" "canal_enum" NOT NULL,
    "date_reponse" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "candidatures_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "candidature_status_history" (
    "id" UUID NOT NULL,
    "candidature_id" UUID NOT NULL,
    "ancien_statut" "statut_candidature_enum",
    "nouveau_statut" "statut_candidature_enum" NOT NULL,
    "changed_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "candidature_status_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "confirmations" (
    "id" UUID NOT NULL,
    "candidature_id" UUID NOT NULL,
    "date_confirmation" DATE,
    "presence" "presence_enum" NOT NULL DEFAULT 'NON_SAISIE',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "confirmations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evaluations" (
    "id" UUID NOT NULL,
    "mission_id" UUID NOT NULL,
    "auteur_id" UUID NOT NULL,
    "cible_id" UUID NOT NULL,
    "note" SMALLINT NOT NULL,
    "commentaire" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "evaluations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL,
    "utilisateur_id" UUID NOT NULL,
    "mission_id" UUID,
    "type" VARCHAR(50) NOT NULL,
    "canal" "canal_enum" NOT NULL,
    "statut" "statut_message_enum" NOT NULL DEFAULT 'EN_FILE',
    "id_message_externe" VARCHAR(255),
    "date_envoi" TIMESTAMPTZ(6),
    "lu" BOOLEAN NOT NULL DEFAULT false,
    "lu_at" TIMESTAMPTZ(6),
    "clicked_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_events" (
    "id" UUID NOT NULL,
    "notification_id" UUID NOT NULL,
    "status" "statut_message_enum" NOT NULL,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "consentements" (
    "id" UUID NOT NULL,
    "utilisateur_id" UUID NOT NULL,
    "canal" "canal_enum" NOT NULL,
    "accorde" BOOLEAN NOT NULL DEFAULT false,
    "date_consentement" TIMESTAMPTZ(6) NOT NULL,
    "recueilli_par" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "consentements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "commissions" (
    "id" UUID NOT NULL,
    "travailleur_id" UUID NOT NULL,
    "mission_id" UUID NOT NULL,
    "montant_brut" BIGINT NOT NULL,
    "pourcentage" DECIMAL(5,2) NOT NULL,
    "montant_commission" BIGINT NOT NULL,
    "montant_net" BIGINT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "commissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_settings" (
    "id" UUID NOT NULL,
    "setting_key" VARCHAR(100) NOT NULL,
    "setting_value" TEXT,
    "description" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "platform_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "profiles_role_idx" ON "profiles"("role");

-- CreateIndex
CREATE INDEX "profiles_statut_idx" ON "profiles"("statut");

-- CreateIndex
CREATE INDEX "profiles_telephone_idx" ON "profiles"("telephone");

-- CreateIndex
CREATE UNIQUE INDEX "profiles_telephone_key" ON "profiles"("telephone");

-- CreateIndex
CREATE UNIQUE INDEX "agents_code_parrainage_key" ON "agents"("code_parrainage");

-- CreateIndex
CREATE INDEX "travailleurs_agent_id_idx" ON "travailleurs"("agent_id");

-- CreateIndex
CREATE INDEX "travailleurs_score_fiabilite_idx" ON "travailleurs"("score_fiabilite");

-- CreateIndex
CREATE UNIQUE INDEX "metiers_code_key" ON "metiers"("code");

-- CreateIndex
CREATE UNIQUE INDEX "metiers_libelle_key" ON "metiers"("libelle");

-- CreateIndex
CREATE INDEX "metiers_categorie_idx" ON "metiers"("categorie");

-- CreateIndex
CREATE INDEX "metiers_actif_idx" ON "metiers"("actif");

-- CreateIndex
CREATE UNIQUE INDEX "profil_metiers_travailleur_id_metier_id_key" ON "profil_metiers"("travailleur_id", "metier_id");

-- CreateIndex
CREATE INDEX "zones_parent_id_idx" ON "zones"("parent_id");

-- CreateIndex
CREATE INDEX "zones_niveau_idx" ON "zones"("niveau");

-- CreateIndex
CREATE INDEX "disponibilites_travailleur_id_idx" ON "disponibilites"("travailleur_id");

-- CreateIndex
CREATE INDEX "disponibilites_date_disponibilite_idx" ON "disponibilites"("date_disponibilite");

-- CreateIndex
CREATE INDEX "disponibilites_travailleur_id_date_disponibilite_idx" ON "disponibilites"("travailleur_id", "date_disponibilite");

-- CreateIndex
CREATE INDEX "missions_statut_idx" ON "missions"("statut");

-- CreateIndex
CREATE INDEX "missions_date_mission_idx" ON "missions"("date_mission");

-- CreateIndex
CREATE INDEX "missions_recruteur_id_idx" ON "missions"("recruteur_id");

-- CreateIndex
CREATE INDEX "missions_metier_id_idx" ON "missions"("metier_id");

-- CreateIndex
CREATE INDEX "missions_zone_id_idx" ON "missions"("zone_id");

-- CreateIndex
CREATE INDEX "missions_urgente_idx" ON "missions"("urgente");

-- CreateIndex
CREATE INDEX "missions_statut_date_mission_idx" ON "missions"("statut", "date_mission");

-- CreateIndex
CREATE INDEX "mission_status_history_mission_id_idx" ON "mission_status_history"("mission_id");

-- CreateIndex
CREATE INDEX "mission_status_history_created_at_idx" ON "mission_status_history"("created_at");

-- CreateIndex
CREATE INDEX "candidatures_mission_id_idx" ON "candidatures"("mission_id");

-- CreateIndex
CREATE INDEX "candidatures_travailleur_id_idx" ON "candidatures"("travailleur_id");

-- CreateIndex
CREATE INDEX "candidatures_statut_idx" ON "candidatures"("statut");

-- CreateIndex
CREATE INDEX "candidatures_mission_id_statut_idx" ON "candidatures"("mission_id", "statut");

-- CreateIndex
CREATE UNIQUE INDEX "candidatures_mission_id_travailleur_id_key" ON "candidatures"("mission_id", "travailleur_id");

-- CreateIndex
CREATE UNIQUE INDEX "confirmations_candidature_id_key" ON "confirmations"("candidature_id");

-- CreateIndex
CREATE INDEX "evaluations_mission_id_idx" ON "evaluations"("mission_id");

-- CreateIndex
CREATE INDEX "evaluations_cible_id_idx" ON "evaluations"("cible_id");

-- CreateIndex
CREATE INDEX "notifications_utilisateur_id_idx" ON "notifications"("utilisateur_id");

-- CreateIndex
CREATE INDEX "notifications_statut_idx" ON "notifications"("statut");

-- CreateIndex
CREATE INDEX "notifications_canal_idx" ON "notifications"("canal");

-- CreateIndex
CREATE INDEX "notifications_date_envoi_idx" ON "notifications"("date_envoi");

-- CreateIndex
CREATE INDEX "notification_events_notification_id_idx" ON "notification_events"("notification_id");

-- CreateIndex
CREATE INDEX "commissions_travailleur_id_idx" ON "commissions"("travailleur_id");

-- CreateIndex
CREATE INDEX "commissions_mission_id_idx" ON "commissions"("mission_id");

-- CreateIndex
CREATE INDEX "commissions_created_at_idx" ON "commissions"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "commissions_travailleur_id_mission_id_key" ON "commissions"("travailleur_id", "mission_id");

-- CreateIndex
CREATE UNIQUE INDEX "platform_settings_setting_key_key" ON "platform_settings"("setting_key");

-- AddForeignKey
ALTER TABLE "agents" ADD CONSTRAINT "agents_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "travailleurs" ADD CONSTRAINT "travailleurs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "travailleurs" ADD CONSTRAINT "travailleurs_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "agents"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recruteurs" ADD CONSTRAINT "recruteurs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "profil_metiers" ADD CONSTRAINT "profil_metiers_travailleur_id_fkey" FOREIGN KEY ("travailleur_id") REFERENCES "travailleurs"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "profil_metiers" ADD CONSTRAINT "profil_metiers_metier_id_fkey" FOREIGN KEY ("metier_id") REFERENCES "metiers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "zones" ADD CONSTRAINT "zones_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "zones"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "travailleur_zones" ADD CONSTRAINT "travailleur_zones_travailleur_id_fkey" FOREIGN KEY ("travailleur_id") REFERENCES "travailleurs"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "travailleur_zones" ADD CONSTRAINT "travailleur_zones_zone_id_fkey" FOREIGN KEY ("zone_id") REFERENCES "zones"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "disponibilites" ADD CONSTRAINT "disponibilites_travailleur_id_fkey" FOREIGN KEY ("travailleur_id") REFERENCES "travailleurs"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "missions" ADD CONSTRAINT "missions_recruteur_id_fkey" FOREIGN KEY ("recruteur_id") REFERENCES "recruteurs"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "missions" ADD CONSTRAINT "missions_metier_id_fkey" FOREIGN KEY ("metier_id") REFERENCES "metiers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "missions" ADD CONSTRAINT "missions_zone_id_fkey" FOREIGN KEY ("zone_id") REFERENCES "zones"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mission_status_history" ADD CONSTRAINT "mission_status_history_mission_id_fkey" FOREIGN KEY ("mission_id") REFERENCES "missions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "candidatures" ADD CONSTRAINT "candidatures_mission_id_fkey" FOREIGN KEY ("mission_id") REFERENCES "missions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "candidatures" ADD CONSTRAINT "candidatures_travailleur_id_fkey" FOREIGN KEY ("travailleur_id") REFERENCES "travailleurs"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "candidature_status_history" ADD CONSTRAINT "candidature_status_history_candidature_id_fkey" FOREIGN KEY ("candidature_id") REFERENCES "candidatures"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "confirmations" ADD CONSTRAINT "confirmations_candidature_id_fkey" FOREIGN KEY ("candidature_id") REFERENCES "candidatures"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluations" ADD CONSTRAINT "evaluations_mission_id_fkey" FOREIGN KEY ("mission_id") REFERENCES "missions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluations" ADD CONSTRAINT "evaluations_auteur_id_fkey" FOREIGN KEY ("auteur_id") REFERENCES "profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluations" ADD CONSTRAINT "evaluations_cible_id_fkey" FOREIGN KEY ("cible_id") REFERENCES "profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_mission_id_fkey" FOREIGN KEY ("mission_id") REFERENCES "missions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_events" ADD CONSTRAINT "notification_events_notification_id_fkey" FOREIGN KEY ("notification_id") REFERENCES "notifications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commissions" ADD CONSTRAINT "commissions_travailleur_id_fkey" FOREIGN KEY ("travailleur_id") REFERENCES "travailleurs"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commissions" ADD CONSTRAINT "commissions_mission_id_fkey" FOREIGN KEY ("mission_id") REFERENCES "missions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

