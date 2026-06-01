
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (id, full_name, phone, nickname, member_type, notif_messages, notif_activities, notif_stories, notif_distributions)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'phone',
    NEW.raw_user_meta_data->>'nickname',
    COALESCE(NEW.raw_user_meta_data->>'member_type', 'beneficiaire'),
    COALESCE((NEW.raw_user_meta_data->>'notif_messages')::boolean, true),
    COALESCE((NEW.raw_user_meta_data->>'notif_activities')::boolean, true),
    COALESCE((NEW.raw_user_meta_data->>'notif_stories')::boolean, true),
    COALESCE((NEW.raw_user_meta_data->>'notif_distributions')::boolean, true)
  );
  RETURN NEW;
END;
$function$;
