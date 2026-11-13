-- Schéma métier pour PostgreSQL autonome.
-- L'identité (auth.users), la confirmation d'e-mail et la réinitialisation
-- de mot de passe restent dans Supabase Auth. profiles.id reprend l'UUID
-- Supabase, sans clé étrangère inter-bases.
BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================================
-- ENUMS
-- ============================================================================
CREATE TYPE public.role_enum AS ENUM (
    'TRAVAILLEUR',
    'RECRUTEUR',
    'AGENT',
    'ADMINISTRATEUR'
);

CREATE TYPE public.statut_compte_enum AS ENUM (
    'ACTIF',
    'SUSPENDU',
    'SUPPRIME'
);

CREATE TYPE public.type_recruteur_enum AS ENUM (
    'PARTICULIER',
    'ENTREPRISE'
);

CREATE TYPE public.niveau_zone_enum AS ENUM (
    'REGION',
    'DEPARTEMENT',
    'COMMUNE',
    'QUARTIER'
);

CREATE TYPE public.type_horaire_enum AS ENUM (
    'TRAVAIL_JOURNALIER',
    'DEMI_JOURNEE',
    'CRENEAU_PRECIS'
);

CREATE TYPE public.mode_attribution_enum AS ENUM (
    'PREMIER_ARRIVE',
    'SELECTION'
);

CREATE TYPE public.statut_mission_enum AS ENUM (
    'BROUILLON',
    'PUBLIEE',
    'PARTIELLEMENT_POURVUE',
    'POURVUE',
    'EN_COURS',
    'TERMINEE',
    'ANNULEE',
    'EXPIREE',
    'SUSPENDUE',
    'CLOTUREE'
);

CREATE TYPE public.statut_candidature_enum AS ENUM (
    'PROPOSEE',
    'INTERESSE',
    'SELECTIONNEE',
    'CONFIRMEE',
    'REFUSEE',
    'EXPIREE',
    'ANNULEE',
    'LISTE_ATTENTE',
    'RETIREE'
);

CREATE TYPE public.periode_dispo_enum AS ENUM (
    'JOURNEE',
    'MATIN',
    'APRES_MIDI',
    'CRENEAU'
);

CREATE TYPE public.canal_enum AS ENUM (
    'APPLICATION',
    'WHATSAPP',
    'SMS',
    'APPEL'
);

CREATE TYPE public.presence_enum AS ENUM (
    'NON_SAISIE',
    'PRESENT',
    'ABSENT'
);

CREATE TYPE public.statut_message_enum AS ENUM (
    'EN_FILE',
    'ENVOYE',
    'LIVRE',
    'LU',
    'ECHEC'
);

-- ============================================================================
-- FUNCTION: updated_at
-- ============================================================================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- TABLES: PROFILES & AUTH EXTENSION
-- ============================================================================
CREATE TABLE public.profiles (
    id UUID NOT NULL,
    nom VARCHAR(255) NOT NULL,
    telephone VARCHAR(30),
    role role_enum NOT NULL DEFAULT 'TRAVAILLEUR',
    statut statut_compte_enum NOT NULL DEFAULT 'ACTIF',
    langue VARCHAR(10) NOT NULL,
    photo_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ NULL,
    CONSTRAINT pk_profiles PRIMARY KEY (id),
    CONSTRAINT chk_profiles_nom_not_blank CHECK (btrim(nom) <> ''),
    CONSTRAINT chk_profiles_langue_not_blank CHECK (btrim(langue) <> ''),
    CONSTRAINT uq_profiles_telephone UNIQUE (telephone)
);

CREATE TABLE public.agents (
    user_id UUID NOT NULL,
    perimetre TEXT,
    code_parrainage VARCHAR(50),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ NULL,
    CONSTRAINT pk_agents PRIMARY KEY (user_id),
    CONSTRAINT fk_agents_profiles FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE,
    CONSTRAINT uq_agents_code_parrainage UNIQUE (code_parrainage)
);

CREATE TABLE public.travailleurs (
    user_id UUID NOT NULL,
    score_fiabilite NUMERIC(5,2),
    possede_son_materiel BOOLEAN NOT NULL DEFAULT FALSE,
    agent_id UUID NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ NULL,
    CONSTRAINT pk_travailleurs PRIMARY KEY (user_id),
    CONSTRAINT fk_travailleurs_profiles FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE,
    CONSTRAINT fk_travailleurs_agents FOREIGN KEY (agent_id) REFERENCES public.agents(user_id) ON DELETE SET NULL,
    CONSTRAINT chk_travailleurs_score_fiabilite_range CHECK (score_fiabilite IS NULL OR (score_fiabilite BETWEEN 0 AND 100))
);

