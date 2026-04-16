CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  selected_role public.app_role;
BEGIN
  -- Create profile
  INSERT INTO public.profiles (user_id, full_name)
  VALUES (NEW.id, NEW.raw_user_meta_data ->> 'full_name');

  -- Determine role from signup metadata, default to 'renter'
  BEGIN
    selected_role := COALESCE(
      (NEW.raw_user_meta_data ->> 'role')::public.app_role,
      'renter'::public.app_role
    );
  EXCEPTION WHEN OTHERS THEN
    selected_role := 'renter'::public.app_role;
  END;

  -- Never allow self-assigning admin via signup
  IF selected_role = 'admin'::public.app_role THEN
    selected_role := 'renter'::public.app_role;
  END IF;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, selected_role);

  RETURN NEW;
END;
$function$;

-- Ensure the trigger exists on auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();