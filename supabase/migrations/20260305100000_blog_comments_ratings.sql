BEGIN;

CREATE TABLE IF NOT EXISTS public.blog_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id text NOT NULL REFERENCES public.blog_posts(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  admin_note text NOT NULL DEFAULT '',
  reviewed_by text,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS blog_comments_post_status_idx
  ON public.blog_comments (post_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS blog_comments_customer_idx
  ON public.blog_comments (customer_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.blog_ratings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id text NOT NULL REFERENCES public.blog_posts(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rating smallint NOT NULL CHECK (rating BETWEEN 1 AND 5),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT blog_ratings_post_customer_unique UNIQUE (post_id, customer_id)
);

CREATE INDEX IF NOT EXISTS blog_ratings_post_idx
  ON public.blog_ratings (post_id, created_at DESC);

ALTER TABLE public.blog_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blog_ratings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "blog_comments_select_policy" ON public.blog_comments;
CREATE POLICY "blog_comments_select_policy"
  ON public.blog_comments
  FOR SELECT
  TO authenticated, anon
  USING (
    status = 'approved'
    OR (
      auth.role() = 'authenticated'
      AND auth.uid() = customer_id
    )
  );

DROP POLICY IF EXISTS "blog_comments_insert_policy" ON public.blog_comments;
CREATE POLICY "blog_comments_insert_policy"
  ON public.blog_comments
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = customer_id
    AND char_length(trim(content)) BETWEEN 5 AND 2000
  );

DROP POLICY IF EXISTS "blog_comments_no_update_policy" ON public.blog_comments;
CREATE POLICY "blog_comments_no_update_policy"
  ON public.blog_comments
  FOR UPDATE
  TO authenticated, anon
  USING (false)
  WITH CHECK (false);

DROP POLICY IF EXISTS "blog_comments_no_delete_policy" ON public.blog_comments;
CREATE POLICY "blog_comments_no_delete_policy"
  ON public.blog_comments
  FOR DELETE
  TO authenticated, anon
  USING (false);

DROP POLICY IF EXISTS "blog_ratings_select_policy" ON public.blog_ratings;
CREATE POLICY "blog_ratings_select_policy"
  ON public.blog_ratings
  FOR SELECT
  TO authenticated, anon
  USING (true);

DROP POLICY IF EXISTS "blog_ratings_insert_policy" ON public.blog_ratings;
CREATE POLICY "blog_ratings_insert_policy"
  ON public.blog_ratings
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = customer_id
    AND rating BETWEEN 1 AND 5
  );

DROP POLICY IF EXISTS "blog_ratings_update_policy" ON public.blog_ratings;
CREATE POLICY "blog_ratings_update_policy"
  ON public.blog_ratings
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = customer_id)
  WITH CHECK (auth.uid() = customer_id AND rating BETWEEN 1 AND 5);

DROP POLICY IF EXISTS "blog_ratings_no_delete_policy" ON public.blog_ratings;
CREATE POLICY "blog_ratings_no_delete_policy"
  ON public.blog_ratings
  FOR DELETE
  TO authenticated, anon
  USING (false);

COMMIT;
