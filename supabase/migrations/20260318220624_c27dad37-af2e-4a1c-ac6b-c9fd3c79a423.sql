-- Allow admins to delete room memberships (kick members)
CREATE POLICY "Admins can delete memberships"
ON public.room_memberships
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));