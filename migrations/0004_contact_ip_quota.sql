-- Pre-existing reservations retain an unknown IP while still counting globally.
ALTER TABLE contact_rate_reservations ADD COLUMN ip_hash TEXT;
CREATE INDEX IF NOT EXISTS idx_contact_rate_reservations_ip_time
  ON contact_rate_reservations (ip_hash, reserved_at);
