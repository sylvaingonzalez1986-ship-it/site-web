ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS tracking_number TEXT;
