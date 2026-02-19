-- Supabase initial schema (Phase 1)
-- Deny-by-default RLS model. Service role is used for privileged writes.

BEGIN;

-- === ENUM TYPES ===
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'product_category') THEN
    CREATE TYPE product_category AS ENUM ('fleurs', 'huiles', 'cosmetiques', 'alimentaire', 'accessoires');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'blog_category') THEN
    CREATE TYPE blog_category AS ENUM ('guide', 'actualite', 'bien-etre', 'legislation');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'order_status') THEN
    CREATE TYPE order_status AS ENUM ('new', 'pending_payment', 'paid', 'processing', 'shipped', 'cancelled');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_state') THEN
    CREATE TYPE payment_state AS ENUM ('pending', 'paid', 'failed', 'not_configured');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'section_style') THEN
    CREATE TYPE section_style AS ENUM ('mint', 'yellow', 'cream');
  END IF;
END
$$;

-- === PRODUCERS ===
CREATE TABLE IF NOT EXISTS producers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  image TEXT NOT NULL DEFAULT '',
  location TEXT NOT NULL DEFAULT '',
  department TEXT NOT NULL DEFAULT '',
  region TEXT NOT NULL DEFAULT '',
  website TEXT NOT NULL DEFAULT '',
  position INTEGER NOT NULL DEFAULT 0
);

-- === PRODUCTS ===
CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category product_category NOT NULL,
  price NUMERIC(10, 2) NOT NULL CHECK (price >= 0),
  vat_rate NUMERIC(4, 2) NOT NULL DEFAULT 20 CHECK (vat_rate IN (5.5, 20)),
  original_price NUMERIC(10, 2) CHECK (original_price IS NULL OR original_price > 0),
  promo_percent INTEGER CHECK (promo_percent IS NULL OR (promo_percent BETWEEN 1 AND 99)),
  is_pack BOOLEAN NOT NULL DEFAULT FALSE,
  image TEXT NOT NULL DEFAULT '',
  images JSONB NOT NULL DEFAULT '[]',
  producer_id TEXT REFERENCES producers(id) ON DELETE SET NULL,
  description TEXT NOT NULL DEFAULT '',
  badge TEXT,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- === PACK COMPONENTS ===
CREATE TABLE IF NOT EXISTS pack_components (
  pack_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  qty INTEGER NOT NULL DEFAULT 1 CHECK (qty > 0),
  PRIMARY KEY (pack_id, product_id)
);

CREATE OR REPLACE FUNCTION validate_pack_component_integrity()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  pack_is_pack BOOLEAN;
  component_is_pack BOOLEAN;
BEGIN
  IF NEW.pack_id = NEW.product_id THEN
    RAISE EXCEPTION 'pack_components: pack_id and product_id cannot be identical';
  END IF;

  SELECT is_pack INTO pack_is_pack FROM products WHERE id = NEW.pack_id;
  IF COALESCE(pack_is_pack, FALSE) = FALSE THEN
    RAISE EXCEPTION 'pack_components: pack_id % must reference a product with is_pack=true', NEW.pack_id;
  END IF;

  SELECT is_pack INTO component_is_pack FROM products WHERE id = NEW.product_id;
  IF COALESCE(component_is_pack, FALSE) = TRUE THEN
    RAISE EXCEPTION 'pack_components: product_id % cannot reference another pack', NEW.product_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_pack_component_integrity ON pack_components;
CREATE TRIGGER trg_validate_pack_component_integrity
BEFORE INSERT OR UPDATE ON pack_components
FOR EACH ROW
EXECUTE FUNCTION validate_pack_component_integrity();

