-- Expose a trustworthy modification date for product pages and sitemaps.
-- Unchanged bulk upserts (for example a footer-only CMS save) must not refresh it.
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

CREATE OR REPLACE FUNCTION public.touch_product_public_content_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF (to_jsonb(OLD) - ARRAY['created_at', 'updated_at', 'position'])
     IS DISTINCT FROM
     (to_jsonb(NEW) - ARRAY['created_at', 'updated_at', 'position']) THEN
    NEW.updated_at := now();
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_touch_product_public_content_updated_at ON public.products;
CREATE TRIGGER trg_touch_product_public_content_updated_at
BEFORE UPDATE ON public.products
FOR EACH ROW
EXECUTE FUNCTION public.touch_product_public_content_updated_at();
