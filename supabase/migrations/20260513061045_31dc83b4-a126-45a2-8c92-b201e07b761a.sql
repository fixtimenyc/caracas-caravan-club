
CREATE OR REPLACE FUNCTION public.notify_new_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_conv RECORD;
  v_recipient uuid;
  v_sender_name text;
  v_preview text;
BEGIN
  SELECT renter_id, owner_id, vehicle_id
    INTO v_conv
    FROM public.conversations
   WHERE id = NEW.conversation_id;

  IF v_conv IS NULL THEN
    RETURN NEW;
  END IF;

  v_recipient := CASE
    WHEN NEW.sender_id = v_conv.renter_id THEN v_conv.owner_id
    ELSE v_conv.renter_id
  END;

  IF v_recipient IS NULL OR v_recipient = NEW.sender_id THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(NULLIF(full_name, ''), 'Alguien')
    INTO v_sender_name
    FROM public.profiles
   WHERE user_id = NEW.sender_id;

  v_preview := CASE
    WHEN length(NEW.content) > 120 THEN substring(NEW.content from 1 for 117) || '...'
    ELSE NEW.content
  END;

  INSERT INTO public.notifications (user_id, type, title, message, action_url, vehicle_id)
  VALUES (
    v_recipient,
    'message',
    'Nuevo mensaje de ' || COALESCE(v_sender_name, 'Alguien'),
    v_preview,
    '/mensajes?c=' || NEW.conversation_id::text,
    v_conv.vehicle_id
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_new_message ON public.messages;
CREATE TRIGGER trg_notify_new_message
AFTER INSERT ON public.messages
FOR EACH ROW
EXECUTE FUNCTION public.notify_new_message();
