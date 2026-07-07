CREATE OR REPLACE FUNCTION public.notify_admins_new_owner_application()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_applicant_name text;
BEGIN
  SELECT COALESCE(NULLIF(full_name, ''), 'Un usuario')
    INTO v_applicant_name
    FROM public.profiles
   WHERE user_id = NEW.user_id;

  INSERT INTO public.notifications (user_id, type, title, message, action_url)
  SELECT
    ur.user_id,
    'application',
    'Nueva solicitud de aliado',
    COALESCE(v_applicant_name, 'Un usuario') || ' quiere publicar ' ||
      NEW.vehicle_brand || ' ' || NEW.vehicle_model || ' ' || NEW.vehicle_year,
    '/admin/solicitudes'
  FROM public.user_roles ur
  WHERE ur.role = 'admin'::public.app_role;

  RETURN NEW;
END;
$$;

UPDATE public.notifications
SET action_url = '/admin/solicitudes'
WHERE action_url = '/admin/applications';