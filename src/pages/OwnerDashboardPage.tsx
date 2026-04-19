import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { format, isFuture, isPast, differenceInHours } from "date-fns";
import { es } from "date-fns/locale";
import {
  Car,
  CalendarDays,
  DollarSign,
  TrendingUp,
  Eye,
  Pencil,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Plus,
  Check,
  X,
} from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Vehicle = {
  id: string;
  brand: string;
  model: string;
  year: number;
  location: string;
  price_per_day: number;
  active: boolean;
  available: boolean;
  photos: string[] | null;
};

type Reservation = {
  id: string;
  vehicle_id: string;
  start_date: string;
  end_date: string;
  total_price: number;
  status: "pending" | "approved" | "rejected" | "completed" | "cancelled";
  renter_id: string;
  created_at: string;
};

type PendingApp = {
  id: string;
  vehicle_brand: string;
  vehicle_model: string;
  vehicle_year: number;
  city: string;
  suggested_price_per_day: number;
  status: "pending" | "approved" | "rejected";
  created_at: string;
};

const OwnerDashboardPage = () => {
  const { user, roles, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [pendingApps, setPendingApps] = useState<PendingApp[]>([]);
  const [selectedReservation, setSelectedReservation] =
    useState<Reservation | null>(null);

  useEffect(() => {
    if (!authLoading && !user) navigate("/auth");
  }, [authLoading, user, navigate]);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      setLoading(true);
      const [vehRes, appRes] = await Promise.all([
        supabase
          .from("vehicles")
          .select("*")
          .eq("owner_id", user.id)
          .order("created_at", { ascending: false }),
        supabase
          .from("owner_applications")
          .select("id, vehicle_brand, vehicle_model, vehicle_year, city, suggested_price_per_day, status, created_at")
          .eq("user_id", user.id)
          .neq("status", "approved")
          .order("created_at", { ascending: false }),
      ]);

      if (vehRes.error) toast.error("Error cargando vehículos");
      if (appRes.error) toast.error("Error cargando solicitudes");

      const vehs = (vehRes.data || []) as Vehicle[];
      setVehicles(vehs);
      setPendingApps((appRes.data || []) as PendingApp[]);

      if (vehs.length > 0) {
        const ids = vehs.map((v) => v.id);
        const { data: resData, error } = await supabase
          .from("reservations")
          .select("*")
          .in("vehicle_id", ids)
          .order("start_date", { ascending: false });
        if (error) toast.error("Error cargando reservas");
        setReservations((resData || []) as Reservation[]);
      } else {
        setReservations([]);
      }
      setLoading(false);
    };
    load();
  }, [user]);

  const earnings = useMemo(() => {
    const completed = reservations.filter((r) => r.status === "completed");
    const approved = reservations.filter((r) => r.status === "approved");
    const total = completed.reduce((s, r) => s + Number(r.total_price), 0);
    const pending = approved.reduce((s, r) => s + Number(r.total_price), 0);
    const ownerNet = total * 0.7; // 30% commission
    const now = new Date();
    const monthEarnings = completed
      .filter((r) => {
        const d = new Date(r.end_date);
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      })
      .reduce((s, r) => s + Number(r.total_price) * 0.7, 0);
    return { total, pending, ownerNet, monthEarnings };
  }, [reservations]);

  const upcomingByVehicle = (vehicleId: string) =>
    reservations.filter(
      (r) =>
        r.vehicle_id === vehicleId &&
        isFuture(new Date(r.start_date)) &&
        ["pending", "approved"].includes(r.status)
    );
  const pastByVehicle = (vehicleId: string) =>
    reservations.filter(
      (r) =>
        r.vehicle_id === vehicleId &&
        (isPast(new Date(r.end_date)) || r.status === "completed" || r.status === "cancelled")
    );

  const toggleAvailability = async (v: Vehicle) => {
    const newVal = !v.available;
    setVehicles((prev) =>
      prev.map((x) => (x.id === v.id ? { ...x, available: newVal } : x))
    );
    const { error } = await supabase
      .from("vehicles")
      .update({ available: newVal })
      .eq("id", v.id);
    if (error) {
      toast.error("No se pudo actualizar la disponibilidad");
      setVehicles((prev) =>
        prev.map((x) => (x.id === v.id ? { ...x, available: !newVal } : x))
      );
    } else {
      toast.success(newVal ? "Vehículo disponible" : "Vehículo pausado");
    }
  };

  const respondReservation = async (
    r: Reservation,
    decision: "approved" | "rejected"
  ) => {
    // 24-hour rule
    const hoursElapsed = differenceInHours(new Date(), new Date(r.created_at));
    if (hoursElapsed > 24) {
      toast.error("El plazo de 24 horas para responder ha expirado");
      return;
    }
    const { error } = await supabase
      .from("reservations")
      .update({ status: decision })
      .eq("id", r.id);
    if (error) {
      toast.error("No se pudo actualizar la reserva");
      return;
    }
    setReservations((prev) =>
      prev.map((x) => (x.id === r.id ? { ...x, status: decision } : x))
    );
    setSelectedReservation(null);
    // Notify renter
    await supabase.from("notifications").insert({
      user_id: r.renter_id,
      type: decision === "approved" ? "reservation_approved" : "reservation_rejected",
      title:
        decision === "approved"
          ? "¡Tu reserva fue aprobada!"
          : "Reserva rechazada",
      message: `${format(new Date(r.start_date), "d MMM", { locale: es })} → ${format(
        new Date(r.end_date),
        "d MMM yyyy",
        { locale: es }
      )}`,
      reservation_id: r.id,
      vehicle_id: r.vehicle_id,
    });
    toast.success(
      decision === "approved" ? "Reserva aprobada" : "Reserva rechazada"
    );
  };

  const hoursLeftForResponse = (r: Reservation) => {
    const elapsed = differenceInHours(new Date(), new Date(r.created_at));
    return Math.max(0, 24 - elapsed);
  };

  const getStatusBadge = (v: Vehicle) => {
    if (!v.active)
      return (
        <Badge variant="secondary" className="gap-1">
          <XCircle className="w-3 h-3" /> Inactivo
        </Badge>
      );
    if (!v.available)
      return (
        <Badge variant="outline" className="gap-1">
          <Clock className="w-3 h-3" /> Pausado
        </Badge>
      );
    return (
      <Badge className="gap-1 bg-primary text-primary-foreground">
        <CheckCircle2 className="w-3 h-3" /> Activo
      </Badge>
    );
  };

  const getReservationBadge = (status: Reservation["status"]) => {
    const map: Record<Reservation["status"], { label: string; className: string }> = {
      pending: { label: "Pendiente", className: "bg-accent/20 text-accent-foreground" },
      approved: { label: "Aprobada", className: "bg-primary/20 text-primary" },
      completed: { label: "Completada", className: "bg-secondary text-secondary-foreground" },
      rejected: { label: "Rechazada", className: "bg-destructive/10 text-destructive" },
      cancelled: { label: "Cancelada", className: "bg-muted text-muted-foreground" },
    };
    const { label, className } = map[status];
    return <Badge className={className} variant="secondary">{label}</Badge>;
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <main className="container mx-auto px-4 pt-24 pb-12 space-y-6">
          <Skeleton className="h-10 w-64" />
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-28" />
            ))}
          </div>
          <Skeleton className="h-64" />
        </main>
      </div>
    );
  }

  if (!roles.includes("owner") && !roles.includes("admin")) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <main className="container mx-auto px-4 pt-32 pb-12 text-center">
          <Card className="max-w-md mx-auto p-8">
            <AlertCircle className="w-12 h-12 text-accent mx-auto mb-4" />
            <h1 className="text-2xl font-bold mb-2">Acceso restringido</h1>
            <p className="text-muted-foreground mb-6">
              Necesitas ser Aliado para acceder al panel. Aplica para empezar a publicar tu vehículo.
            </p>
            <Button onClick={() => navigate("/conviertete-en-anfitrion")}>
              Convertirme en anfitrión
            </Button>
          </Card>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container mx-auto px-4 pt-24 pb-12">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-foreground">
              Panel del anfitrión
            </h1>
            <p className="text-muted-foreground mt-1">
              Administra tus vehículos, reservas e ingresos
            </p>
          </div>
          <Button
            onClick={() => navigate("/aliado/solicitud")}
            className="gap-2"
          >
            <Plus className="w-4 h-4" />
            Publicar otro vehículo
          </Button>
        </div>

        {/* Earnings Summary */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card className="p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">Ingresos netos</span>
              <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                <DollarSign className="w-4 h-4 text-primary" />
              </div>
            </div>
            <p className="text-2xl font-bold text-foreground">
              ${earnings.ownerNet.toFixed(2)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Después de comisión 30%
            </p>
          </Card>

          <Card className="p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">Este mes</span>
              <div className="w-9 h-9 rounded-lg bg-accent/20 flex items-center justify-center">
                <TrendingUp className="w-4 h-4 text-accent" />
              </div>
            </div>
            <p className="text-2xl font-bold text-foreground">
              ${earnings.monthEarnings.toFixed(2)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Ingresos del mes
            </p>
          </Card>

          <Card className="p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">Pendiente</span>
              <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center">
                <Clock className="w-4 h-4 text-muted-foreground" />
              </div>
            </div>
            <p className="text-2xl font-bold text-foreground">
              ${(earnings.pending * 0.7).toFixed(2)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Reservas aprobadas sin completar
            </p>
          </Card>

          <Card className="p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">Vehículos</span>
              <div className="w-9 h-9 rounded-lg bg-secondary flex items-center justify-center">
                <Car className="w-4 h-4 text-secondary-foreground" />
              </div>
            </div>
            <p className="text-2xl font-bold text-foreground">{vehicles.length}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {vehicles.filter((v) => v.active && v.available).length} activos
            </p>
          </Card>
        </div>

        {/* Pending applications */}
        {pendingApps.length > 0 && (
          <Card className="p-5 mb-8 border-accent/30">
            <h2 className="text-lg font-bold mb-3 flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-accent" />
              Solicitudes en revisión
            </h2>
            <div className="space-y-2">
              {pendingApps.map((app) => (
                <div
                  key={app.id}
                  className="flex items-center justify-between p-3 bg-muted/40 rounded-lg"
                >
                  <div>
                    <p className="font-semibold text-foreground">
                      {app.vehicle_brand} {app.vehicle_model} {app.vehicle_year}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {app.city} · ${app.suggested_price_per_day}/día · Enviada{" "}
                      {format(new Date(app.created_at), "PPP", { locale: es })}
                    </p>
                  </div>
                  <Badge
                    className={
                      app.status === "rejected"
                        ? "bg-destructive/10 text-destructive"
                        : "bg-accent/20 text-accent-foreground"
                    }
                    variant="secondary"
                  >
                    {app.status === "pending" ? "En revisión" : "Rechazada"}
                  </Badge>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Vehicles */}
        <h2 className="text-2xl font-bold text-foreground mb-4">
          Mis vehículos publicados
        </h2>

        {vehicles.length === 0 ? (
          <Card className="p-12 text-center">
            <Car className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">
              Aún no tienes vehículos publicados
            </h3>
            <p className="text-muted-foreground mb-6">
              Aplica como Aliado para publicar tu primer vehículo
            </p>
            <Button onClick={() => navigate("/aliado/solicitud")}>
              Empezar solicitud
            </Button>
          </Card>
        ) : (
          <div className="space-y-6">
            {vehicles.map((v) => {
              const upcoming = upcomingByVehicle(v.id);
              const past = pastByVehicle(v.id);
              const vehEarnings = past
                .filter((r) => r.status === "completed")
                .reduce((s, r) => s + Number(r.total_price) * 0.7, 0);
              return (
                <Card key={v.id} className="overflow-hidden">
                  <div className="grid md:grid-cols-[200px_1fr] gap-0">
                    {/* Image */}
                    <div className="relative bg-muted aspect-[4/3] md:aspect-auto">
                      {v.photos?.[0] ? (
                        <img
                          src={
                            v.photos[0].startsWith("http")
                              ? v.photos[0]
                              : `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/vehicle-photos/${v.photos[0]}`
                          }
                          alt={`${v.brand} ${v.model}`}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Car className="w-12 h-12 text-muted-foreground" />
                        </div>
                      )}
                    </div>

                    {/* Content */}
                    <div className="p-5">
                      <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="text-xl font-bold text-foreground">
                              {v.brand} {v.model} {v.year}
                            </h3>
                            {getStatusBadge(v)}
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {v.location} · ${v.price_per_day}/día · Ganaste $
                            {vehEarnings.toFixed(2)}
                          </p>
                        </div>

                        {/* Quick actions */}
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="flex items-center gap-2 px-3 py-1.5 border border-border rounded-lg">
                            <Switch
                              checked={v.available}
                              onCheckedChange={() => toggleAvailability(v)}
                            />
                            <span className="text-xs font-medium">
                              {v.available ? "Disponible" : "Pausado"}
                            </span>
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => navigate(`/vehiculo/${v.id}`)}
                          >
                            <Eye className="w-4 h-4 mr-1" /> Ver
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              toast.info("Próximamente: editar vehículo")
                            }
                          >
                            <Pencil className="w-4 h-4 mr-1" /> Editar
                          </Button>
                        </div>
                      </div>

                      {/* Bookings tabs */}
                      <Tabs defaultValue="upcoming" className="mt-4">
                        <TabsList>
                          <TabsTrigger value="upcoming">
                            Próximas ({upcoming.length})
                          </TabsTrigger>
                          <TabsTrigger value="past">
                            Pasadas ({past.length})
                          </TabsTrigger>
                        </TabsList>

                        <TabsContent value="upcoming" className="mt-3">
                          {upcoming.length === 0 ? (
                            <p className="text-sm text-muted-foreground py-4 text-center">
                              Sin reservas próximas
                            </p>
                          ) : (
                            <div className="space-y-2">
                              {upcoming.map((r) => (
                                <BookingRow
                                  key={r.id}
                                  reservation={r}
                                  onView={() => setSelectedReservation(r)}
                                  badge={getReservationBadge(r.status)}
                                  hoursLeft={hoursLeftForResponse(r)}
                                  onAccept={
                                    r.status === "pending"
                                      ? () => respondReservation(r, "approved")
                                      : undefined
                                  }
                                  onDecline={
                                    r.status === "pending"
                                      ? () => respondReservation(r, "rejected")
                                      : undefined
                                  }
                                />
                              ))}
                            </div>
                          )}
                        </TabsContent>

                        <TabsContent value="past" className="mt-3">
                          {past.length === 0 ? (
                            <p className="text-sm text-muted-foreground py-4 text-center">
                              Sin reservas pasadas
                            </p>
                          ) : (
                            <div className="space-y-2">
                              {past.slice(0, 5).map((r) => (
                                <BookingRow
                                  key={r.id}
                                  reservation={r}
                                  onView={() => setSelectedReservation(r)}
                                  badge={getReservationBadge(r.status)}
                                />
                              ))}
                            </div>
                          )}
                        </TabsContent>
                      </Tabs>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}

        {/* Booking detail dialog */}
        <Dialog
          open={!!selectedReservation}
          onOpenChange={() => setSelectedReservation(null)}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Detalle de la reserva</DialogTitle>
              <DialogDescription>
                Información completa del booking
              </DialogDescription>
            </DialogHeader>
            {selectedReservation && (
              <div className="space-y-3 text-sm">
                <DetailRow
                  label="Estado"
                  value={getReservationBadge(selectedReservation.status)}
                />
                <DetailRow
                  label="Inicio"
                  value={format(new Date(selectedReservation.start_date), "PPP", { locale: es })}
                />
                <DetailRow
                  label="Fin"
                  value={format(new Date(selectedReservation.end_date), "PPP", { locale: es })}
                />
                <DetailRow
                  label="Total"
                  value={`$${Number(selectedReservation.total_price).toFixed(2)}`}
                />
                <DetailRow
                  label="Tu ingreso (70%)"
                  value={`$${(Number(selectedReservation.total_price) * 0.7).toFixed(2)}`}
                />
                <DetailRow
                  label="Reservada"
                  value={format(new Date(selectedReservation.created_at), "PPP", { locale: es })}
                />
                <DetailRow
                  label="ID arrendatario"
                  value={
                    <code className="text-xs">
                      {selectedReservation.renter_id.slice(0, 8)}…
                    </code>
                  }
                />
                {selectedReservation.status === "pending" && (
                  <div className="pt-3">
                    {hoursLeftForResponse(selectedReservation) > 0 ? (
                      <>
                        <p className="text-xs text-muted-foreground mb-3">
                          Tienes {hoursLeftForResponse(selectedReservation)}h para responder esta solicitud.
                        </p>
                        <div className="flex gap-2">
                          <Button
                            className="flex-1"
                            onClick={() => respondReservation(selectedReservation, "approved")}
                          >
                            <Check className="w-4 h-4 mr-1" /> Aceptar
                          </Button>
                          <Button
                            variant="outline"
                            className="flex-1 text-destructive"
                            onClick={() => respondReservation(selectedReservation, "rejected")}
                          >
                            <X className="w-4 h-4 mr-1" /> Rechazar
                          </Button>
                        </div>
                      </>
                    ) : (
                      <p className="text-xs text-destructive">
                        El plazo de 24 horas ha expirado.
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </main>
      <Footer />
    </div>
  );
};

const DetailRow = ({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) => (
  <div className="flex items-center justify-between py-2 border-b border-border last:border-0">
    <span className="text-muted-foreground">{label}</span>
    <span className="font-medium text-foreground">{value}</span>
  </div>
);

const BookingRow = ({
  reservation,
  onView,
  badge,
  hoursLeft,
  onAccept,
  onDecline,
}: {
  reservation: Reservation;
  onView: () => void;
  badge: React.ReactNode;
  hoursLeft?: number;
  onAccept?: () => void;
  onDecline?: () => void;
}) => {
  const showActions =
    onAccept && onDecline && reservation.status === "pending" && (hoursLeft ?? 0) > 0;
  const expired =
    reservation.status === "pending" && (hoursLeft ?? 0) <= 0;
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-muted/40 rounded-lg">
      <div className="flex items-center gap-3">
        <CalendarDays className="w-4 h-4 text-primary shrink-0" />
        <div>
          <p className="text-sm font-medium text-foreground">
            {format(new Date(reservation.start_date), "d MMM", { locale: es })} →{" "}
            {format(new Date(reservation.end_date), "d MMM yyyy", { locale: es })}
          </p>
          <p className="text-xs text-muted-foreground">
            ${Number(reservation.total_price).toFixed(2)} · ganas $
            {(Number(reservation.total_price) * 0.7).toFixed(2)}
            {reservation.status === "pending" && hoursLeft !== undefined && (
              <span className={expired ? "text-destructive ml-1" : "text-accent ml-1"}>
                · {expired ? "Plazo vencido" : `${hoursLeft}h restantes`}
              </span>
            )}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {badge}
        {showActions && (
          <>
            <Button
              size="sm"
              onClick={onAccept}
              className="bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              <Check className="w-4 h-4 mr-1" /> Aceptar
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={onDecline}
              className="text-destructive hover:bg-destructive/10"
            >
              <X className="w-4 h-4 mr-1" /> Rechazar
            </Button>
          </>
        )}
        <Button size="sm" variant="ghost" onClick={onView}>
          <Eye className="w-4 h-4 mr-1" /> Ver
        </Button>
      </div>
    </div>
  );
};

export default OwnerDashboardPage;
