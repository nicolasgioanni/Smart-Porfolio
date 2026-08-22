CREATE TABLE IF NOT EXISTS contact_rate_reservations (
  submission_id TEXT PRIMARY KEY NOT NULL,
  email_hash TEXT NOT NULL,
  reserved_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_contact_rate_reservations_email_expiry
  ON contact_rate_reservations (email_hash, expires_at);

CREATE INDEX IF NOT EXISTS idx_contact_rate_reservations_expiry
  ON contact_rate_reservations (expires_at);
