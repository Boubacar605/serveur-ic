-- Domain invariants that Prisma's schema language cannot express.
-- Constraints are dropped first so the migration can also be applied to a
-- database initialized from the legacy SQL file, which declares some of them.

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS chk_profiles_nom_not_blank,
  DROP CONSTRAINT IF EXISTS chk_profiles_langue_not_blank,
  ADD CONSTRAINT chk_profiles_nom_not_blank CHECK (btrim(nom) <> ''),
  ADD CONSTRAINT chk_profiles_langue_not_blank CHECK (btrim(langue) <> '');

ALTER TABLE public.travailleurs
  DROP CONSTRAINT IF EXISTS chk_travailleurs_score_fiabilite_range,
  ADD CONSTRAINT chk_travailleurs_score_fiabilite_range
  CHECK (score_fiabilite IS NULL OR (score_fiabilite BETWEEN 0 AND 100));

ALTER TABLE public.profil_metiers
  DROP CONSTRAINT IF EXISTS chk_profil_metiers_experience_annees,
  ADD CONSTRAINT chk_profil_metiers_experience_annees CHECK (experience_annees >= 0);

ALTER TABLE public.disponibilites
  DROP CONSTRAINT IF EXISTS chk_disponibilites_heure_fin,
  ADD CONSTRAINT chk_disponibilites_heure_fin
  CHECK ((heure_debut IS NULL) OR (heure_fin IS NULL) OR (heure_fin > heure_debut));

ALTER TABLE public.missions
  DROP CONSTRAINT IF EXISTS chk_missions_nombre_postes,
  DROP CONSTRAINT IF EXISTS chk_missions_remuneration_fcfa,
  DROP CONSTRAINT IF EXISTS chk_missions_heure_fin,
  ADD CONSTRAINT chk_missions_nombre_postes CHECK (nombre_postes > 0),
  ADD CONSTRAINT chk_missions_remuneration_fcfa CHECK (remuneration_fcfa > 0),
  ADD CONSTRAINT chk_missions_heure_fin
  CHECK ((heure_debut IS NULL) OR (heure_fin IS NULL) OR (heure_fin > heure_debut));

ALTER TABLE public.evaluations
  DROP CONSTRAINT IF EXISTS chk_evaluations_note,
  DROP CONSTRAINT IF EXISTS chk_evaluations_auteur_diff_cible,
  ADD CONSTRAINT chk_evaluations_note CHECK (note BETWEEN 1 AND 5),
  ADD CONSTRAINT chk_evaluations_auteur_diff_cible CHECK (auteur_id <> cible_id);

ALTER TABLE public.commissions
  DROP CONSTRAINT IF EXISTS chk_commissions_pourcentage,
  DROP CONSTRAINT IF EXISTS chk_commissions_montants_non_negatifs,
  ADD CONSTRAINT chk_commissions_pourcentage CHECK (pourcentage BETWEEN 0 AND 100),
  ADD CONSTRAINT chk_commissions_montants_non_negatifs
  CHECK (montant_brut >= 0 AND montant_commission >= 0 AND montant_net >= 0);
