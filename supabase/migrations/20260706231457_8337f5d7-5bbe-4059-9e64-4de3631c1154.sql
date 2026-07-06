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
    '/admin/applications'
  FROM public.user_roles ur
  WHERE ur.role = 'admin'::public.app_role;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_owner_application_created ON public.owner_applications;
CREATE TRIGGER on_owner_application_created
AFTER INSERT ON public.owner_applications
FOR EACH ROW
EXECUTE FUNCTION public.notify_admins_new_owner_application();

INSERT INTO public.notifications (user_id, type, title, message, action_url)
SELECT
  ur.user_id,
  'application',
  'Nueva solicitud de aliado',
  COALESCE(NULLIF(p.full_name, ''), 'Un usuario') || ' quiere publicar ' ||
    oa.vehicle_brand || ' ' || oa.vehicle_model || ' ' || oa.vehicle_year,
  '/admin/applications'
FROM public.owner_applications oa
CROSS JOIN public.user_roles ur
LEFT JOIN public.profiles p ON p.user_id = oa.user_id
WHERE oa.status = 'pending'
  AND ur.role = 'admin'::public.app_role
  AND NOT EXISTS (
    SELECT 1 FROM public.notifications n
    WHERE n.user_id = ur.user_id
      AND n.type = 'application'
      AND n.action_url = '/admin/applications'
      AND n.created_at >= oa.created_at
  );