-- Retry rows bind an opaque renderer/configuration identity. Existing rows stay
-- NULL and fail closed: a later deployment must not rerender an uncertain send
-- with changed mail settings or an unknown template.
ALTER TABLE contact_rate_reservations
  ADD COLUMN delivery_config_hash TEXT;

ALTER TABLE contact_rate_reservations
  ADD COLUMN render_version INTEGER;