CREATE TABLE public.recruteurs (
    user_id UUID NOT NULL,
    type_recruteur type_recruteur_enum NOT NULL,
    raison_sociale VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ NULL,
    CONSTRAINT pk_recruteurs PRIMARY KEY (user_id),
    CONSTRAINT fk_recruteurs_profiles FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE
);

-- ============================================================================
-- TABLES: METIERS & PROFIL_METIERS
-- ============================================================================
CREATE TABLE public.metiers (
    id UUID NOT NULL,
    code VARCHAR(50) NOT NULL,
    libelle VARCHAR(255) NOT NULL,
    categorie VARCHAR(100) NOT NULL,
    actif BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ NULL,
    CONSTRAINT pk_metiers PRIMARY KEY (id),
    CONSTRAINT uq_metiers_code UNIQUE (code),
    CONSTRAINT uq_metiers_libelle UNIQUE (libelle)
);

CREATE TABLE public.profil_metiers (
    id UUID NOT NULL,
    travailleur_id UUID NOT NULL,
    metier_id UUID NOT NULL,
    experience_annees INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ NULL,
    CONSTRAINT pk_profil_metiers PRIMARY KEY (id),
    CONSTRAINT fk_profil_metiers_travailleurs FOREIGN KEY (travailleur_id) REFERENCES public.travailleurs(user_id) ON DELETE CASCADE,
    CONSTRAINT fk_profil_metiers_metiers FOREIGN KEY (metier_id) REFERENCES public.metiers(id) ON DELETE RESTRICT,
    CONSTRAINT chk_profil_metiers_experience_annees CHECK (experience_annees >= 0),
    CONSTRAINT uq_profil_metiers_travailleur_metier UNIQUE (travailleur_id, metier_id)
);

-- ============================================================================
-- TABLES: ZONES & AFFECTATIONS
-- ============================================================================
CREATE TABLE public.zones (
    id UUID NOT NULL,
    nom VARCHAR(255) NOT NULL,
    niveau niveau_zone_enum NOT NULL,
    parent_id UUID NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ NULL,
    CONSTRAINT pk_zones PRIMARY KEY (id),
    CONSTRAINT fk_zones_parent FOREIGN KEY (parent_id) REFERENCES public.zones(id) ON DELETE SET NULL
);

CREATE TABLE public.travailleur_zones (
    travailleur_id UUID NOT NULL,
    zone_id UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT pk_travailleur_zones PRIMARY KEY (travailleur_id, zone_id),
    CONSTRAINT fk_travailleur_zones_travailleurs FOREIGN KEY (travailleur_id) REFERENCES public.travailleurs(user_id) ON DELETE CASCADE,
    CONSTRAINT fk_travailleur_zones_zones FOREIGN KEY (zone_id) REFERENCES public.zones(id) ON DELETE CASCADE
);

CREATE TABLE public.disponibilites (
    id UUID NOT NULL,
    travailleur_id UUID NOT NULL,
    date_disponibilite DATE NOT NULL,
    periode periode_dispo_enum NOT NULL,
    heure_debut TIME NULL,
    heure_fin TIME NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ NULL,
    CONSTRAINT pk_disponibilites PRIMARY KEY (id),
    CONSTRAINT fk_disponibilites_travailleurs FOREIGN KEY (travailleur_id) REFERENCES public.travailleurs(user_id) ON DELETE CASCADE,
    CONSTRAINT chk_disponibilites_heure_fin CHECK ((heure_debut IS NULL) OR (heure_fin IS NULL) OR (heure_fin > heure_debut))
);

