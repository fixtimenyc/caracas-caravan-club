
-- Vehicle maintenance schedule (used by admin alerts)
CREATE TABLE public.vehicle_maintenance (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  vehicle_id UUID NOT NULL,
  type TEXT NOT NULL,
  notes TEXT,
  scheduled_date DATE NOT NULL,
  completed_at TIMESTAMP WITH TIME ZONE,
  status TEXT NOT NULL DEFAULT 'scheduled',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.vehicle_maintenance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage maintenance"
  ON public.vehicle_maintenance FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Owners view their vehicle maintenance"
  ON public.vehicle_maintenance FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.vehicles v
    WHERE v.id = vehicle_maintenance.vehicle_id AND v.owner_id = auth.uid()
  ));

CREATE TRIGGER trg_vehicle_maintenance_updated_at
  BEFORE UPDATE ON public.vehicle_maintenance
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_vehicle_maintenance_vehicle ON public.vehicle_maintenance(vehicle_id);
CREATE INDEX idx_vehicle_maintenance_scheduled ON public.vehicle_maintenance(scheduled_date);

-- Admin overview metrics function (single round-trip)
CREATE OR REPLACE FUNCTION public.admin_overview_metrics(_from DATE, _to DATE)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_total_revenue NUMERIC := 0;
  v_commissions NUMERIC := 0;
  v_insurance NUMERIC := 0;
  v_active INT := 0;
  v_pending INT := 0;
  v_completed INT := 0;
  v_cancelled INT := 0;
  v_total_res INT := 0;
  v_avg_rev_per_car NUMERIC := 0;
  v_nps NUMERIC := 0;
  v_open_tickets INT := 0;
  v_closed_tickets INT := 0;
  v_new_users INT := 0;
  v_total_vehicles INT := 0;
  v_revenue_series jsonb;
  v_top_cars jsonb;
  v_bottom_cars jsonb;
  v_distribution jsonb;
  v_recent_reservations jsonb;
  v_alerts jsonb;
  v_recent_users jsonb;
