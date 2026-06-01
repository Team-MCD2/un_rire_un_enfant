
-- Blog comments table
CREATE TABLE public.blog_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.blog_posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  content text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.blog_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view blog comments" ON public.blog_comments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can comment" ON public.blog_comments FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own comments" ON public.blog_comments FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins can delete any comment" ON public.blog_comments FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