-- ============================================================================
-- TABLES: MISSIONS & HISTORIQUES
-- ============================================================================
CREATE TABLE public.missions (
    id UUID NOT NULL,
    recruteur_id UUID NOT NULL,
    metier_id UUID NOT NULL,
    zone_id UUID NOT NULL,
    description TEXT,
    nombre_postes INTEGER NOT NULL,
    remuneration_fcfa BIGINT NOT NULL,
    date_mission DATE NOT NULL,
    date_publication DATE,
    date_cloture DATE,
    type_horaire type_horaire_enum,
    heure_debut TIME NULL,
    heure_fin TIME NULL,
    urgente BOOLEAN NOT NULL DEFAULT FALSE,
    mode_attribution mode_attribution_enum NOT NULL DEFAULT 'PREMIER_ARRIVE',
    statut statut_mission_enum NOT NULL DEFAULT 'BROUILLON',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ NULL,
    CONSTRAINT pk_missions PRIMARY KEY (id),
    CONSTRAINT fk_missions_recruteurs FOREIGN KEY (recruteur_id) REFERENCES public.recruteurs(user_id) ON DELETE CASCADE,
    CONSTRAINT fk_missions_metiers FOREIGN KEY (metier_id) REFERENCES public.metiers(id) ON DELETE RESTRICT,
    CONSTRAINT fk_missions_zones FOREIGN KEY (zone_id) REFERENCES public.zones(id) ON DELETE RESTRICT,
    CONSTRAINT chk_missions_nombre_postes CHECK (nombre_postes > 0),
    CONSTRAINT chk_missions_remuneration_fcfa CHECK (remuneration_fcfa > 0),
    CONSTRAINT chk_missions_heure_fin CHECK ((heure_debut IS NULL) OR (heure_fin IS NULL) OR (heure_fin > heure_debut))
);

CREATE TABLE public.mission_status_history (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    mission_id UUID NOT NULL,
    ancien_statut statut_mission_enum,
    nouveau_statut statut_mission_enum NOT NULL,
    changed_by UUID NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT pk_mission_status_history PRIMARY KEY (id),
    CONSTRAINT fk_mission_status_history_missions FOREIGN KEY (mission_id) REFERENCES public.missions(id) ON DELETE CASCADE,
    CONSTRAINT fk_mission_status_history_profiles FOREIGN KEY (changed_by) REFERENCES public.profiles(id) ON DELETE SET NULL
);

-- ============================================================================
-- TABLES: CANDIDATURES & CONFIRMATIONS
-- ============================================================================
CREATE TABLE public.candidatures (
    id UUID NOT NULL,
    mission_id UUID NOT NULL,
    travailleur_id UUID NOT NULL,
    statut statut_candidature_enum NOT NULL,
    canal canal_enum NOT NULL,
    date_reponse TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT pk_candidatures PRIMARY KEY (id),
    CONSTRAINT fk_candidatures_missions FOREIGN KEY (mission_id) REFERENCES public.missions(id) ON DELETE CASCADE,
    CONSTRAINT fk_candidatures_travailleurs FOREIGN KEY (travailleur_id) REFERENCES public.travailleurs(user_id) ON DELETE CASCADE,
    CONSTRAINT uq_candidatures_mission_travailleur UNIQUE (mission_id, travailleur_id)
);

CREATE TABLE public.candidature_status_history (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    candidature_id UUID NOT NULL,
    ancien_statut statut_candidature_enum,
    nouveau_statut statut_candidature_enum NOT NULL,
    changed_by UUID NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT pk_candidature_status_history PRIMARY KEY (id),
    CONSTRAINT fk_candidature_status_history_candidatures FOREIGN KEY (candidature_id) REFERENCES public.candidatures(id) ON DELETE CASCADE,
    CONSTRAINT fk_candidature_status_history_profiles FOREIGN KEY (changed_by) REFERENCES public.profiles(id) ON DELETE SET NULL
);

CREATE TABLE public.confirmations (
    id UUID NOT NULL,
    candidature_id UUID NOT NULL,
    date_confirmation DATE,
    presence presence_enum NOT NULL DEFAULT 'NON_SAISIE',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT pk_confirmations PRIMARY KEY (id),
    CONSTRAINT fk_confirmations_candidatures FOREIGN KEY (candidature_id) REFERENCES public.candidatures(id) ON DELETE CASCADE,
    CONSTRAINT uq_confirmations_candidature UNIQUE (candidature_id)
);

CREATE TABLE public.evaluations (
    id UUID NOT NULL,
    mission_id UUID NOT NULL,
    auteur_id UUID NOT NULL,
    cible_id UUID NOT NULL,
    note SMALLINT NOT NULL,
    commentaire TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT pk_evaluations PRIMARY KEY (id),
    CONSTRAINT fk_evaluations_missions FOREIGN KEY (mission_id) REFERENCES public.missions(id) ON DELETE CASCADE,
    CONSTRAINT fk_evaluations_auteur FOREIGN KEY (auteur_id) REFERENCES public.profiles(id) ON DELETE RESTRICT,
    CONSTRAINT fk_evaluations_cible FOREIGN KEY (cible_id) REFERENCES public.profiles(id) ON DELETE RESTRICT,
    CONSTRAINT chk_evaluations_note CHECK (note BETWEEN 1 AND 5),
    CONSTRAINT chk_evaluations_auteur_diff_cible CHECK (auteur_id <> cible_id)
);

