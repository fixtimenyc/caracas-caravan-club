import { useEffect, useMemo, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { format, differenceInHours } from "date-fns";
import { es } from "date-fns/locale";
import {
  Calendar,
  ClipboardCheck,
  Loader2,
  Car,
  MessageCircle,
  User as UserIcon,
  Check,
  X,
  PlayCircle,
  Flag,
  Settings2,
  MapPin,
  Phone,
} from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { resolveVehiclePhoto } from "@/lib/vehiclePhoto";
import { getOrCreateConversation } from "@/lib/conversations";
import { toast } from "sonner";

const STATUS_META: Record<string, { label: string; cls: string }> = {
  pending: { label: "Pendiente", cls: "bg-yellow-500/10 text-yellow-700 border-yellow-500/30" },
  approved: { label: "Aprobada", cls: "bg-emerald-500/10 text-emerald-700 border-emerald-500/30" },
  active: { label: "Activa", cls: "bg-blue-500/10 text-blue-700 border-blue-500/30" },
  completed: { label: "Completada", cls: "bg-muted text-muted-foreground border-border" },
  cancelled: { label: "Cancelada", cls: "bg-red-500/10 text-red-700 border-red-500/30" },
  rejected: { label: "Rechazada", cls: "bg-red-500/10 text-red-700 border-red-500/30" },
};

const MyBookingsPage = () => {
  const { user, roles, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const isOwner = roles.includes("owner") || roles.includes("admin");
  const [loading, setLoading] = useState(true);
  const [reservations, setReservations] = useState<any[]>([]);
  const [ownerReservations, setOwnerReservations] = useState<any[]>([]);
  const [vehicles, setVehicles] = useState<Record<string, any>>({});
  const [vehiclePhotos, setVehiclePhotos] = useState<Record<string, string>>({});
  const [renters, setRenters] = useState<Record<string, any>>({});
  const [pickupDone, setPickupDone] = useState<Set<string>>(new Set());
  const [returnDone, setReturnDone] = useState<Set<string>>(new Set());
  const [manageReservation, setManageReservation] = useState<any>(null);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      // Renter reservations
      const { data: rs } = await supabase
        .from("reservations")
        .select("*")
        .eq("renter_id", user.id)
        .order("start_date", { ascending: false });
      const list = rs || [];
      setReservations(list);

      // Owner reservations (via their vehicles)
      let ownerList: any[] = [];
      if (isOwner) {
        const { data: myVehicles } = await supabase
          .from("vehicles")
          .select("id")
          .eq("owner_id", user.id);
        const myVehIds = (myVehicles || []).map((v) => v.id);
        if (myVehIds.length) {
          const { data: ors } = await supabase
            .from("reservations")
            .select("*")
            .in("vehicle_id", myVehIds)
            .order("start_date", { ascending: false });
          ownerList = ors || [];
        }
        setOwnerReservations(ownerList);
      }

      const allVehIds = Array.from(
        new Set([...list.map((r) => r.vehicle_id), ...ownerList.map((r) => r.vehicle_id)]),
      );
      if (allVehIds.length) {
        const { data: vs } = await supabase
          .from("vehicles")
          .select("id, brand, model, year, photos, location, owner_id")
          .in("id", allVehIds);
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

      // Renters (for owner-side reservations)
      const renterIds = Array.from(new Set(ownerList.map((r) => r.renter_id)));
      if (renterIds.length) {
        const { data: ps } = await supabase
          .from("profiles")
          .select("id, full_name, avatar_url, phone")
          .in("id", renterIds);
        const rmap: Record<string, any> = {};
        (ps || []).forEach((p) => (rmap[p.id] = p));
        setRenters(rmap);
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
  }, [user, isOwner]);

  const grouped = useMemo(() => {
    const upcoming = reservations.filter((r) => ["approved", "active", "pending"].includes(r.status));
    const past = reservations.filter((r) => ["completed", "cancelled", "rejected"].includes(r.status));
    return { upcoming, past };
  }, [reservations]);

  const ownerGrouped = useMemo(() => {
    const pending = ownerReservations.filter((r) => r.status === "pending");
    const active = ownerReservations.filter((r) => ["approved", "active"].includes(r.status));
    const past = ownerReservations.filter((r) => ["completed", "cancelled", "rejected"].includes(r.status));
    return { pending, active, past };
  }, [ownerReservations]);

  const contactRenter = async (r: any) => {
    if (!user) return;
    try {
      const convId = await getOrCreateConversation({
        renterId: r.renter_id,
        ownerId: user.id,
        vehicleId: r.vehicle_id,
        reservationId: r.id,
      });
      navigate(`/mensajes?c=${convId}`);
    } catch {
      toast.error("No se pudo abrir la conversación");
    }
  };

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

  const OwnerRow = ({ r }: { r: any }) => {
    const v = vehicles[r.vehicle_id];
    const renter = renters[r.renter_id];
    const meta = STATUS_META[r.status] || STATUS_META.pending;
    const days = Math.max(
      1,
      Math.ceil(
        (new Date(r.end_date).getTime() - new Date(r.start_date).getTime()) /
          (1000 * 60 * 60 * 24),
      ),
    );
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
            <div className="min-w-0 flex-1">
              <p className="font-semibold truncate">
                {v ? `${v.brand} ${v.model} ${v.year}` : "Vehículo"}
              </p>
              <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                <UserIcon className="h-3 w-3" />
                {renter?.full_name || "Arrendatario"}
                {renter?.phone && <span className="ml-1">· {renter.phone}</span>}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {format(new Date(r.start_date), "d MMM", { locale: es })} →{" "}
                {format(new Date(r.end_date), "d MMM yyyy", { locale: es })} · {days} día{days > 1 ? "s" : ""}
              </p>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <Badge variant="outline" className={meta.cls}>{meta.label}</Badge>
                <span className="text-xs text-muted-foreground">
                  Total ${Number(r.total_price).toFixed(2)} · Neto ${(Number(r.total_price) * 0.7).toFixed(2)}
                </span>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 md:justify-end">
            <Button size="sm" variant="outline" onClick={() => contactRenter(r)}>
              <MessageCircle className="h-4 w-4 mr-1" /> Contactar
            </Button>
            <Button size="sm" variant="ghost" onClick={() => navigate("/mis-vehiculos")}>
              Gestionar
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  };

  const hasRenterReservations = reservations.length > 0;
  const hasOwnerReservations = ownerReservations.length > 0;

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
        ) : (
          <div className="space-y-10">
            {isOwner && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-semibold">Reservas de mis vehículos</h2>
                  <Button variant="ghost" size="sm" onClick={() => navigate("/mis-vehiculos")}>
                    Ir al panel
                  </Button>
                </div>
                {!hasOwnerReservations ? (
                  <div className="rounded-xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
                    Aún no tienes reservas en tus vehículos.
                  </div>
                ) : (
                  <>
                    {ownerGrouped.pending.length > 0 && (
                      <section>
                        <h3 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wide">Pendientes de aprobación</h3>
                        <div className="space-y-3">
                          {ownerGrouped.pending.map((r) => <OwnerRow key={r.id} r={r} />)}
                        </div>
                      </section>
                    )}
                    {ownerGrouped.active.length > 0 && (
                      <section>
                        <h3 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wide">Confirmadas y activas</h3>
                        <div className="space-y-3">
                          {ownerGrouped.active.map((r) => <OwnerRow key={r.id} r={r} />)}
                        </div>
                      </section>
                    )}
                    {ownerGrouped.past.length > 0 && (
                      <section>
                        <h3 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wide">Historial</h3>
                        <div className="space-y-3">
                          {ownerGrouped.past.map((r) => <OwnerRow key={r.id} r={r} />)}
                        </div>
                      </section>
                    )}
                  </>
                )}
              </div>
            )}

            <div className="space-y-6">
              {isOwner && <h2 className="text-xl font-semibold">Mis alquileres</h2>}
              {!hasRenterReservations ? (
                <div className="rounded-xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
                  Aún no has alquilado vehículos.
                </div>
              ) : (
                <>
                  {grouped.upcoming.length > 0 && (
                    <section>
                      <h3 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wide">Próximas y activas</h3>
                      <div className="space-y-3">
                        {grouped.upcoming.map((r) => <Row key={r.id} r={r} />)}
                      </div>
                    </section>
                  )}
                  {grouped.past.length > 0 && (
                    <section>
                      <h3 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wide">Historial</h3>
                      <div className="space-y-3">
                        {grouped.past.map((r) => <Row key={r.id} r={r} />)}
                      </div>
                    </section>
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
};

export default MyBookingsPage;
