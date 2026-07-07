
-- Payments columns
ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS receipt_url TEXT,
  ADD COLUMN IF NOT EXISTS reference_number TEXT,
  ADD COLUMN IF NOT EXISTS payer_name TEXT,
  ADD COLUMN IF NOT EXISTS payer_phone TEXT,
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS verified_by UUID,
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

ALTER TABLE public.payments ALTER COLUMN payment_method SET DEFAULT 'pago_movil';

ALTER TABLE public.reservations
  ADD COLUMN IF NOT EXISTS payment_deadline TIMESTAMPTZ;

-- Storage policies for payment-receipts
DROP POLICY IF EXISTS "receipts_read" ON storage.objects;
CREATE POLICY "receipts_read" ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'payment-receipts' AND (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR EXISTS (
      SELECT 1 FROM public.reservations r
      LEFT JOIN public.vehicles v ON v.id = r.vehicle_id
      WHERE (r.renter_id = auth.uid() OR v.owner_id = auth.uid())
        AND (storage.foldername(name))[1] = r.id::text
    )
  )
);

DROP POLICY IF EXISTS "receipts_renter_upload" ON storage.objects;
CREATE POLICY "receipts_renter_upload" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'payment-receipts' AND EXISTS (
    SELECT 1 FROM public.reservations r
    WHERE r.renter_id = auth.uid()
      AND (storage.foldername(name))[1] = r.id::text
  )
);

DROP POLICY IF EXISTS "receipts_renter_update" ON storage.objects;
CREATE POLICY "receipts_renter_update" ON storage.objects
FOR UPDATE TO authenticated
USING (
  bucket_id = 'payment-receipts' AND EXISTS (
    SELECT 1 FROM public.reservations r
    WHERE r.renter_id = auth.uid()
      AND (storage.foldername(name))[1] = r.id::text
  )
);

-- Payments RLS
DROP POLICY IF EXISTS "Only admins can create payments" ON public.payments;

DROP POLICY IF EXISTS "Renters can submit payment for own reservation" ON public.payments;
CREATE POLICY "Renters can submit payment for own reservation" ON public.payments
FOR INSERT TO authenticated
WITH CHECK (
  status IN ('pending'::public.payment_status, 'submitted'::public.payment_status)
  AND EXISTS (
    SELECT 1 FROM public.reservations r
    WHERE r.id = payments.reservation_id
      AND r.renter_id = auth.uid()
      AND r.status = 'awaiting_payment'::public.reservation_status
  )
);

DROP POLICY IF EXISTS "Renters can update own submitted payment" ON public.payments;
CREATE POLICY "Renters can update own submitted payment" ON public.payments
FOR UPDATE TO authenticated
USING (
  status IN ('pending'::public.payment_status, 'submitted'::public.payment_status, 'failed'::public.payment_status)
  AND EXISTS (
    SELECT 1 FROM public.reservations r
    WHERE r.id = payments.reservation_id
      AND r.renter_id = auth.uid()
  )
)
WITH CHECK (
  status IN ('pending'::public.payment_status, 'submitted'::public.payment_status)
  AND EXISTS (
    SELECT 1 FROM public.reservations r
    WHERE r.id = payments.reservation_id
      AND r.renter_id = auth.uid()
  )
);