-- ============================================================================
-- TABLES: NOTIFICATIONS & CONSENTEMENTS
-- ============================================================================
CREATE TABLE public.notifications (
    id UUID NOT NULL,
    utilisateur_id UUID NOT NULL,
    mission_id UUID NULL,
    type VARCHAR(50) NOT NULL,
    canal canal_enum NOT NULL,
    statut statut_message_enum NOT NULL DEFAULT 'EN_FILE',
    id_message_externe VARCHAR(255),
    date_envoi TIMESTAMPTZ,
    lu BOOLEAN NOT NULL DEFAULT FALSE,
    lu_at TIMESTAMPTZ NULL,
    clicked_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT pk_notifications PRIMARY KEY (id),
    CONSTRAINT fk_notifications_profiles FOREIGN KEY (utilisateur_id) REFERENCES public.profiles(id) ON DELETE CASCADE,
    CONSTRAINT fk_notifications_missions FOREIGN KEY (mission_id) REFERENCES public.missions(id) ON DELETE SET NULL
);

CREATE TABLE public.notification_events (
    id UUID NOT NULL,
    notification_id UUID NOT NULL,
    status statut_message_enum NOT NULL,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT pk_notification_events PRIMARY KEY (id),
    CONSTRAINT fk_notification_events_notifications FOREIGN KEY (notification_id) REFERENCES public.notifications(id) ON DELETE CASCADE
);

CREATE TABLE public.consentements (
    id UUID NOT NULL,
    utilisateur_id UUID NOT NULL,
    canal canal_enum NOT NULL,
    accorde BOOLEAN NOT NULL DEFAULT FALSE,
    date_consentement TIMESTAMPTZ NOT NULL,
    recueilli_par UUID NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT pk_consentements PRIMARY KEY (id),
    CONSTRAINT fk_consentements_profiles FOREIGN KEY (utilisateur_id) REFERENCES public.profiles(id) ON DELETE CASCADE,
    CONSTRAINT fk_consentements_recueilli_par FOREIGN KEY (recueilli_par) REFERENCES public.profiles(id) ON DELETE SET NULL
);

-- ============================================================================
-- TABLES: COMMISSIONS & SETTINGS
-- ============================================================================
CREATE TABLE public.commissions (
    id UUID NOT NULL,
    travailleur_id UUID NOT NULL,
    mission_id UUID NOT NULL,
    montant_brut BIGINT NOT NULL,
    pourcentage NUMERIC(5,2) NOT NULL,
    montant_commission BIGINT NOT NULL,
    montant_net BIGINT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT pk_commissions PRIMARY KEY (id),
    CONSTRAINT fk_commissions_travailleurs FOREIGN KEY (travailleur_id) REFERENCES public.travailleurs(user_id) ON DELETE CASCADE,
    CONSTRAINT fk_commissions_missions FOREIGN KEY (mission_id) REFERENCES public.missions(id) ON DELETE CASCADE,
    CONSTRAINT chk_commissions_pourcentage CHECK (pourcentage BETWEEN 0 AND 100),
    CONSTRAINT chk_commissions_montants_non_negatifs CHECK (montant_brut >= 0 AND montant_commission >= 0 AND montant_net >= 0),
    CONSTRAINT uq_commissions_travailleur_mission UNIQUE (travailleur_id, mission_id)
);

CREATE TABLE public.platform_settings (
    id UUID NOT NULL,
    setting_key VARCHAR(100) NOT NULL,
    setting_value TEXT,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT pk_platform_settings PRIMARY KEY (id),
    CONSTRAINT uq_platform_settings_setting_key UNIQUE (setting_key)
);

-- ============================================================================
-- INDEXES EXPLICITES
-- ============================================================================
CREATE INDEX idx_profiles_role ON public.profiles (role);
CREATE INDEX idx_profiles_statut ON public.profiles (statut);
CREATE INDEX idx_profiles_telephone ON public.profiles (telephone);

CREATE INDEX idx_travailleurs_agent_id ON public.travailleurs (agent_id);
CREATE INDEX idx_travailleurs_score_fiabilite ON public.travailleurs (score_fiabilite);

