-- Allow all authenticated users to read basic profile info (needed for chat members, blog authors, etc.)
CREATE POLICY "Authenticated users can read all profiles"
ON public.profiles FOR SELECT
TO authenticated
USING (true);

-- Drop the old restrictive policies that are now redundant
DROP POLICY IF EXISTS "Users can read own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can read all profiles" ON public.profiles;