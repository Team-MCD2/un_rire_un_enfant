DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'activity_proposals'
      AND policyname = 'Anyone can view approved proposals'
  ) THEN
    CREATE POLICY "Anyone can view approved proposals"
    ON public.activity_proposals
    FOR SELECT
    TO authenticated
    USING (status = 'approved');
  END IF;
END $$;