CREATE OR REPLACE FUNCTION geoacademic_entity_slug(p_title text, p_external_key text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT
    CASE
      WHEN base = '' THEN 'item-' || suffix
      ELSE base || '-' || suffix
    END
  FROM (
    SELECT
      left(
        trim(both '-' from lower(regexp_replace(coalesce(p_title, ''), '[^A-Za-z0-9]+', '-', 'g'))),
        72
      ) AS base,
      left(coalesce(nullif(p_external_key, ''), md5(coalesce(p_title, 'item'))), 10) AS suffix
  ) parts;
$$;

CREATE OR REPLACE FUNCTION geoacademic_assign_entity_slug()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.slug IS NULL OR btrim(NEW.slug) = '' THEN
    NEW.slug := geoacademic_entity_slug(NEW.title, NEW.external_key);
  END IF;
  RETURN NEW;
END;
$$;

UPDATE canonical_entities
SET slug = geoacademic_entity_slug(title, external_key),
    updated_at = now()
WHERE slug IS NULL OR btrim(slug) = '';

DROP TRIGGER IF EXISTS canonical_entities_assign_slug ON canonical_entities;
CREATE TRIGGER canonical_entities_assign_slug
BEFORE INSERT OR UPDATE OF title, external_key, slug
ON canonical_entities
FOR EACH ROW
EXECUTE FUNCTION geoacademic_assign_entity_slug();
