-- Existing reservations remain NULL so the application can fail closed instead of
-- treating an unbound legacy submission as a safe retry.
ALTER TABLE contact_rate_reservations
  ADD COLUMN payload_hash TEXT;
