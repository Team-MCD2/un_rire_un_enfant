
-- Stories (24h ephemeral content)
CREATE TABLE public.stories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  image_url text,
  caption text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.stories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view stories" ON public.stories FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can post stories" ON public.stories FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own stories" ON public.stories FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins can delete any story" ON public.stories FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Idea posts
CREATE TABLE public.idea_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  content text NOT NULL,
  image_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.idea_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view ideas" ON public.idea_posts FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can post ideas" ON public.idea_posts FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own ideas" ON public.idea_posts FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins can delete any idea" ON public.idea_posts FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Idea likes
CREATE TABLE public.idea_likes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.idea_posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(post_id, user_id)
);
ALTER TABLE public.idea_likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view likes" ON public.idea_likes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can like" ON public.idea_likes FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can unlike" ON public.idea_likes FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Idea comments
CREATE TABLE public.idea_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.idea_posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.idea_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view comments" ON public.idea_comments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can comment" ON public.idea_comments FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own comments" ON public.idea_comments FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins can delete any comment" ON public.idea_comments FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Authorization forms (admin creates)
CREATE TABLE public.authorization_forms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by uuid NOT NULL,
  title text NOT NULL,
  form_type text NOT NULL DEFAULT 'sortie',
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.authorization_forms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view forms" ON public.authorization_forms FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can create forms" ON public.authorization_forms FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete forms" ON public.authorization_forms FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update forms" ON public.authorization_forms FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Authorization signatures (parents sign)
CREATE TABLE public.authorization_signatures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id uuid NOT NULL REFERENCES public.authorization_forms(id) ON DELETE CASCADE,
  parent_name text NOT NULL,
  child_name text NOT NULL,
  signature_data text NOT NULL,
  user_id uuid NOT NULL,
  signed_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.authorization_signatures ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own signatures" ON public.authorization_signatures FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users can sign" ON public.authorization_signatures FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins can delete signatures" ON public.authorization_signatures FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Storage buckets
INSERT INTO storage.buckets (id, name, public) VALUES ('stories', 'stories', true);
INSERT INTO storage.buckets (id, name, public) VALUES ('idea-images', 'idea-images', true);

-- Storage policies for stories bucket
CREATE POLICY "Anyone can view stories files" ON storage.objects FOR SELECT USING (bucket_id = 'stories');
CREATE POLICY "Authenticated can upload stories" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'stories');
CREATE POLICY "Users can delete own story files" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'stories');

-- Storage policies for idea-images bucket
CREATE POLICY "Anyone can view idea images" ON storage.objects FOR SELECT USING (bucket_id = 'idea-images');
CREATE POLICY "Authenticated can upload idea images" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'idea-images');
CREATE POLICY "Users can delete own idea images" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'idea-images');