-- Trigger: payment verified -> promote reservation
CREATE OR REPLACE FUNCTION public.on_payment_verified()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_res public.reservations;
BEGIN
  IF NEW.status = 'completed'::public.payment_status
     AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM NEW.status) THEN
    SELECT * INTO v_res FROM public.reservations WHERE id = NEW.reservation_id;
    IF v_res.status = 'awaiting_payment'::public.reservation_status THEN
      UPDATE public.reservations
        SET status = 'approved'::public.reservation_status,
            updated_at = now()
        WHERE id = NEW.reservation_id;
      INSERT INTO public.notifications (user_id, type, title, message, action_url, vehicle_id)
      VALUES (
        v_res.renter_id, 'payment',
        'Pago verificado',
        'Tu pago fue confirmado. La reserva quedó aprobada y lista para la entrega.',
        '/reservas/' || v_res.id::text,
        v_res.vehicle_id
      );
    END IF;
    NEW.verified_at := COALESCE(NEW.verified_at, now());
  ELSIF NEW.status = 'failed'::public.payment_status
        AND (TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status) THEN
    SELECT * INTO v_res FROM public.reservations WHERE id = NEW.reservation_id;
    INSERT INTO public.notifications (user_id, type, title, message, action_url, vehicle_id)
    VALUES (
      v_res.renter_id, 'payment',
      'Pago rechazado',
      COALESCE('Motivo: ' || NEW.rejection_reason, 'Por favor sube un nuevo comprobante.'),
      '/reservas/' || v_res.id::text,
      v_res.vehicle_id
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_on_payment_verified ON public.payments;
CREATE TRIGGER trg_on_payment_verified
BEFORE INSERT OR UPDATE ON public.payments
FOR EACH ROW EXECUTE FUNCTION public.on_payment_verified();

-- Trigger: set payment_deadline when reservation enters awaiting_payment
CREATE OR REPLACE FUNCTION public.on_reservation_awaiting_payment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'awaiting_payment'::public.reservation_status
     AND (OLD.status IS DISTINCT FROM NEW.status) THEN
    NEW.payment_deadline := now() + INTERVAL '24 hours';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_on_reservation_awaiting_payment ON public.reservations;
CREATE TRIGGER trg_on_reservation_awaiting_payment
BEFORE UPDATE ON public.reservations
FOR EACH ROW EXECUTE FUNCTION public.on_reservation_awaiting_payment();

CREATE OR REPLACE FUNCTION public.notify_awaiting_payment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'awaiting_payment'::public.reservation_status
     AND (OLD.status IS DISTINCT FROM NEW.status) THEN
    INSERT INTO public.notifications (user_id, type, title, message, action_url, vehicle_id)
    VALUES (
      NEW.renter_id, 'payment',
      'Tu reserva fue aprobada — completa el pago',
      'Tienes 24 horas para subir el comprobante de pago. La reserva se cancelará automáticamente si no se verifica.',
      '/reservas/' || NEW.id::text,
      NEW.vehicle_id
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_awaiting_payment ON public.reservations;
CREATE TRIGGER trg_notify_awaiting_payment
AFTER UPDATE ON public.reservations
FOR EACH ROW EXECUTE FUNCTION public.notify_awaiting_payment();

-- Owner UPDATE policy updated
DROP POLICY IF EXISTS "Owners can update reservation status" ON public.reservations;
CREATE POLICY "Owners can update reservation status" ON public.reservations
FOR UPDATE TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.vehicles v WHERE v.id = reservations.vehicle_id AND v.owner_id = auth.uid())
)
WITH CHECK (
  EXISTS (SELECT 1 FROM public.vehicles v WHERE v.id = reservations.vehicle_id AND v.owner_id = auth.uid())
  AND (
    status = public.current_reservation_status(id)
    OR (public.current_reservation_status(id) = 'pending'::public.reservation_status
        AND status = ANY (ARRAY['awaiting_payment'::public.reservation_status, 'rejected'::public.reservation_status, 'cancelled'::public.reservation_status]))
    OR (public.current_reservation_status(id) = 'awaiting_payment'::public.reservation_status
        AND status = 'cancelled'::public.reservation_status)
    OR (public.current_reservation_status(id) = 'approved'::public.reservation_status
        AND (status = 'cancelled'::public.reservation_status
             OR (status = 'active'::public.reservation_status AND public.reservation_has_completed_payment(id))))
    OR (public.current_reservation_status(id) = 'active'::public.reservation_status
        AND (status = 'cancelled'::public.reservation_status
             OR (status = 'completed'::public.reservation_status AND end_date <= CURRENT_DATE)))
  )
);

DROP POLICY IF EXISTS "Renters can cancel awaiting_payment" ON public.reservations;
CREATE POLICY "Renters can cancel awaiting_payment" ON public.reservations
FOR UPDATE TO authenticated
USING (auth.uid() = renter_id AND status = 'awaiting_payment'::public.reservation_status)
WITH CHECK (auth.uid() = renter_id AND status = 'cancelled'::public.reservation_status);

-- Auto-cancel
CREATE OR REPLACE FUNCTION public.auto_cancel_unpaid_reservations()
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INT := 0;
  v_row RECORD;
BEGIN
  FOR v_row IN
    SELECT id, renter_id, vehicle_id FROM public.reservations
    WHERE status = 'awaiting_payment'::public.reservation_status
      AND payment_deadline IS NOT NULL
      AND payment_deadline < now()
      AND NOT public.reservation_has_completed_payment(id)
  LOOP
    UPDATE public.reservations
      SET status = 'cancelled'::public.reservation_status,
          cancellation_reason = COALESCE(cancellation_reason, 'Pago no verificado dentro de las 24 horas'),
          cancelled_at = now(),
          updated_at = now()
      WHERE id = v_row.id;
    INSERT INTO public.notifications (user_id, type, title, message, action_url, vehicle_id)
    VALUES (v_row.renter_id, 'reservation_cancelled', 'Reserva cancelada',
            'Tu reserva fue cancelada por falta de pago dentro de las 24 horas.',
            '/reservas/' || v_row.id::text, v_row.vehicle_id);
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END;
$$;

CREATE EXTENSION IF NOT EXISTS pg_cron;

DO $$
BEGIN
  PERFORM cron.unschedule('auto-cancel-unpaid-reservations');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'auto-cancel-unpaid-reservations',
  '*/15 * * * *',
  $$SELECT public.auto_cancel_unpaid_reservations();$$
);
