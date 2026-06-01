
-- Add audio_url column to chat_messages for voice messages
ALTER TABLE public.chat_messages ADD COLUMN IF NOT EXISTS audio_url TEXT DEFAULT NULL;

-- Create contact_requests table for private chat requests
CREATE TABLE public.contact_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id UUID NOT NULL,
  target_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(requester_id, target_id)
);

ALTER TABLE public.contact_requests ENABLE ROW LEVEL SECURITY;

-- Users can see their own requests (sent or received)
CREATE POLICY "Users can view own contact requests" ON public.contact_requests
  FOR SELECT TO authenticated
  USING (auth.uid() = requester_id OR auth.uid() = target_id);

-- Users can insert requests where they are the requester
CREATE POLICY "Users can send contact requests" ON public.contact_requests
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = requester_id);

-- Target user can update (accept/refuse) requests sent to them
CREATE POLICY "Target can update contact requests" ON public.contact_requests
  FOR UPDATE TO authenticated
  USING (auth.uid() = target_id);

-- Admins can insert contact requests (bypass)
CREATE POLICY "Admins can insert contact requests" ON public.contact_requests
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Create storage bucket for voice messages
INSERT INTO storage.buckets (id, name, public) VALUES ('voice-messages', 'voice-messages', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for voice messages
CREATE POLICY "Authenticated users can upload voice messages" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'voice-messages');

CREATE POLICY "Anyone can read voice messages" ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'voice-messages');
