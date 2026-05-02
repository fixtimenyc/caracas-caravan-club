-- Estado del ticket
CREATE TYPE public.ticket_status AS ENUM ('open', 'in_progress', 'resolved', 'closed');

-- Categoría del ticket
CREATE TYPE public.ticket_category AS ENUM ('reservas', 'pagos', 'aliados', 'cuenta', 'seguridad', 'otro');

CREATE TABLE public.support_tickets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NULL,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  subject TEXT NOT NULL,
  category public.ticket_category NOT NULL DEFAULT 'otro',
  message TEXT NOT NULL,
  status public.ticket_status NOT NULL DEFAULT 'open',
  admin_response TEXT NULL,
  responded_by UUID NULL,
  responded_at TIMESTAMP WITH TIME ZONE NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;

-- Cualquier persona puede crear un ticket (incluido visitantes anónimos)
CREATE POLICY "Anyone can create support tickets"
ON public.support_tickets
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- Los usuarios autenticados ven los tickets que crearon (vinculados por user_id)
CREATE POLICY "Users can view their own tickets"
ON public.support_tickets
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Los admins gestionan todo
CREATE POLICY "Admins can manage all tickets"
ON public.support_tickets
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

-- Trigger para updated_at
CREATE TRIGGER set_support_tickets_updated_at
BEFORE UPDATE ON public.support_tickets
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_support_tickets_user_id ON public.support_tickets(user_id);
CREATE INDEX idx_support_tickets_status ON public.support_tickets(status);
CREATE INDEX idx_support_tickets_created_at ON public.support_tickets(created_at DESC);