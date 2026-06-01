-- Support messages table: users contact admins, admins reply
CREATE TABLE IF NOT EXISTS public.support_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  content TEXT NOT NULL,
  is_admin_reply BOOLEAN NOT NULL DEFAULT false,
  admin_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='support_messages' AND policyname='Users can view own support messages') THEN
    CREATE POLICY "Users can view own support messages"
    ON public.support_messages FOR SELECT TO authenticated
    USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='support_messages' AND policyname='Users can send support messages') THEN
    CREATE POLICY "Users can send support messages"
    ON public.support_messages FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = user_id AND is_admin_reply = false);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='support_messages' AND policyname='Admins can reply to support messages') THEN
    CREATE POLICY "Admins can reply to support messages"
    ON public.support_messages FOR INSERT TO authenticated
    WITH CHECK (has_role(auth.uid(), 'admin'::app_role) AND is_admin_reply = true AND admin_id = auth.uid());
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_support_messages_user ON public.support_messages(user_id, created_at DESC);

ALTER PUBLICATION supabase_realtime ADD TABLE public.support_messages;