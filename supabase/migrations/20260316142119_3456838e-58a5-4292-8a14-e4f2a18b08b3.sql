DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'blog_posts'
      AND policyname = 'Admins can delete all blog posts'
  ) THEN
    CREATE POLICY "Admins can delete all blog posts"
    ON public.blog_posts
    FOR DELETE
    TO authenticated
    USING (public.has_role(auth.uid(), 'admin'));
  END IF;
END $$;