-- === BLOG ===
CREATE TABLE IF NOT EXISTS blog_posts (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  excerpt TEXT NOT NULL DEFAULT '',
  content TEXT NOT NULL DEFAULT '',
  cover_image TEXT NOT NULL DEFAULT '',
  category blog_category NOT NULL DEFAULT 'guide',
  published BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- === CMS CONTENT (single row) ===
CREATE TABLE IF NOT EXISTS site_content (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  home JSONB NOT NULL DEFAULT '{}',
  boutique JSONB NOT NULL DEFAULT '{}',
  application JSONB NOT NULL DEFAULT '{}',
  blog JSONB NOT NULL DEFAULT '{}',
  footer JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO site_content (id) VALUES (1)
ON CONFLICT (id) DO NOTHING;

-- === PAGE SECTIONS (single row) ===
CREATE TABLE IF NOT EXISTS page_sections (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  home JSONB NOT NULL DEFAULT '[]',
  boutique JSONB NOT NULL DEFAULT '[]',
  application JSONB NOT NULL DEFAULT '[]',
  blog JSONB NOT NULL DEFAULT '[]'
);

INSERT INTO page_sections (id) VALUES (1)
ON CONFLICT (id) DO NOTHING;

-- === ORDERS ===
CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  status order_status NOT NULL DEFAULT 'new',
  payment_provider TEXT NOT NULL DEFAULT 'viva',
  payment_state payment_state NOT NULL DEFAULT 'pending',
  viva_order_code BIGINT UNIQUE,
  viva_transaction_id TEXT,
  customer_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  customer_email TEXT,
  customer_name TEXT,
  shipping_address TEXT,
  shipping_city TEXT,
  shipping_postal_code TEXT,
  shipping_country TEXT,
  shipping_phone TEXT,
  promo_code TEXT,
  discount_percent NUMERIC(5, 2),
  discount_amount NUMERIC(10, 2),
  items_count INTEGER NOT NULL DEFAULT 0,
  total_ht NUMERIC(10, 2),
  total_vat NUMERIC(10, 2),
  vat_breakdown JSONB DEFAULT '[]',
  total_amount NUMERIC(10, 2) NOT NULL DEFAULT 0
);

-- === ORDER ITEMS ===
CREATE TABLE IF NOT EXISTS order_items (
  id BIGSERIAL PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL,
  name TEXT NOT NULL,
  unit_price NUMERIC(10, 2) NOT NULL,
  unit_price_ht NUMERIC(10, 2),
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  line_total NUMERIC(10, 2) NOT NULL,
  line_total_ht NUMERIC(10, 2),
  line_vat_amount NUMERIC(10, 2),
  vat_rate NUMERIC(4, 2) DEFAULT 20,
  parent_pack_id TEXT,
  parent_pack_name TEXT
);

-- === PROFILES ===
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  first_name TEXT NOT NULL DEFAULT '',
  last_name TEXT NOT NULL DEFAULT '',
  date_of_birth DATE,
  phone TEXT NOT NULL DEFAULT '',
  address TEXT NOT NULL DEFAULT '',
  city TEXT NOT NULL DEFAULT '',
  postal_code TEXT NOT NULL DEFAULT '',
  country TEXT NOT NULL DEFAULT 'France',
  notes TEXT NOT NULL DEFAULT '',
  loyalty_points INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- === PROMO CODES ===
CREATE TABLE IF NOT EXISTS promo_codes (
  id BIGSERIAL PRIMARY KEY,
  customer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  code TEXT NOT NULL CHECK (code ~ '^[A-Z0-9_-]{4,24}$'),
  discount_percent INTEGER NOT NULL CHECK (discount_percent BETWEEN 1 AND 80),
  used BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  used_at TIMESTAMPTZ,
  UNIQUE (customer_id, code)
);

-- === INVOICE COUNTER (gapless strategy) ===
CREATE TABLE IF NOT EXISTS invoice_counter (
  year INTEGER PRIMARY KEY,
  next_sequence INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS invoices (
  id BIGSERIAL PRIMARY KEY,
  order_id TEXT NOT NULL UNIQUE REFERENCES orders(id),
  invoice_number TEXT NOT NULL UNIQUE,
  sequence INTEGER NOT NULL,
  year INTEGER NOT NULL,
  issued_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- === ASSET REFERENCES ===
CREATE TABLE IF NOT EXISTS asset_refs (
  id BIGSERIAL PRIMARY KEY,
  bucket TEXT NOT NULL,
  path TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (bucket, path)
);

-- === INDEXES ===
CREATE INDEX IF NOT EXISTS idx_orders_customer ON orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_viva_code ON orders(viva_order_code);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_promo_customer ON promo_codes(customer_id);
CREATE INDEX IF NOT EXISTS idx_blog_slug ON blog_posts(slug);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_products_producer ON products(producer_id);
CREATE INDEX IF NOT EXISTS idx_asset_refs_entity ON asset_refs(entity_type, entity_id);

-- === RLS ENABLE ===
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE pack_components ENABLE ROW LEVEL SECURITY;
ALTER TABLE producers ENABLE ROW LEVEL SECURITY;
ALTER TABLE blog_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE site_content ENABLE ROW LEVEL SECURITY;
ALTER TABLE page_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE promo_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_counter ENABLE ROW LEVEL SECURITY;
ALTER TABLE asset_refs ENABLE ROW LEVEL SECURITY;

-- === PUBLIC CATALOG READ ===
DROP POLICY IF EXISTS products_anon_read ON products;
CREATE POLICY products_anon_read ON products FOR SELECT USING (true);

DROP POLICY IF EXISTS pack_components_anon_read ON pack_components;
CREATE POLICY pack_components_anon_read ON pack_components FOR SELECT USING (true);

DROP POLICY IF EXISTS producers_anon_read ON producers;
CREATE POLICY producers_anon_read ON producers FOR SELECT USING (true);

DROP POLICY IF EXISTS blog_posts_anon_read_published ON blog_posts;
CREATE POLICY blog_posts_anon_read_published ON blog_posts FOR SELECT USING (published = true);

DROP POLICY IF EXISTS site_content_anon_read ON site_content;
CREATE POLICY site_content_anon_read ON site_content FOR SELECT USING (true);

DROP POLICY IF EXISTS page_sections_anon_read ON page_sections;
CREATE POLICY page_sections_anon_read ON page_sections FOR SELECT USING (true);

-- === USER-SCOPED READ/WRITE ===
DROP POLICY IF EXISTS profiles_user_read_own ON profiles;
CREATE POLICY profiles_user_read_own ON profiles FOR SELECT USING (id = auth.uid());

DROP POLICY IF EXISTS profiles_user_update_own ON profiles;
CREATE POLICY profiles_user_update_own ON profiles FOR UPDATE USING (id = auth.uid());

DROP POLICY IF EXISTS orders_user_read_own ON orders;
CREATE POLICY orders_user_read_own ON orders FOR SELECT USING (customer_id = auth.uid());

DROP POLICY IF EXISTS order_items_user_read_own ON order_items;
CREATE POLICY order_items_user_read_own ON order_items FOR SELECT
USING (
  order_id IN (
    SELECT id FROM orders WHERE customer_id = auth.uid()
  )
);

DROP POLICY IF EXISTS promo_codes_user_read_own ON promo_codes;
CREATE POLICY promo_codes_user_read_own ON promo_codes FOR SELECT USING (customer_id = auth.uid());

COMMIT;

