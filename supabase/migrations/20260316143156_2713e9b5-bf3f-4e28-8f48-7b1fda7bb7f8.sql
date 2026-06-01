-- Distributions table (admin-created events)
CREATE TABLE public.distributions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by uuid NOT NULL,
  title text NOT NULL,
  description text,
  event_date date NOT NULL,
  event_time text NOT NULL DEFAULT '18h00',
  location text NOT NULL,
  meals_available integer NOT NULL DEFAULT 50,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.distributions ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can view
CREATE POLICY "Anyone can view distributions"
ON public.distributions FOR SELECT TO authenticated
USING (true);

-- Only admins can insert
CREATE POLICY "Admins can insert distributions"
ON public.distributions FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Only admins can delete
CREATE POLICY "Admins can delete distributions"
ON public.distributions FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Only admins can update
CREATE POLICY "Admins can update distributions"
ON public.distributions FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Registration table
CREATE TABLE public.distribution_registrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  distribution_id uuid NOT NULL REFERENCES public.distributions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(distribution_id, user_id)
);

ALTER TABLE public.distribution_registrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view registrations"
ON public.distribution_registrations FOR SELECT TO authenticated
USING (true);

CREATE POLICY "Users can register"
ON public.distribution_registrations FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can unregister"
ON public.distribution_registrations FOR DELETE TO authenticated
USING (auth.uid() = user_id);