CREATE INDEX idx_metiers_categorie ON public.metiers (categorie);
CREATE INDEX idx_metiers_actif ON public.metiers (actif);

CREATE INDEX idx_zones_parent_id ON public.zones (parent_id);
CREATE INDEX idx_zones_niveau ON public.zones (niveau);

CREATE INDEX idx_disponibilites_travailleur_id ON public.disponibilites (travailleur_id);
CREATE INDEX idx_disponibilites_date_disponibilite ON public.disponibilites (date_disponibilite);
CREATE INDEX idx_disponibilites_travailleur_date ON public.disponibilites (travailleur_id, date_disponibilite);

CREATE INDEX idx_missions_statut ON public.missions (statut);
CREATE INDEX idx_missions_date_mission ON public.missions (date_mission);
CREATE INDEX idx_missions_recruteur_id ON public.missions (recruteur_id);
CREATE INDEX idx_missions_metier_id ON public.missions (metier_id);
CREATE INDEX idx_missions_zone_id ON public.missions (zone_id);
CREATE INDEX idx_missions_urgente ON public.missions (urgente);
CREATE INDEX idx_missions_statut_date_mission ON public.missions (statut, date_mission);

CREATE INDEX idx_mission_status_history_mission_id ON public.mission_status_history (mission_id);
CREATE INDEX idx_mission_status_history_created_at ON public.mission_status_history (created_at);

CREATE INDEX idx_candidatures_mission_id ON public.candidatures (mission_id);
CREATE INDEX idx_candidatures_travailleur_id ON public.candidatures (travailleur_id);
CREATE INDEX idx_candidatures_statut ON public.candidatures (statut);
CREATE INDEX idx_candidatures_mission_statut ON public.candidatures (mission_id, statut);

CREATE INDEX idx_evaluations_mission_id ON public.evaluations (mission_id);
CREATE INDEX idx_evaluations_cible_id ON public.evaluations (cible_id);

CREATE INDEX idx_notifications_utilisateur_id ON public.notifications (utilisateur_id);
CREATE INDEX idx_notifications_statut ON public.notifications (statut);
CREATE INDEX idx_notifications_canal ON public.notifications (canal);
CREATE INDEX idx_notifications_date_envoi ON public.notifications (date_envoi);

CREATE INDEX idx_notification_events_notification_id ON public.notification_events (notification_id);

CREATE INDEX idx_commissions_travailleur_id ON public.commissions (travailleur_id);
CREATE INDEX idx_commissions_mission_id ON public.commissions (mission_id);
CREATE INDEX idx_commissions_created_at ON public.commissions (created_at);

