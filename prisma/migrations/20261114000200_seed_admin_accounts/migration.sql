-- Comptes administrateur initiaux.
-- ⚠️  Mot de passe commun : Admin12345 — à changer dès la première connexion.
-- Migration idempotente : si un compte existe déjà (même e-mail), il est réutilisé,
-- son mot de passe est réinitialisé et son profil est promu ADMINISTRATEUR.
-- Le schéma `auth` est fourni par Supabase ; sur une base sans Supabase Auth,
-- la migration ne fait rien (les profils seuls seraient inutilisables).

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
DECLARE
  admin record;
  uid uuid;
  crypto_schema text;
BEGIN
  IF to_regclass('auth.users') IS NULL THEN
    RAISE NOTICE 'Schéma auth de Supabase absent : création des comptes administrateur ignorée.';
    RETURN;
  END IF;

  SELECT n.nspname
    INTO crypto_schema
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE p.proname = 'crypt'
     AND pg_get_function_identity_arguments(p.oid) = 'text, text'
   ORDER BY (n.nspname = 'extensions') DESC
   LIMIT 1;

  IF crypto_schema IS NULL THEN
    RAISE EXCEPTION 'pgcrypto est requis pour hacher les mots de passe administrateur.';
  END IF;

  FOR admin IN
    SELECT *
      FROM (VALUES
        ('malickadmin@gmail.com',      'Malick',       'a1b2c3d4-0000-4000-8000-000000000001'::uuid),
        ('boubacaradmin@gmail.com',    'Boubacar',     'a1b2c3d4-0000-4000-8000-000000000002'::uuid),
        ('ibrahimaadmin@gmail.com',    'Ibrahima',     'a1b2c3d4-0000-4000-8000-000000000003'::uuid),
        ('mariamacireadmin@gmail.com', 'Mariama Cire', 'a1b2c3d4-0000-4000-8000-000000000004'::uuid),
        ('seyniadmin@gmail.com',       'Seyni',        'a1b2c3d4-0000-4000-8000-000000000005'::uuid)
      ) AS t(email, nom, id)
  LOOP
    SELECT id INTO uid FROM auth.users WHERE lower(email) = admin.email LIMIT 1;

    IF uid IS NULL THEN
      uid := admin.id;
      EXECUTE format($sql$
        INSERT INTO auth.users (
          instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
          raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
          confirmation_token, email_change, email_change_token_new, recovery_token
        ) VALUES (
          '00000000-0000-0000-0000-000000000000', $1, 'authenticated', 'authenticated', $2,
          %1$I.crypt('Admin12345', %1$I.gen_salt('bf', 10)), now(),
          '{"provider":"email","providers":["email"]}'::jsonb,
          jsonb_build_object('nom', $3),
          now(), now(), '', '', '', ''
        )
      $sql$, crypto_schema) USING uid, admin.email, admin.nom;
    ELSE
      EXECUTE format($sql$
        UPDATE auth.users
           SET encrypted_password = %1$I.crypt('Admin12345', %1$I.gen_salt('bf', 10)),
               email_confirmed_at = COALESCE(email_confirmed_at, now()),
               updated_at = now()
         WHERE id = $1
      $sql$, crypto_schema) USING uid;
    END IF;

    INSERT INTO auth.identities (id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at)
    VALUES (
      gen_random_uuid(), uid, uid::text, 'email',
      jsonb_build_object('sub', uid::text, 'email', admin.email, 'email_verified', true),
      now(), now(), now()
    )
    ON CONFLICT (provider_id, provider) DO NOTHING;

    INSERT INTO public.profiles (id, nom, telephone, role, statut, langue, created_at, updated_at)
    VALUES (uid, admin.nom, NULL, 'ADMINISTRATEUR', 'ACTIF', 'fr', now(), now())
    ON CONFLICT (id) DO UPDATE
       SET nom = EXCLUDED.nom,
           role = 'ADMINISTRATEUR',
           statut = 'ACTIF',
           langue = 'fr',
           deleted_at = NULL,
           updated_at = now();
  END LOOP;
END
$$;
