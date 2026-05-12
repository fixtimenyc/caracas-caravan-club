
DROP POLICY IF EXISTS "Owners can update reservation status" ON public.reservations;

CREATE POLICY "Owners can update reservation status"
ON public.reservations
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.vehicles
    WHERE vehicles.id = reservations.vehicle_id
      AND vehicles.owner_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.vehicles
    WHERE vehicles.id = reservations.vehicle_id
      AND vehicles.owner_id = auth.uid()
  )
  AND status IN (
    'approved'::reservation_status,
    'rejected'::reservation_status,
    'active'::reservation_status,
    'completed'::reservation_status,
    'cancelled'::reservation_status
  )
  AND (
    status <> 'completed'::reservation_status
    OR end_date <= CURRENT_DATE
  )
);
