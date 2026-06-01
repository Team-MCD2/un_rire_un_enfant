
-- Add reply_to_id, edited_at, is_pinned to chat_messages
ALTER TABLE public.chat_messages 
  ADD COLUMN IF NOT EXISTS reply_to_id uuid REFERENCES public.chat_messages(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS edited_at timestamptz,
  ADD COLUMN IF NOT EXISTS is_pinned boolean NOT NULL DEFAULT false;

-- Create message_reactions table
CREATE TABLE IF NOT EXISTS public.message_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES public.chat_messages(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  emoji text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(message_id, user_id, emoji)
);

-- Enable RLS on message_reactions
ALTER TABLE public.message_reactions ENABLE ROW LEVEL SECURITY;

-- RLS: anyone authenticated can view reactions
CREATE POLICY "Anyone can view reactions" ON public.message_reactions
  FOR SELECT TO authenticated USING (true);

-- RLS: users can add reactions
CREATE POLICY "Users can add reactions" ON public.message_reactions
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- RLS: users can remove own reactions
CREATE POLICY "Users can remove own reactions" ON public.message_reactions
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Allow users to delete own messages
CREATE POLICY "Users can delete own messages" ON public.chat_messages
  FOR DELETE TO authenticated USING (
    auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role)
  );

-- Allow users to update own messages (edit content)
CREATE POLICY "Users can update own messages" ON public.chat_messages
  FOR UPDATE TO authenticated USING (
    auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role)
  );

-- Enable realtime for reactions
ALTER PUBLICATION supabase_realtime ADD TABLE public.message_reactions;