-- ============================================================================
-- SEED: metiers centralisés
-- ============================================================================
INSERT INTO public.metiers (id, code, libelle, categorie, actif, created_at, updated_at)
VALUES
    (gen_random_uuid(), 'MACON', 'Maçon', 'BTP', TRUE, now(), now()),
    (gen_random_uuid(), 'AIDE_MACON', 'Aide maçon', 'BTP', TRUE, now(), now()),
    (gen_random_uuid(), 'COFFREUR', 'Coffreur', 'BTP', TRUE, now(), now()),
    (gen_random_uuid(), 'FERRAILLEUR', 'Ferrailleur', 'BTP', TRUE, now(), now()),
    (gen_random_uuid(), 'CARRELEUR', 'Carreleur', 'BTP', TRUE, now(), now()),
    (gen_random_uuid(), 'PEINTRE_BATIMENT', 'Peintre bâtiment', 'BTP', TRUE, now(), now()),
    (gen_random_uuid(), 'PLOMBIER', 'Plombier', 'BTP', TRUE, now(), now()),
    (gen_random_uuid(), 'ELECTRICIEN_BATIMENT', 'Électricien bâtiment', 'BTP', TRUE, now(), now()),
    (gen_random_uuid(), 'SOUDEUR', 'Soudeur', 'BTP', TRUE, now(), now()),
    (gen_random_uuid(), 'MENUISIER_BOIS', 'Menuisier bois', 'BTP', TRUE, now(), now()),
    (gen_random_uuid(), 'MENUISIER_ALUMINIUM', 'Menuisier aluminium', 'BTP', TRUE, now(), now()),
    (gen_random_uuid(), 'VITRIER', 'Vitrier', 'BTP', TRUE, now(), now()),
    (gen_random_uuid(), 'CHARPENTIER', 'Charpentier', 'BTP', TRUE, now(), now()),
    (gen_random_uuid(), 'CONDUCTEUR_ENGINS', 'Conducteur engins', 'BTP', TRUE, now(), now()),
    (gen_random_uuid(), 'MANOEUVRE_BTP', 'Manœuvre BTP', 'BTP', TRUE, now(), now()),

    (gen_random_uuid(), 'MANUTENTIONNAIRE', 'Manutentionnaire', 'LOGISTIQUE', TRUE, now(), now()),
    (gen_random_uuid(), 'MAGASINIER', 'Magasinier', 'LOGISTIQUE', TRUE, now(), now()),
    (gen_random_uuid(), 'PREPARATEUR_COMMANDES', 'Préparateur de commandes', 'LOGISTIQUE', TRUE, now(), now()),
    (gen_random_uuid(), 'CARISTE', 'Cariste', 'LOGISTIQUE', TRUE, now(), now()),
    (gen_random_uuid(), 'CHARGEUR_DECHARGEUR', 'Chargeur / Déchargeur', 'LOGISTIQUE', TRUE, now(), now()),
    (gen_random_uuid(), 'AGENT_LOGISTIQUE', 'Agent logistique', 'LOGISTIQUE', TRUE, now(), now()),
    (gen_random_uuid(), 'LIVREUR', 'Livreur', 'LOGISTIQUE', TRUE, now(), now()),
    (gen_random_uuid(), 'COURSIER', 'Coursier', 'LOGISTIQUE', TRUE, now(), now()),

    (gen_random_uuid(), 'OUVRIER_AGRICOLE', 'Ouvrier agricole', 'AGRICULTURE', TRUE, now(), now()),
    (gen_random_uuid(), 'CUEILLEUR', 'Cueilleur', 'AGRICULTURE', TRUE, now(), now()),
    (gen_random_uuid(), 'RECOLTEUR', 'Récolteur', 'AGRICULTURE', TRUE, now(), now()),
    (gen_random_uuid(), 'IRRIGATEUR', 'Irrigateur', 'AGRICULTURE', TRUE, now(), now()),
    (gen_random_uuid(), 'JARDINIER', 'Jardinier', 'AGRICULTURE', TRUE, now(), now()),
    (gen_random_uuid(), 'ELEVEUR', 'Éleveur', 'AGRICULTURE', TRUE, now(), now()),

    (gen_random_uuid(), 'AGENT_NETTOYAGE', 'Agent de nettoyage', 'NETTOYAGE', TRUE, now(), now()),
    (gen_random_uuid(), 'AGENT_ENTRETIEN', 'Agent d’entretien', 'NETTOYAGE', TRUE, now(), now()),
    (gen_random_uuid(), 'LAVEUR_VITRES', 'Laveur de vitres', 'NETTOYAGE', TRUE, now(), now()),
    (gen_random_uuid(), 'TECHNICIEN_ASSAINISSEMENT', 'Technicien assainissement', 'NETTOYAGE', TRUE, now(), now()),

    (gen_random_uuid(), 'AGENT_ACCUEIL', 'Agent d’accueil', 'EVENEMENTIEL', TRUE, now(), now()),
    (gen_random_uuid(), 'HOTE_ACCUEIL', 'Hôte d’accueil', 'EVENEMENTIEL', TRUE, now(), now()),
    (gen_random_uuid(), 'HOTESSE_ACCUEIL', 'Hôtesse d’accueil', 'EVENEMENTIEL', TRUE, now(), now()),
    (gen_random_uuid(), 'MONTEUR_STAND', 'Monteur de stand', 'EVENEMENTIEL', TRUE, now(), now()),
    (gen_random_uuid(), 'DEMONTEUR_STAND', 'Démonteur de stand', 'EVENEMENTIEL', TRUE, now(), now()),
    (gen_random_uuid(), 'AGENT_EVENEMENTIEL', 'Agent événementiel', 'EVENEMENTIEL', TRUE, now(), now()),

    (gen_random_uuid(), 'AGENT_SECURITE', 'Agent de sécurité', 'SECURITE', TRUE, now(), now()),
    (gen_random_uuid(), 'AGENT_SURVEILLANCE', 'Agent de surveillance', 'SECURITE', TRUE, now(), now()),
    (gen_random_uuid(), 'CONTROLEUR_ACCES', 'Contrôleur d’accès', 'SECURITE', TRUE, now(), now()),

    (gen_random_uuid(), 'CHAUFFEUR_VL', 'Chauffeur VL', 'TRANSPORT', TRUE, now(), now()),
    (gen_random_uuid(), 'CHAUFFEUR_POIDS_LOURD', 'Chauffeur poids lourd', 'TRANSPORT', TRUE, now(), now()),
    (gen_random_uuid(), 'CHAUFFEUR_LIVRAISON', 'Chauffeur livraison', 'TRANSPORT', TRUE, now(), now()),
    (gen_random_uuid(), 'CONDUCTEUR_TRICYCLE', 'Conducteur tricycle', 'TRANSPORT', TRUE, now(), now()),

    (gen_random_uuid(), 'PROMOTEUR_COMMERCIAL', 'Promoteur commercial', 'COMMERCE', TRUE, now(), now()),
    (gen_random_uuid(), 'MERCHANDISER', 'Merchandiser', 'COMMERCE', TRUE, now(), now()),
    (gen_random_uuid(), 'VENDEUR_TERRAIN', 'Vendeur terrain', 'COMMERCE', TRUE, now(), now()),
    (gen_random_uuid(), 'ANIMATEUR_COMMERCIAL', 'Animateur commercial', 'COMMERCE', TRUE, now(), now()),

    (gen_random_uuid(), 'SERVEUR', 'Serveur', 'RESTAURATION', TRUE, now(), now()),
    (gen_random_uuid(), 'SERVEUSE', 'Serveuse', 'RESTAURATION', TRUE, now(), now()),
    (gen_random_uuid(), 'COMMIS_CUISINE', 'Commis cuisine', 'RESTAURATION', TRUE, now(), now()),
    (gen_random_uuid(), 'CUISINIER', 'Cuisinier', 'RESTAURATION', TRUE, now(), now()),
    (gen_random_uuid(), 'AIDE_CUISINIER', 'Aide cuisinier', 'RESTAURATION', TRUE, now(), now()),
    (gen_random_uuid(), 'PLONGEUR', 'Plongeur', 'RESTAURATION', TRUE, now(), now()),

    (gen_random_uuid(), 'BABYSITTER', 'Babysitter', 'SERVICES', TRUE, now(), now()),
    (gen_random_uuid(), 'GARDIEN', 'Gardien', 'SERVICES', TRUE, now(), now()),
    (gen_random_uuid(), 'DEMENAGEUR', 'Déménageur', 'SERVICES', TRUE, now(), now()),
    (gen_random_uuid(), 'AGENT_POLYVALENT', 'Agent polyvalent', 'SERVICES', TRUE, now(), now()),
    (gen_random_uuid(), 'ASSISTANT_ADMINISTRATIF', 'Assistant administratif', 'SERVICES', TRUE, now(), now());

