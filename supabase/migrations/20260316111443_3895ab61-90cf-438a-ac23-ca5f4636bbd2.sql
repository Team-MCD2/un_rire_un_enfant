
-- Chat rooms table
CREATE TABLE public.chat_rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  description text,
  icon text DEFAULT '💬',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.chat_rooms ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone authenticated can view rooms" ON public.chat_rooms FOR SELECT TO authenticated USING (true);

-- Membership status enum
CREATE TYPE public.membership_status AS ENUM ('pending', 'approved', 'rejected');

-- Room memberships (created BEFORE chat_messages policies)
CREATE TABLE public.room_memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid REFERENCES public.chat_rooms(id) ON DELETE CASCADE NOT NULL,
  user_id uuid NOT NULL,
  status membership_status NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(room_id, user_id)
);
ALTER TABLE public.room_memberships ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own memberships" ON public.room_memberships FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users can request access" ON public.room_memberships FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() AND status = 'pending');
CREATE POLICY "Admins can update memberships" ON public.room_memberships FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Chat messages
CREATE TABLE public.chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid REFERENCES public.chat_rooms(id) ON DELETE CASCADE NOT NULL,
  user_id uuid NOT NULL,
  user_name text NOT NULL,
  content text NOT NULL,
  is_bot boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Approved members or admins can read messages" ON public.chat_messages FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.room_memberships WHERE room_id = chat_messages.room_id AND user_id = auth.uid() AND status = 'approved')
  OR public.has_role(auth.uid(), 'admin')
);
CREATE POLICY "Approved members or admins can send messages" ON public.chat_messages FOR INSERT TO authenticated WITH CHECK (
  user_id = auth.uid() AND (
    EXISTS (SELECT 1 FROM public.room_memberships WHERE room_id = chat_messages.room_id AND user_id = auth.uid() AND status = 'approved')
    OR public.has_role(auth.uid(), 'admin')
  )
);

-- Bot instructions
CREATE TABLE public.bot_instructions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instruction text NOT NULL,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.bot_instructions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone authenticated can read bot instructions" ON public.bot_instructions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert bot instructions" ON public.bot_instructions FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete bot instructions" ON public.bot_instructions FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Donations wall of fame
CREATE TABLE public.donations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  donor_name text NOT NULL DEFAULT 'Anonyme',
  amount numeric NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.donations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view donations" ON public.donations FOR SELECT USING (true);
CREATE POLICY "Authenticated can insert donations" ON public.donations FOR INSERT TO authenticated WITH CHECK (true);

-- Seed the 3 chat rooms
INSERT INTO public.chat_rooms (name, slug, description, icon) VALUES
  ('Bénévoles', 'benevoles', 'Pour ceux qui veulent aider', '🤝'),
  ('Intime', 'intime', 'Salon privé pour les membres proches', '💜'),
  ('Repas Étudiants', 'repas-etudiants', 'Organisation des repas', '🍽️');

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.room_memberships;
