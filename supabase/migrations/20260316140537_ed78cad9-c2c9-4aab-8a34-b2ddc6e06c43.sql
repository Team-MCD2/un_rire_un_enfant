
-- Add bio column to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS bio TEXT DEFAULT NULL;

-- Create activity_registrations table for persistent signups
CREATE TABLE IF NOT EXISTS public.activity_registrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_id UUID NOT NULL REFERENCES public.activity_proposals(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(activity_id, user_id)
);

ALTER TABLE public.activity_registrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view registrations" ON public.activity_registrations
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can register" ON public.activity_registrations
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can unregister" ON public.activity_registrations
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage registrations" ON public.activity_registrations
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete proposals" ON public.activity_proposals
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
