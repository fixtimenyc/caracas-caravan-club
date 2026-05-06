-- 1. Messages: only sender can update their own message
DROP POLICY IF EXISTS "Participants update own messages" ON public.messages;
CREATE POLICY "Participants update own messages"
  ON public.messages
  FOR UPDATE
  TO authenticated
  USING (is_conversation_participant(conversation_id, auth.uid()) AND sender_id = auth.uid())
  WITH CHECK (is_conversation_participant(conversation_id, auth.uid()) AND sender_id = auth.uid());

-- 2. Reviews: lock immutable identity fields via trigger
CREATE OR REPLACE FUNCTION public.protect_review_immutable_fields()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.reservation_id IS DISTINCT FROM OLD.reservation_id
     OR NEW.vehicle_id IS DISTINCT FROM OLD.vehicle_id
     OR NEW.subject_user_id IS DISTINCT FROM OLD.subject_user_id
     OR NEW.reviewer_type IS DISTINCT FROM OLD.reviewer_type
     OR NEW.author_id IS DISTINCT FROM OLD.author_id THEN
    IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
      RAISE EXCEPTION 'Cannot modify immutable review fields';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_review_immutable_fields_trg ON public.reviews;
CREATE TRIGGER protect_review_immutable_fields_trg
  BEFORE UPDATE ON public.reviews
  FOR EACH ROW EXECUTE FUNCTION public.protect_review_immutable_fields();

DROP POLICY IF EXISTS "Authors can update their own reviews" ON public.reviews;
CREATE POLICY "Authors can update their own reviews"
  ON public.reviews
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = author_id)
  WITH CHECK (auth.uid() = author_id);

-- 3. Conversations: lock identity fields via trigger
CREATE OR REPLACE FUNCTION public.protect_conversation_immutable_fields()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.renter_id IS DISTINCT FROM OLD.renter_id
     OR NEW.owner_id IS DISTINCT FROM OLD.owner_id
     OR NEW.vehicle_id IS DISTINCT FROM OLD.vehicle_id
     OR NEW.reservation_id IS DISTINCT FROM OLD.reservation_id THEN
    IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
      RAISE EXCEPTION 'Cannot modify immutable conversation fields';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_conversation_immutable_fields_trg ON public.conversations;
CREATE TRIGGER protect_conversation_immutable_fields_trg
  BEFORE UPDATE ON public.conversations
  FOR EACH ROW EXECUTE FUNCTION public.protect_conversation_immutable_fields();

DROP POLICY IF EXISTS "Participants update conversation" ON public.conversations;
CREATE POLICY "Participants update conversation"
  ON public.conversations
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = renter_id OR auth.uid() = owner_id)
  WITH CHECK (auth.uid() = renter_id OR auth.uid() = owner_id);