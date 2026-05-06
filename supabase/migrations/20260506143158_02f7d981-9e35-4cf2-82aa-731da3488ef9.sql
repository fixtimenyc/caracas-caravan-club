DROP POLICY IF EXISTS "Renters can cancel their pending reservations" ON public.reservations;

CREATE POLICY "Renters can cancel their pending reservations"
  ON public.reservations
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = renter_id AND status = 'pending'::reservation_status)
  WITH CHECK (auth.uid() = renter_id AND status = 'cancelled'::reservation_status);