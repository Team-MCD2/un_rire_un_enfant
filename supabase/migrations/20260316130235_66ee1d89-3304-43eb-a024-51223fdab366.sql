
CREATE TABLE public.activity_proposals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL,
  description text,
  category text,
  proposed_date date,
  location text,
  city text,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.activity_proposals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own proposals" ON public.activity_proposals
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own proposals" ON public.activity_proposals
  FOR SELECT TO authenticated USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update proposals" ON public.activity_proposals
  FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
