
-- Fix overly permissive INSERT policy on notifications
DROP POLICY "Anyone authenticated can insert notifications" ON public.notifications;

-- Only allow inserting notifications for the target user (system inserts via edge functions will use service role)
CREATE POLICY "System can insert notifications" ON public.notifications
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