CREATE OR REPLACE VIEW public.v_active_metiers AS
SELECT
    m.id,
    m.code,
    m.libelle,
    m.categorie,
    m.actif,
    m.created_at,
    m.updated_at
FROM public.metiers AS m
WHERE m.actif = TRUE
ORDER BY m.categorie ASC, m.libelle ASC;

COMMENT ON VIEW public.v_active_metiers IS 'Vue métier active utilisée par les API frontend pour alimenter les listes déroulantes de métiers.';

-- ============================================================================
-- TRIGGERS: updated_at
-- ============================================================================
CREATE TRIGGER trg_profiles_set_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_agents_set_updated_at
BEFORE UPDATE ON public.agents
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_travailleurs_set_updated_at
BEFORE UPDATE ON public.travailleurs
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_recruteurs_set_updated_at
BEFORE UPDATE ON public.recruteurs
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_metiers_set_updated_at
BEFORE UPDATE ON public.metiers
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_profil_metiers_set_updated_at
BEFORE UPDATE ON public.profil_metiers
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_zones_set_updated_at
BEFORE UPDATE ON public.zones
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_travailleur_zones_set_updated_at
BEFORE UPDATE ON public.travailleur_zones
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_disponibilites_set_updated_at
BEFORE UPDATE ON public.disponibilites
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_missions_set_updated_at
BEFORE UPDATE ON public.missions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_notifications_set_updated_at
BEFORE UPDATE ON public.notifications
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_consentements_set_updated_at
BEFORE UPDATE ON public.consentements
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_platform_settings_set_updated_at
BEFORE UPDATE ON public.platform_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_commissions_set_updated_at
BEFORE UPDATE ON public.commissions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- COMMENTS
-- ============================================================================
COMMENT ON TABLE public.profiles IS 'Profils métier (travailleur, recruteur, agent, administrateur). L''identité et le mot de passe restent dans Supabase Auth.';
COMMENT ON COLUMN public.profiles.id IS 'UUID du compte Supabase Auth. Pas de clé étrangère : auth.users vit dans un autre serveur.';
COMMENT ON COLUMN public.profiles.nom IS 'Nom complet du profil utilisateur.';
COMMENT ON COLUMN public.profiles.telephone IS 'Numéro de téléphone principal, unique si renseigné.';
COMMENT ON COLUMN public.profiles.role IS 'Rôle métier principal du profil.';
COMMENT ON COLUMN public.profiles.statut IS 'Statut du compte utilisateur.';
COMMENT ON COLUMN public.profiles.langue IS 'Code langue du profil, par exemple fr, en.';
COMMENT ON COLUMN public.profiles.photo_url IS 'URL publique de la photo de profil.';

