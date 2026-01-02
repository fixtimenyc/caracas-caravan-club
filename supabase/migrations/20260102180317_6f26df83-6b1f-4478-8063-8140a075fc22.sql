-- Add verified column to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS verified BOOLEAN NOT NULL DEFAULT false;

-- Create vehicles table
CREATE TABLE public.vehicles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    brand TEXT NOT NULL,
    model TEXT NOT NULL,
    year INTEGER NOT NULL,
    location TEXT NOT NULL,
    price_per_day DECIMAL(10,2) NOT NULL,
    available BOOLEAN NOT NULL DEFAULT true,
    photos TEXT[] DEFAULT '{}',
    description TEXT,
    active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;

-- Anyone can view active vehicles
CREATE POLICY "Anyone can view active vehicles"
ON public.vehicles
FOR SELECT
USING (active = true);

-- Owners can view their own vehicles (including inactive)
CREATE POLICY "Owners can view their own vehicles"
ON public.vehicles
FOR SELECT
TO authenticated
USING (auth.uid() = owner_id);

-- Owners can insert their own vehicles
CREATE POLICY "Owners can insert their own vehicles"
ON public.vehicles
FOR INSERT
TO authenticated
WITH CHECK (
    auth.uid() = owner_id 
    AND (public.has_role(auth.uid(), 'owner') OR public.has_role(auth.uid(), 'admin'))
);

-- Owners can update their own vehicles
CREATE POLICY "Owners can update their own vehicles"
ON public.vehicles
FOR UPDATE
TO authenticated
USING (auth.uid() = owner_id);

-- Owners can delete their own vehicles
CREATE POLICY "Owners can delete their own vehicles"
ON public.vehicles
FOR DELETE
TO authenticated
USING (auth.uid() = owner_id);

-- Admins can manage all vehicles
CREATE POLICY "Admins can manage all vehicles"
ON public.vehicles
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Trigger for updated_at
CREATE TRIGGER update_vehicles_updated_at
  BEFORE UPDATE ON public.vehicles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create reservation status enum
CREATE TYPE public.reservation_status AS ENUM ('pending', 'approved', 'rejected', 'completed', 'cancelled');

-- Create reservations table
CREATE TABLE public.reservations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vehicle_id UUID REFERENCES public.vehicles(id) ON DELETE CASCADE NOT NULL,
    renter_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    total_price DECIMAL(10,2) NOT NULL,
    status reservation_status NOT NULL DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    CONSTRAINT valid_dates CHECK (end_date >= start_date)
);

ALTER TABLE public.reservations ENABLE ROW LEVEL SECURITY;

-- Renters can view their own reservations
CREATE POLICY "Renters can view their own reservations"
ON public.reservations
FOR SELECT
TO authenticated
USING (auth.uid() = renter_id);

-- Owners can view reservations for their vehicles
CREATE POLICY "Owners can view reservations for their vehicles"
ON public.reservations
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.vehicles 
        WHERE vehicles.id = reservations.vehicle_id 
        AND vehicles.owner_id = auth.uid()
    )
);

-- Renters can create reservations
CREATE POLICY "Renters can create reservations"
ON public.reservations
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = renter_id);

-- Owners can update reservation status for their vehicles
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
);

-- Renters can cancel their own pending reservations
CREATE POLICY "Renters can update their reservations"
ON public.reservations
FOR UPDATE
TO authenticated
USING (auth.uid() = renter_id AND status = 'pending');

-- Admins can manage all reservations
CREATE POLICY "Admins can manage all reservations"
ON public.reservations
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_reservations_updated_at
  BEFORE UPDATE ON public.reservations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create payment status enum
CREATE TYPE public.payment_status AS ENUM ('pending', 'completed', 'failed', 'refunded');

-- Create payments table
CREATE TABLE public.payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reservation_id UUID REFERENCES public.reservations(id) ON DELETE CASCADE NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    payment_method TEXT NOT NULL,
    status payment_status NOT NULL DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- Users can view payments for their reservations
CREATE POLICY "Users can view their payments"
ON public.payments
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.reservations 
        WHERE reservations.id = payments.reservation_id 
        AND (reservations.renter_id = auth.uid() OR EXISTS (
            SELECT 1 FROM public.vehicles 
            WHERE vehicles.id = reservations.vehicle_id 
            AND vehicles.owner_id = auth.uid()
        ))
    )
);

-- Admins can manage all payments
CREATE POLICY "Admins can manage all payments"
ON public.payments
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_payments_updated_at
  BEFORE UPDATE ON public.payments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create reviews table
CREATE TABLE public.reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reservation_id UUID REFERENCES public.reservations(id) ON DELETE CASCADE NOT NULL UNIQUE,
    author_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    comment TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

-- Anyone can view reviews
CREATE POLICY "Anyone can view reviews"
ON public.reviews
FOR SELECT
USING (true);

-- Authors can create reviews for completed reservations
CREATE POLICY "Users can create reviews for their completed reservations"
ON public.reviews
FOR INSERT
TO authenticated
WITH CHECK (
    auth.uid() = author_id
    AND EXISTS (
        SELECT 1 FROM public.reservations 
        WHERE reservations.id = reviews.reservation_id 
        AND reservations.status = 'completed'
        AND (reservations.renter_id = auth.uid() OR EXISTS (
            SELECT 1 FROM public.vehicles 
            WHERE vehicles.id = reservations.vehicle_id 
            AND vehicles.owner_id = auth.uid()
        ))
    )
);

-- Authors can update their own reviews
CREATE POLICY "Authors can update their own reviews"
ON public.reviews
FOR UPDATE
TO authenticated
USING (auth.uid() = author_id);

-- Admins can manage all reviews
CREATE POLICY "Admins can manage all reviews"
ON public.reviews
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_reviews_updated_at
  BEFORE UPDATE ON public.reviews
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create storage bucket for vehicle photos
INSERT INTO storage.buckets (id, name, public) VALUES ('vehicle-photos', 'vehicle-photos', true);

-- Storage policies for vehicle photos
CREATE POLICY "Anyone can view vehicle photos"
ON storage.objects
FOR SELECT
USING (bucket_id = 'vehicle-photos');

CREATE POLICY "Owners can upload vehicle photos"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'vehicle-photos' 
    AND (public.has_role(auth.uid(), 'owner') OR public.has_role(auth.uid(), 'admin'))
);

CREATE POLICY "Owners can update their vehicle photos"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'vehicle-photos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Owners can delete their vehicle photos"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'vehicle-photos' AND auth.uid()::text = (storage.foldername(name))[1]);