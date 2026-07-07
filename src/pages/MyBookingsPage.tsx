import { useEffect, useMemo, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Calendar, ClipboardCheck, Loader2, Car } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { resolveVehiclePhoto } from "@/lib/vehiclePhoto";

const STATUS_META: Record<string, { label: string; cls: string }> = {
  pending: { label: "Pendiente", cls: "bg-yellow-500/10 text-yellow-700 border-yellow-500/30" },
  approved: { label: "Aprobada", cls: "bg-emerald-500/10 text-emerald-700 border-emerald-500/30" },
  active: { label: "Activa", cls: "bg-blue-500/10 text-blue-700 border-blue-500/30" },
  completed: { label: "Completada", cls: "bg-muted text-muted-foreground border-border" },
  cancelled: { label: "Cancelada", cls: "bg-red-500/10 text-red-700 border-red-500/30" },
  rejected: { label: "Rechazada", cls: "bg-red-500/10 text-red-700 border-red-500/30" },
};

const MyBookingsPage = () => {
  const { user, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [reservations, setReservations] = useState<any[]>([]);
  const [vehicles, setVehicles] = useState<Record<string, any>>({});
  const [vehiclePhotos, setVehiclePhotos] = useState<Record<string, string>>({});
  const [pickupDone, setPickupDone] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      const { data: rs } = await supabase
        .from("reservations")
        .select("*")
        .eq("renter_id", user.id)
        .order("start_date", { ascending: false });
      const list = rs || [];
      setReservations(list);
      const ids = Array.from(new Set(list.map((r) => r.vehicle_id)));
      if (ids.length) {
        const { data: vs } = await supabase
          .from("vehicles")
          .select("id, brand, model, year, photos, location")
          .in("id", ids);
        const map: Record<string, any> = {};
        (vs || []).forEach((v) => (map[v.id] = v));
        setVehicles(map);
        const photos = await Promise.all(
          (vs || []).map(async (v: any) => [
            v.id,
            await resolveVehiclePhoto(Array.isArray(v.photos) ? v.photos[0] : null),
          ] as const),
        );
        setVehiclePhotos(Object.fromEntries(photos));
      } else {
        setVehicles({});
        setVehiclePhotos({});
      }
      const resIds = list.map((r) => r.id);
      if (resIds.length) {
        const { data: ins } = await supabase
          .from("vehicle_inspections")
          .select("reservation_id, type")
          .in("reservation_id", resIds)
          .eq("type", "pickup");
        setPickupDone(new Set((ins || []).map((i) => i.reservation_id)));
      }
      setLoading(false);
    })();
  }, [user]);

  const grouped = useMemo(() => {
    const upcoming = reservations.filter((r) => ["approved", "active", "pending"].includes(r.status));
    const past = reservations.filter((r) => ["completed", "cancelled", "rejected"].includes(r.status));
    return { upcoming, past };
  }, [reservations]);

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!user) return <Navigate to="/auth" replace />;

  const Row = ({ r }: { r: any }) => {
    const v = vehicles[r.vehicle_id];
    const meta = STATUS_META[r.status] || STATUS_META.pending;
    const canInspect = ["approved", "active"].includes(r.status);
    const inspected = pickupDone.has(r.id);
    return (
      <Card>
        <CardContent className="p-4 flex flex-col md:flex-row md:items-center gap-4">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="w-16 h-16 rounded-md bg-muted overflow-hidden flex-shrink-0">
              {v && vehiclePhotos[v.id] ? (
                <img src={vehiclePhotos[v.id]} alt={`${v.brand} ${v.model}`} className="w-full h-full object-cover" />
              ) : (
                <Car className="w-full h-full p-4 text-muted-foreground" />
              )}
            </div>
            <div className="min-w-0">
              <p className="font-semibold truncate">
                {v ? `${v.brand} ${v.model} ${v.year}` : "Vehículo"}
              </p>
              <p className="text-xs text-muted-foreground">
                {format(new Date(r.start_date), "d MMM", { locale: es })} →{" "}
                {format(new Date(r.end_date), "d MMM yyyy", { locale: es })}
              </p>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="outline" className={meta.cls}>{meta.label}</Badge>
                <span className="text-xs text-muted-foreground">
                  ${Number(r.total_price).toFixed(2)}
                </span>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 md:justify-end">
            {canInspect && (
              <Link to={`/reservas/${r.id}/inspeccion-entrega`}>
                <Button size="sm" variant={inspected ? "outline" : "default"}>
                  <ClipboardCheck className="h-4 w-4 mr-1" />
                  {inspected ? "Ver inspección" : "Confirmar entrega"}
                </Button>
              </Link>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1 container mx-auto px-4 pt-24 pb-16 max-w-4xl">
        <div className="flex items-center gap-3 mb-6">
          <Calendar className="w-7 h-7 text-primary" />
          <h1 className="text-3xl font-bold">Mis reservas</h1>
        </div>
        {loading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : reservations.length === 0 ? (
          <div className="rounded-xl border border-border bg-card p-10 text-center">
            <p className="text-muted-foreground">Aún no tienes reservas.</p>
          </div>
        ) : (
          <div className="space-y-8">
            {grouped.upcoming.length > 0 && (
              <section>
                <h2 className="text-lg font-semibold mb-3">Próximas y activas</h2>
                <div className="space-y-3">
                  {grouped.upcoming.map((r) => <Row key={r.id} r={r} />)}
                </div>
              </section>
            )}
            {grouped.past.length > 0 && (
              <section>
                <h2 className="text-lg font-semibold mb-3">Historial</h2>
                <div className="space-y-3">
                  {grouped.past.map((r) => <Row key={r.id} r={r} />)}
                </div>
              </section>
            )}
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
};

export default MyBookingsPage;
