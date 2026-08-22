CREATE OR REPLACE FUNCTION geoacademic_scope_text_matches(p_title text, p_data jsonb)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT lower(concat_ws(' ', coalesce(p_title, ''), coalesce(p_data::text, ''))) ~
    '(photogramm|remote[ -]?sensing|earth observation|geoinformat|geospatial|geomatics|geodes|geographic information|(^|[^a-z])gis([^a-z]|$)|spatial (data|analysis|science|information)|cartograph|surveying|satellite|lidar|laser scanning|point cloud|(^|[^a-z])sar([^a-z]|$)|insar|(^|[^a-z])gnss([^a-z]|$)|(^|[^a-z])gps([^a-z]|$)|uav|drone|3d reconstruction|computer vision|geoai|citygml|geobim|digital twin|hyperspectral|multispectral)';
$$;

CREATE OR REPLACE FUNCTION geoacademic_apply_scope_guard()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  in_scope boolean;
BEGIN
  IF NEW.entity_type = 'opportunity'
     AND coalesce(NEW.source_url, '') ~* '^https?://(www[.])?egu[.]eu/g/jobs/?'
     AND NEW.verification_status <> 'verified' THEN
    in_scope := geoacademic_scope_text_matches(NEW.title, NEW.data);
    IF NOT in_scope THEN
      NEW.verification_status := 'needs_review';
      NEW.confidence := least(coalesce(NEW.confidence, 0.5), 0.69);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS canonical_entities_scope_guard ON canonical_entities;
CREATE TRIGGER canonical_entities_scope_guard
BEFORE INSERT OR UPDATE
ON canonical_entities
FOR EACH ROW
EXECUTE FUNCTION geoacademic_apply_scope_guard();

-- Re-evaluate current broad-source opportunities. The trigger performs the
-- actual classification so this migration and future writes use one policy.
UPDATE canonical_entities
SET updated_at = now()
WHERE entity_type = 'opportunity'
  AND coalesce(source_url, '') ~* '^https?://(www[.])?egu[.]eu/g/jobs/?'
  AND verification_status <> 'verified';

CREATE OR REPLACE FUNCTION geoacademic_sync_child_verification()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  parent_status text;
  parent_confidence real;
BEGIN
  IF NEW.entity_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT verification_status, confidence
  INTO parent_status, parent_confidence
  FROM canonical_entities
  WHERE id = NEW.entity_id;

  IF parent_status = 'needs_review' THEN
    NEW.verification_status := 'needs_review';
    NEW.confidence := least(coalesce(NEW.confidence, parent_confidence, 0.5), 0.69);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS record_sources_scope_sync ON record_sources;
CREATE TRIGGER record_sources_scope_sync
BEFORE INSERT OR UPDATE
ON record_sources
FOR EACH ROW
EXECUTE FUNCTION geoacademic_sync_child_verification();

DROP TRIGGER IF EXISTS signals_scope_sync ON signals;
CREATE TRIGGER signals_scope_sync
BEFORE INSERT OR UPDATE
ON signals
FOR EACH ROW
EXECUTE FUNCTION geoacademic_sync_child_verification();

UPDATE record_sources rs
SET verification_status = 'needs_review',
    confidence = least(rs.confidence, 0.69)
FROM canonical_entities e
WHERE rs.entity_id = e.id
  AND e.entity_type = 'opportunity'
  AND e.verification_status = 'needs_review'
  AND coalesce(e.source_url, '') ~* '^https?://(www[.])?egu[.]eu/g/jobs/?';

UPDATE signals s
SET verification_status = 'needs_review',
    confidence = least(s.confidence, 0.69)
FROM canonical_entities e
WHERE s.entity_id = e.id
  AND e.entity_type = 'opportunity'
  AND e.verification_status = 'needs_review'
  AND coalesce(e.source_url, '') ~* '^https?://(www[.])?egu[.]eu/g/jobs/?';
