BEGIN;

CREATE TABLE IF NOT EXISTS public.printful_sync_products (
  sync_product_id BIGINT PRIMARY KEY,
  external_id TEXT,
  name TEXT NOT NULL,
  thumbnail_url TEXT NOT NULL DEFAULT '',
  is_ignored BOOLEAN NOT NULL DEFAULT FALSE,
  synced BOOLEAN NOT NULL DEFAULT TRUE,
  raw JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.printful_sync_variants (
  sync_variant_id BIGINT PRIMARY KEY,
  sync_product_id BIGINT NOT NULL REFERENCES public.printful_sync_products(sync_product_id) ON DELETE CASCADE,
  external_id TEXT,
  name TEXT NOT NULL,
  sku TEXT,
  retail_price NUMERIC(10, 2) NOT NULL DEFAULT 0 CHECK (retail_price >= 0),
  currency TEXT NOT NULL DEFAULT 'EUR',
  is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  is_in_stock BOOLEAN NOT NULL DEFAULT TRUE,
  image_url TEXT NOT NULL DEFAULT '',
  raw JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.printful_sync_state (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  last_sync_at TIMESTAMPTZ,
  last_sync_status TEXT NOT NULL DEFAULT 'idle'
    CHECK (last_sync_status IN ('idle', 'running', 'success', 'error')),
  last_sync_message TEXT NOT NULL DEFAULT '',
  updated_by TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO public.printful_sync_state (id, last_sync_status, last_sync_message)
VALUES (1, 'idle', '')
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.printful_sync_runs (
  id BIGSERIAL PRIMARY KEY,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ,
  success BOOLEAN,
  products_count INTEGER NOT NULL DEFAULT 0,
  variants_count INTEGER NOT NULL DEFAULT 0,
  error_message TEXT,
  triggered_by TEXT
);

CREATE INDEX IF NOT EXISTS idx_printful_sync_variants_product
  ON public.printful_sync_variants(sync_product_id);
CREATE INDEX IF NOT EXISTS idx_printful_sync_variants_enabled_stock
  ON public.printful_sync_variants(is_enabled, is_in_stock);
CREATE INDEX IF NOT EXISTS idx_printful_sync_runs_started_at
  ON public.printful_sync_runs(started_at DESC);

ALTER TABLE public.printful_sync_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.printful_sync_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.printful_sync_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.printful_sync_runs ENABLE ROW LEVEL SECURITY;

COMMIT;
