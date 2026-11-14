-- Référentiel de zones pour le marché sénégalais (marché de lancement).
-- Idempotent : n'insère que les zones absentes et ne supprime aucune zone existante.

INSERT INTO public.zones (id, nom, niveau, parent_id, created_at, updated_at)
SELECT gen_random_uuid(), v.nom, 'REGION'::"niveau_zone_enum", NULL, now(), now()
FROM (VALUES
    ('Dakar'),
    ('Thiès'),
    ('Diourbel'),
    ('Fatick'),
    ('Kaolack'),
    ('Kaffrine'),
    ('Louga'),
    ('Saint-Louis'),
    ('Matam'),
    ('Tambacounda'),
    ('Kédougou'),
    ('Kolda'),
    ('Sédhiou'),
    ('Ziguinchor')
) AS v(nom)
WHERE NOT EXISTS (
    SELECT 1 FROM public.zones z
    WHERE z.nom = v.nom AND z.deleted_at IS NULL
);

-- Communes et villes rattachées à leur région. Le niveau DEPARTEMENT reste
-- disponible pour un découpage plus fin géré depuis le back-office.
INSERT INTO public.zones (id, nom, niveau, parent_id, created_at, updated_at)
SELECT gen_random_uuid(), v.nom, 'COMMUNE'::"niveau_zone_enum", r.id, now(), now()
FROM (VALUES
    ('Dakar', 'Plateau'),
    ('Dakar', 'Médina'),
    ('Dakar', 'Fann-Point E-Amitié'),
    ('Dakar', 'Mermoz-Sacré-Cœur'),
    ('Dakar', 'Ouakam'),
    ('Dakar', 'Yoff'),
    ('Dakar', 'Ngor'),
    ('Dakar', 'Grand-Yoff'),
    ('Dakar', 'Parcelles Assainies'),
    ('Dakar', 'Grand-Dakar'),
    ('Dakar', 'HLM'),
    ('Dakar', 'Hann-Bel-Air'),
    ('Dakar', 'Dalifort'),
    ('Dakar', 'Cambérène'),
    ('Dakar', 'Patte d''Oie'),
    ('Dakar', 'Dieuppeul-Derklé'),
    ('Dakar', 'Biscuiterie'),
    ('Dakar', 'Pikine'),
    ('Dakar', 'Guédiawaye'),
    ('Dakar', 'Rufisque'),
    ('Dakar', 'Bargny'),
    ('Dakar', 'Diamniadio'),
    ('Dakar', 'Sébikotane'),
    ('Dakar', 'Keur Massar'),
    ('Dakar', 'Malika'),
    ('Dakar', 'Yeumbeul'),
    ('Thiès', 'Thiès'),
    ('Thiès', 'Mbour'),
    ('Thiès', 'Tivaouane'),
    ('Thiès', 'Joal-Fadiouth'),
    ('Thiès', 'Khombole'),
    ('Diourbel', 'Diourbel'),
    ('Diourbel', 'Touba'),
    ('Diourbel', 'Mbacké'),
    ('Diourbel', 'Bambey'),
    ('Fatick', 'Fatick'),
    ('Fatick', 'Gossas'),
    ('Fatick', 'Sokone'),
    ('Fatick', 'Passy'),
    ('Kaolack', 'Kaolack'),
    ('Kaolack', 'Nioro du Rip'),
    ('Kaolack', 'Guinguinéo'),
    ('Kaffrine', 'Kaffrine'),
    ('Kaffrine', 'Birkelane'),
    ('Kaffrine', 'Koungheul'),
    ('Kaffrine', 'Malem Hodar'),
    ('Louga', 'Louga'),
    ('Louga', 'Linguère'),
    ('Louga', 'Kébémer'),
    ('Saint-Louis', 'Saint-Louis'),
    ('Saint-Louis', 'Richard-Toll'),
    ('Saint-Louis', 'Dagana'),
    ('Saint-Louis', 'Podor'),
    ('Matam', 'Matam'),
    ('Matam', 'Ourossogui'),
    ('Matam', 'Thilogne'),
    ('Matam', 'Kanel'),
    ('Tambacounda', 'Tambacounda'),
    ('Tambacounda', 'Bakel'),
    ('Tambacounda', 'Goudiry'),
    ('Tambacounda', 'Koumpentoum'),
    ('Kédougou', 'Kédougou'),
    ('Kédougou', 'Salémata'),
    ('Kédougou', 'Saraya'),
    ('Kolda', 'Kolda'),
    ('Kolda', 'Vélingara'),
    ('Kolda', 'Médina Yoro Foulah'),
    ('Sédhiou', 'Sédhiou'),
    ('Sédhiou', 'Bounkiling'),
    ('Sédhiou', 'Goudomp'),
    ('Ziguinchor', 'Ziguinchor'),
    ('Ziguinchor', 'Bignona'),
    ('Ziguinchor', 'Oussouye')
) AS v(region, nom)
JOIN LATERAL (
    SELECT r.id
    FROM public.zones r
    WHERE r.nom = v.region
      AND r.niveau = 'REGION'
      AND r.parent_id IS NULL
      AND r.deleted_at IS NULL
    ORDER BY r.created_at
    LIMIT 1
) r ON TRUE
WHERE NOT EXISTS (
    SELECT 1 FROM public.zones z
    WHERE z.nom = v.nom AND z.deleted_at IS NULL
);
