
ALTER TYPE public.reservation_status ADD VALUE IF NOT EXISTS 'awaiting_payment' BEFORE 'approved';
ALTER TYPE public.payment_status ADD VALUE IF NOT EXISTS 'submitted' BEFORE 'completed';