COMMENT ON TABLE public.metiers IS 'Référentiel métier centralisé et contrôlé, utilisé comme source unique pour les sélections frontend et les missions.';
COMMENT ON COLUMN public.metiers.code IS 'Code technique unique du métier, utilisé comme identifiant stable dans les listes et API.';
COMMENT ON COLUMN public.metiers.libelle IS 'Libellé métier affiché pour les utilisateurs et les candidats.';
COMMENT ON COLUMN public.metiers.categorie IS 'Catégorie fonctionnelle du métier pour le filtrage et l’affichage.';
COMMENT ON COLUMN public.metiers.actif IS 'Indique si le métier est disponible dans les sélections actives du frontend.';

COMMENT ON TABLE public.missions IS 'Missions de travail publiées par les recruteurs et suivies par leurs candidatures, statut et historique.';
COMMENT ON COLUMN public.missions.recruteur_id IS 'Référence du recruteur au moment de la création de la mission.';
COMMENT ON COLUMN public.missions.metier_id IS 'Métier associé à la mission.';
COMMENT ON COLUMN public.missions.zone_id IS 'Zone géographique ciblée par la mission.';
COMMENT ON COLUMN public.missions.nombre_postes IS 'Nombre de postes à pourvoir.';
COMMENT ON COLUMN public.missions.remuneration_fcfa IS 'Rémunération brute en FCFA pour la mission.';
COMMENT ON COLUMN public.missions.statut IS 'Statut actuel de la mission.';

COMMENT ON TABLE public.candidatures IS 'Candidatures soumises par les travailleurs pour des missions.';
COMMENT ON COLUMN public.candidatures.mission_id IS 'Mission concernée par la candidature.';
COMMENT ON COLUMN public.candidatures.travailleur_id IS 'Travailleur candidat.';
COMMENT ON COLUMN public.candidatures.statut IS 'Statut actuel de la candidature.';

COMMENT ON TABLE public.notifications IS 'Notifications envoyées aux utilisateurs, avec canal, statut et contexte métier.';
COMMENT ON COLUMN public.notifications.utilisateur_id IS 'Utilisateur destinataire de la notification.';
COMMENT ON COLUMN public.notifications.mission_id IS 'Mission associée si la notification est liée à une mission.';
COMMENT ON COLUMN public.notifications.statut IS 'État de traitement de la notification.';
COMMENT ON COLUMN public.notifications.canal IS 'Canal de livraison de la notification.';

COMMENT ON TABLE public.platform_settings IS 'Paramètres globaux de configuration applicative et de règles métier.';
COMMENT ON COLUMN public.platform_settings.setting_key IS 'Clé unique du paramètre.';
COMMENT ON COLUMN public.platform_settings.setting_value IS 'Valeur stockée du paramètre sous forme texte.';

-- ============================================================================
-- DONNEES INITIALES
-- ============================================================================
INSERT INTO public.platform_settings (
    id,
    setting_key,
    setting_value,
    description,
    created_at,
    updated_at
) VALUES
    (gen_random_uuid(), 'COMMISSION_PERCENT', '10', 'Pourcentage appliqué pour calculer la commission.', now(), now()),
    (gen_random_uuid(), 'MISSION_AUTO_CLOSE_DAYS', '7', 'Nombre de jours avant fermeture automatique d’une mission sans action.', now(), now()),
    (gen_random_uuid(), 'MISSION_EXPIRATION_DAYS', '30', 'Nombre de jours avant expiration automatique d’une mission.', now(), now()),
    (gen_random_uuid(), 'MAX_APPLICATIONS_PER_DAY', '20', 'Nombre maximal de candidatures autorisées par travailleur et par jour.', now(), now());

COMMIT;
