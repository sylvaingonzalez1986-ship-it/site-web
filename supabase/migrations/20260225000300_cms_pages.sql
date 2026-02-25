BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.cms_pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  sections JSONB NOT NULL DEFAULT '[]'::jsonb,
  seo_title TEXT,
  seo_description TEXT,
  show_in_nav BOOLEAN NOT NULL DEFAULT false,
  show_in_footer BOOLEAN NOT NULL DEFAULT false,
  nav_label TEXT NOT NULL DEFAULT '',
  footer_label TEXT NOT NULL DEFAULT '',
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT cms_pages_slug_format CHECK (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$')
);

CREATE INDEX IF NOT EXISTS idx_cms_pages_status_position
ON public.cms_pages (status, position, created_at DESC);

ALTER TABLE public.cms_pages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS cms_pages_anon_read_published ON public.cms_pages;
CREATE POLICY cms_pages_anon_read_published
ON public.cms_pages
FOR SELECT
TO anon, authenticated
USING (status = 'published');

COMMIT;