BEGIN
  IF NOT public.has_role(v_caller, 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  -- Reservation counts in range (by created_at)
  SELECT
    COUNT(*) FILTER (WHERE status = 'active'),
    COUNT(*) FILTER (WHERE status = 'pending'),
    COUNT(*) FILTER (WHERE status = 'completed'),
    COUNT(*) FILTER (WHERE status = 'cancelled'),
    COUNT(*),
    COALESCE(SUM(total_price) FILTER (WHERE status IN ('completed','active')), 0)
  INTO v_active, v_pending, v_completed, v_cancelled, v_total_res, v_total_revenue
  FROM public.reservations
  WHERE created_at::date BETWEEN _from AND _to;

  v_commissions := ROUND(v_total_revenue * 0.10, 2);
  -- approximate insurance: $8/day across paid reservations
  SELECT COALESCE(SUM(GREATEST(end_date - start_date, 1) * 8), 0)
    INTO v_insurance
  FROM public.reservations
  WHERE created_at::date BETWEEN _from AND _to AND status IN ('completed','active');

  SELECT COUNT(*) INTO v_total_vehicles FROM public.vehicles WHERE active = true;
  IF v_total_vehicles > 0 THEN
    v_avg_rev_per_car := ROUND(v_total_revenue / v_total_vehicles, 2);
  END IF;

  SELECT ROUND(AVG(rating)::NUMERIC, 2) INTO v_nps
  FROM public.reviews WHERE created_at::date BETWEEN _from AND _to;

  SELECT
    COUNT(*) FILTER (WHERE status IN ('open','in_progress')),
    COUNT(*) FILTER (WHERE status IN ('resolved','closed'))
  INTO v_open_tickets, v_closed_tickets
  FROM public.support_tickets
  WHERE created_at::date BETWEEN _from AND _to;

  SELECT COUNT(*) INTO v_new_users
  FROM public.profiles WHERE created_at::date BETWEEN _from AND _to;

  -- 6-month revenue series (last 6 months from _to)
  WITH months AS (
    SELECT generate_series(
      date_trunc('month', _to::timestamp) - INTERVAL '5 months',
      date_trunc('month', _to::timestamp),
      INTERVAL '1 month'
    )::date AS m
  ),
  agg AS (
    SELECT date_trunc('month', created_at)::date AS m,
           COALESCE(SUM(total_price) FILTER (WHERE status IN ('completed','active')), 0) AS revenue,
           COALESCE(SUM(total_price) FILTER (WHERE status IN ('completed','active')) * 0.10, 0) AS commissions,
           COALESCE(SUM(GREATEST(end_date - start_date, 1) * 8) FILTER (WHERE status IN ('completed','active')), 0) AS insurance
    FROM public.reservations
    WHERE created_at >= (date_trunc('month', _to::timestamp) - INTERVAL '5 months')
    GROUP BY 1
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'month', to_char(months.m, 'Mon YY'),
    'revenue', COALESCE(agg.revenue, 0),
    'commissions', COALESCE(agg.commissions, 0),
    'insurance', COALESCE(agg.insurance, 0)
  ) ORDER BY months.m), '[]'::jsonb)
  INTO v_revenue_series
  FROM months LEFT JOIN agg ON agg.m = months.m;

  -- Top 5 / Bottom 5 by reservation count in range
  WITH counts AS (
    SELECT v.id, v.brand || ' ' || v.model AS name,
           COUNT(r.id) AS cnt,
           COALESCE(SUM(r.total_price) FILTER (WHERE r.status IN ('completed','active')), 0) AS revenue
    FROM public.vehicles v
    LEFT JOIN public.reservations r
      ON r.vehicle_id = v.id AND r.created_at::date BETWEEN _from AND _to
    WHERE v.active = true
    GROUP BY v.id, v.brand, v.model
  )
  SELECT
    (SELECT COALESCE(jsonb_agg(jsonb_build_object('name', name, 'count', cnt, 'revenue', revenue)
                               ORDER BY cnt DESC), '[]'::jsonb)
     FROM (SELECT * FROM counts ORDER BY cnt DESC LIMIT 5) t),
    (SELECT COALESCE(jsonb_agg(jsonb_build_object('name', name, 'count', cnt, 'revenue', revenue)
                               ORDER BY cnt ASC), '[]'::jsonb)
     FROM (SELECT * FROM counts WHERE cnt >= 0 ORDER BY cnt ASC LIMIT 5) t)
  INTO v_top_cars, v_bottom_cars;

  -- Revenue distribution by location (zone proxy)
  SELECT COALESCE(jsonb_agg(jsonb_build_object('label', label, 'value', value)), '[]'::jsonb)
  INTO v_distribution
  FROM (
    SELECT split_part(v.location, ',', 1) AS label,
           COALESCE(SUM(r.total_price) FILTER (WHERE r.status IN ('completed','active')), 0) AS value
    FROM public.vehicles v
    LEFT JOIN public.reservations r
      ON r.vehicle_id = v.id AND r.created_at::date BETWEEN _from AND _to
    GROUP BY split_part(v.location, ',', 1)
    HAVING COALESCE(SUM(r.total_price) FILTER (WHERE r.status IN ('completed','active')), 0) > 0
    ORDER BY value DESC
    LIMIT 8
  ) d;

  -- Recent reservations
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', r.id,
    'status', r.status,
    'total_price', r.total_price,
    'start_date', r.start_date,
    'end_date', r.end_date,
    'created_at', r.created_at,
    'vehicle', v.brand || ' ' || v.model,
    'renter', p.full_name
  ) ORDER BY r.created_at DESC), '[]'::jsonb)
  INTO v_recent_reservations
  FROM (SELECT * FROM public.reservations ORDER BY created_at DESC LIMIT 10) r
  LEFT JOIN public.vehicles v ON v.id = r.vehicle_id
  LEFT JOIN public.profiles p ON p.user_id = r.renter_id;

  -- Alerts: upcoming maintenance + pending payments + open tickets
  WITH a AS (
    SELECT 'maintenance' AS kind,
           'Mantenimiento próximo: ' || v.brand || ' ' || v.model AS title,
           to_char(m.scheduled_date, 'DD Mon YYYY') AS detail,
           m.scheduled_date::timestamp AS ts
    FROM public.vehicle_maintenance m
    JOIN public.vehicles v ON v.id = m.vehicle_id
    WHERE m.status = 'scheduled' AND m.scheduled_date <= (CURRENT_DATE + INTERVAL '14 days')
    UNION ALL
    SELECT 'payment', 'Pago pendiente', 'Reserva ' || substr(p.reservation_id::text, 1, 8), p.created_at
    FROM public.payments p WHERE p.status = 'pending'
    UNION ALL
    SELECT 'ticket', 'Ticket abierto: ' || s.subject, s.name, s.created_at
    FROM public.support_tickets s WHERE s.status IN ('open','in_progress')
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object('kind', kind, 'title', title, 'detail', detail, 'ts', ts) ORDER BY ts DESC), '[]'::jsonb)
  INTO v_alerts FROM (SELECT * FROM a ORDER BY ts DESC LIMIT 10) x;

  -- Recent users
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'user_id', user_id,
    'full_name', full_name,
    'created_at', created_at,
    'last_login_at', last_login_at
  ) ORDER BY created_at DESC), '[]'::jsonb)
  INTO v_recent_users
  FROM (SELECT user_id, full_name, created_at, last_login_at FROM public.profiles ORDER BY created_at DESC LIMIT 10) p;

  RETURN jsonb_build_object(
    'kpis', jsonb_build_object(
      'total_revenue', v_total_revenue,
      'commissions', v_commissions,
      'insurance', v_insurance,
      'active', v_active,
      'pending', v_pending,
      'completed', v_completed,
      'cancelled', v_cancelled,
      'total_reservations', v_total_res,
      'cancellation_rate', CASE WHEN v_total_res > 0 THEN ROUND((v_cancelled::numeric / v_total_res) * 100, 1) ELSE 0 END,
      'avg_revenue_per_car', v_avg_rev_per_car,
      'nps', COALESCE(v_nps, 0),
      'open_tickets', v_open_tickets,
      'closed_tickets', v_closed_tickets,
      'new_users', v_new_users,
      'total_vehicles', v_total_vehicles
    ),
    'revenue_series', v_revenue_series,
    'top_cars', v_top_cars,
    'bottom_cars', v_bottom_cars,
    'distribution', v_distribution,
    'recent_reservations', v_recent_reservations,
    'alerts', v_alerts,
    'recent_users', v_recent_users
  );
END;
$$;
