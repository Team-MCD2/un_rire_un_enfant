CREATE POLICY "Users can delete own proposals" ON public.activity_proposals
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);