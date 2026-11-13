-- Reference data: centralized metiers, platform settings, updated_at triggers, active metiers view.

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Idempotent so that a database initialized from the legacy SQL file (which
-- already created these triggers) can be baselined and migrated safely.
DO $$
DECLARE
  target text;
BEGIN
  FOREACH target IN ARRAY ARRAY[
    'profiles',
    'agents',
    'travailleurs',
    'recruteurs',
    'metiers',
    'profil_metiers',
    'zones',
    'travailleur_zones',
    'disponibilites',
    'missions',
    'notifications',
    'notification_events',
    'consentements',
    'commissions',
    'platform_settings'
  ] LOOP
    IF NOT EXISTS (
      SELECT 1
      FROM pg_trigger
      WHERE tgname = 'trg_' || target || '_set_updated_at'
        AND tgrelid = format('public.%I', target)::regclass
    ) THEN
      EXECUTE format(
        'CREATE TRIGGER %I BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column()',
        'trg_' || target || '_set_updated_at',
        target
      );
    END IF;
  END LOOP;
END;
$$;

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
    (gen_random_uuid(), 'ASSISTANT_ADMINISTRATIF', 'Assistant administratif', 'SERVICES', TRUE, now(), now())
ON CONFLICT (code) DO NOTHING;

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

INSERT INTO public.platform_settings (id, setting_key, setting_value, description, created_at, updated_at)
VALUES
    (gen_random_uuid(), 'COMMISSION_PERCENT', '10', 'Pourcentage appliqué pour calculer la commission.', now(), now()),
    (gen_random_uuid(), 'MISSION_AUTO_CLOSE_DAYS', '7', 'Nombre de jours avant fermeture automatique d’une mission sans action.', now(), now()),
    (gen_random_uuid(), 'MISSION_EXPIRATION_DAYS', '30', 'Nombre de jours avant expiration automatique d’une mission.', now(), now()),
    (gen_random_uuid(), 'MAX_APPLICATIONS_PER_DAY', '20', 'Nombre maximal de candidatures autorisées par travailleur et par jour.', now(), now()),
    (gen_random_uuid(), 'MAX_COMMISSION_DEBT', '5000', 'Montant maximal de commission impayée avant restriction du compte travailleur.', now(), now())
ON CONFLICT (setting_key) DO NOTHING;
