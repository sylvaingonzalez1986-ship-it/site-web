-- Newsletter subscribers table for "Me prevenir" captures

BEGIN;
CREATE TABLE IF NOT EXISTS newsletter_subscribers (
  id BIGSERIAL PRIMARY KEY,
  email TEXT NOT NULL,
  email_normalized TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'unsubscribed')),
  source TEXT NOT NULL DEFAULT 'application',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_contacted_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_newsletter_subscribers_status
ON newsletter_subscribers(status);
CREATE INDEX IF NOT EXISTS idx_newsletter_subscribers_created_at
ON newsletter_subscribers(created_at DESC);
ALTER TABLE newsletter_subscribers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS newsletter_subscribers_no_client_access ON newsletter_subscribers;
CREATE POLICY newsletter_subscribers_no_client_access
ON newsletter_subscribers
FOR ALL
TO anon, authenticated
USING (false)
WITH CHECK (false);
COMMIT;
