-- Create blog posts table
CREATE TABLE IF NOT EXISTS public.blog_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  caption TEXT,
  image_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.blog_posts ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'blog_posts' AND policyname = 'Anyone can view blog posts'
  ) THEN
    CREATE POLICY "Anyone can view blog posts"
    ON public.blog_posts
    FOR SELECT
    USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'blog_posts' AND policyname = 'Authenticated users can create blog posts'
  ) THEN
    CREATE POLICY "Authenticated users can create blog posts"
    ON public.blog_posts
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'blog_posts' AND policyname = 'Users can update their own blog posts'
  ) THEN
    CREATE POLICY "Users can update their own blog posts"
    ON public.blog_posts
    FOR UPDATE
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'blog_posts' AND policyname = 'Users can delete their own blog posts'
  ) THEN
    CREATE POLICY "Users can delete their own blog posts"
    ON public.blog_posts
    FOR DELETE
    TO authenticated
    USING (auth.uid() = user_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_blog_posts_created_at ON public.blog_posts (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_blog_posts_user_id ON public.blog_posts (user_id);

INSERT INTO storage.buckets (id, name, public)
SELECT 'blog-images', 'blog-images', true
WHERE NOT EXISTS (
  SELECT 1 FROM storage.buckets WHERE id = 'blog-images'
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Anyone can view blog images'
  ) THEN
    CREATE POLICY "Anyone can view blog images"
    ON storage.objects
    FOR SELECT
    USING (bucket_id = 'blog-images');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Authenticated users can upload blog images'
  ) THEN
    CREATE POLICY "Authenticated users can upload blog images"
    ON storage.objects
    FOR INSERT
    TO authenticated
    WITH CHECK (bucket_id = 'blog-images' AND auth.uid()::text = (storage.foldername(name))[1]);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Users can update their own blog images'
  ) THEN
    CREATE POLICY "Users can update their own blog images"
    ON storage.objects
    FOR UPDATE
    TO authenticated
    USING (bucket_id = 'blog-images' AND auth.uid()::text = (storage.foldername(name))[1]);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Users can delete their own blog images'
  ) THEN
    CREATE POLICY "Users can delete their own blog images"
    ON storage.objects
    FOR DELETE
    TO authenticated
    USING (bucket_id = 'blog-images' AND auth.uid()::text = (storage.foldername(name))[1]);
  END IF;
END $$;