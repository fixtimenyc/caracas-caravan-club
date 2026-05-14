-- Add cancellation fields to reservations
ALTER TABLE public.reservations
  ADD COLUMN IF NOT EXISTS cancellation_reason text,
  ADD COLUMN IF NOT EXISTS refund_percent numeric,
  ADD COLUMN IF NOT EXISTS refund_amount numeric,
  ADD COLUMN IF NOT EXISTS cancelled_at timestamptz,
  ADD COLUMN IF NOT EXISTS cancelled_by uuid;

-- Event log
CREATE TABLE IF NOT EXISTS public.reservation_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_id uuid NOT NULL,
  event_type text NOT NULL,
  actor_id uuid,
  message text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reservation_events_res ON public.reservation_events(reservation_id, created_at DESC);

ALTER TABLE public.reservation_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage reservation events"
ON public.reservation_events FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Participants view reservation events"
ON public.reservation_events FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.reservations r
    LEFT JOIN public.vehicles v ON v.id = r.vehicle_id
    WHERE r.id = reservation_events.reservation_id
      AND (r.renter_id = auth.uid() OR v.owner_id = auth.uid())
  )
);

CREATE POLICY "Participants add notes/reminders"
ON public.reservation_events FOR INSERT
TO authenticated
WITH CHECK (
  actor_id = auth.uid()
  AND event_type IN ('note','reminder_sent')
  AND EXISTS (
    SELECT 1 FROM public.reservations r
    LEFT JOIN public.vehicles v ON v.id = r.vehicle_id
    WHERE r.id = reservation_events.reservation_id
      AND (r.renter_id = auth.uid() OR v.owner_id = auth.uid())
  )
);

-- Trigger to auto-log events
CREATE OR REPLACE FUNCTION public.log_reservation_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.reservation_events (reservation_id, event_type, actor_id, message, metadata)
    VALUES (NEW.id, 'created', NEW.renter_id, 'Reserva creada',
      jsonb_build_object('status', NEW.status, 'total_price', NEW.total_price));
  ELSIF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.reservation_events (reservation_id, event_type, actor_id, message, metadata)
    VALUES (
      NEW.id,
      CASE NEW.status::text
        WHEN 'approved' THEN 'approved'
        WHEN 'rejected' THEN 'rejected'
        WHEN 'active' THEN 'activated'
        WHEN 'completed' THEN 'completed'
        WHEN 'cancelled' THEN 'cancelled'
        ELSE 'status_change'
      END,
      auth.uid(),
      'Estado: ' || OLD.status::text || ' → ' || NEW.status::text,
      jsonb_build_object(
        'from', OLD.status, 'to', NEW.status,
        'cancellation_reason', NEW.cancellation_reason,
        'refund_percent', NEW.refund_percent,
        'refund_amount', NEW.refund_amount
      )
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_reservation_event ON public.reservations;
CREATE TRIGGER trg_log_reservation_event
AFTER INSERT OR UPDATE OF status ON public.reservations
FOR EACH ROW EXECUTE FUNCTION public.log_reservation_event();