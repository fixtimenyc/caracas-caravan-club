import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import {
  ArrowLeft,
  Phone,
  Mail,
  MessageSquare,
  Pencil,
  Printer,
  PauseCircle,
  PlayCircle,
  AlertCircle,
  Wrench,
  ChevronLeft,
  ChevronRight,
  Star,
  FileText,
  CalendarDays,
  CheckCircle2,
  XCircle,
  Clock,
  MapPin,
} from "lucide-react";
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  parseISO,
  subMonths,
  differenceInDays,
} from "date-fns";
import { es } from "date-fns/locale";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RTooltip,
} from "recharts";
import AdminLayout from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { resolveVehiclePhotos } from "@/lib/vehiclePhoto";
import { toast } from "sonner";

type Vehicle = any;
type Reservation = any;
type Maintenance = any;
type Review = any;
type Application = any;
type Profile = any;

const STATUS_LABEL: Record<string, string> = {
  pending: "Pendiente",
  approved: "Aprobada",
  active: "Activa",
  completed: "Completada",
  cancelled: "Cancelada",
  rejected: "Rechazada",
};

const STATUS_COLOR: Record<string, string> = {
  pending: "bg-amber-500",
  approved: "bg-blue-500",
  active: "bg-emerald-500",
  completed: "bg-slate-500",
  cancelled: "bg-rose-500",
  rejected: "bg-rose-700",
};

function expiryBadge(date?: string | null) {
  if (!date) return <Badge variant="outline">Sin fecha</Badge>;
  const d = parseISO(date);
  const days = differenceInDays(d, new Date());
  if (days < 0) return <Badge variant="destructive">Vencido</Badge>;
  if (days <= 30) return <Badge className="bg-amber-500">Vence en {days}d</Badge>;
  return <Badge variant="secondary">Vigente</Badge>;
}

export default function AdminVehicleDetailPage() {
  const { vehicleId } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [owner, setOwner] = useState<Profile | null>(null);
  const [application, setApplication] = useState<Application | null>(null);
  const [photos, setPhotos] = useState<string[]>([]);
  const [photoIdx, setPhotoIdx] = useState(0);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [maintenance, setMaintenance] = useState<Maintenance[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [calMonth, setCalMonth] = useState(new Date());
  const [dayDialog, setDayDialog] = useState<Date | null>(null);
  const [maintDialog, setMaintDialog] = useState<null | "scheduled" | "urgent">(null);
  const [maintForm, setMaintForm] = useState({ type: "Inspección general", date: "", notes: "" });
  const [notesDraft, setNotesDraft] = useState("");

  useEffect(() => {
    if (!vehicleId) return;
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vehicleId]);

  async function load() {
    setLoading(true);
    const { data: v } = await supabase.from("vehicles").select("*").eq("id", vehicleId).maybeSingle();
    if (!v) {
      toast.error("Vehículo no encontrado");
      setLoading(false);
      return;
    }
    setVehicle(v);
    setNotesDraft((v as any).internal_notes ?? "");

    const [{ data: prof }, { data: app }, { data: res }, { data: maint }, { data: rev }] = await Promise.all([
      supabase.from("profiles").select("*").eq("user_id", v.owner_id).maybeSingle(),
      supabase
        .from("owner_applications")
        .select("*")
        .eq("user_id", v.owner_id)
        .eq("status", "approved")
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("reservations")
        .select("id, start_date, end_date, status, total_price, renter_id, created_at")
        .eq("vehicle_id", v.id)
        .order("start_date", { ascending: false }),
      supabase
        .from("vehicle_maintenance")
        .select("*")
        .eq("vehicle_id", v.id)
        .order("scheduled_date", { ascending: false }),
      supabase
        .from("reviews")
        .select("id, rating, comment, created_at, reviewer_type, author_id")
        .eq("vehicle_id", v.id)
        .order("created_at", { ascending: false }),
    ]);
    setOwner(prof);
    setApplication(app);
    setReservations(res ?? []);
    setMaintenance(maint ?? []);
    setReviews(rev ?? []);

    const urls = await resolveVehiclePhotos(v.photos ?? [], "/placeholder.svg");
    setPhotos(urls);
    setPhotoIdx(0);

    // Hydrate renter names
    const renterIds = Array.from(new Set((res ?? []).map((r: any) => r.renter_id))).filter(Boolean);
    if (renterIds.length) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("user_id, full_name")
        .in("user_id", renterIds);
      const map = new Map<string, string>((profs ?? []).map((p: any) => [p.user_id, p.full_name]));
      setReservations((prev) => prev.map((r: any) => ({ ...r, renter_name: map.get(r.renter_id) ?? "Usuario" })));
    }
    setLoading(false);
  }

  const status = useMemo(() => {
    if (!vehicle) return "inactive";
    const hasOpenMaint = maintenance.some((m) => m.status === "scheduled" || m.status === "in_progress");
    if (hasOpenMaint) return "maintenance";
    if (!vehicle.active) return "inactive";
    if (!vehicle.available) return "paused";
    return "active";
  }, [vehicle, maintenance]);

  const monthlyRevenue = useMemo(() => {
    const months = Array.from({ length: 6 }, (_, i) => subMonths(new Date(), 5 - i));
    return months.map((m) => {
      const total = reservations
        .filter((r) => ["completed", "active"].includes(r.status))
        .filter((r) => isSameMonth(parseISO(r.start_date), m))
        .reduce((acc, r) => acc + Number(r.total_price ?? 0), 0);
      return { month: format(m, "MMM yy", { locale: es }), revenue: Math.round(total) };
    });
  }, [reservations]);

  const ratingSummary = useMemo(() => {
    const renterReviews = reviews.filter((r) => r.reviewer_type === "renter");
    const total = renterReviews.length;
    const avg = total
      ? renterReviews.reduce((acc, r) => acc + (r.rating ?? 0), 0) / total
      : 0;
    const dist = [5, 4, 3, 2, 1].map((s) => ({
      star: s,
      count: renterReviews.filter((r) => r.rating === s).length,
    }));
    return { total, avg, dist };
  }, [reviews]);

  const calendarDays = useMemo(() => {
    const start = startOfWeek(startOfMonth(calMonth), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(calMonth), { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
  }, [calMonth]);

  function reservationsForDay(day: Date) {
    return reservations.filter((r) => {
      const s = parseISO(r.start_date);
      const e = parseISO(r.end_date);
      return day >= s && day <= e;
    });
  }

  async function setReservationStatus(id: string, newStatus: string) {
    const { error } = await supabase.from("reservations").update({ status: newStatus }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Reserva actualizada");
    setReservations((prev) => prev.map((r) => (r.id === id ? { ...r, status: newStatus } : r)));
  }

  async function togglePause() {
    if (!vehicle) return;
    const { error } = await supabase.from("vehicles").update({ available: !vehicle.available }).eq("id", vehicle.id);
    if (error) return toast.error(error.message);
    setVehicle({ ...vehicle, available: !vehicle.available });
    toast.success(vehicle.available ? "Auto pausado" : "Auto reanudado");
  }

  async function setActive(value: boolean) {
    if (!vehicle) return;
    const { error } = await supabase.from("vehicles").update({ active: value }).eq("id", vehicle.id);
    if (error) return toast.error(error.message);
    setVehicle({ ...vehicle, active: value });
    toast.success(value ? "Auto reactivado" : "Auto desactivado");
  }

  async function saveNotes() {
    if (!vehicle) return;
    const { error } = await supabase.from("vehicles").update({ internal_notes: notesDraft }).eq("id", vehicle.id);
    if (error) return toast.error(error.message);
    toast.success("Notas guardadas");
    setVehicle({ ...vehicle, internal_notes: notesDraft });
  }

  async function createMaintenance() {
    if (!vehicle || !maintForm.date) {
      toast.error("Indica una fecha");
      return;
    }
    const { error } = await supabase.from("vehicle_maintenance").insert({
      vehicle_id: vehicle.id,
      type: maintForm.type,
      scheduled_date: maintForm.date,
      notes: maintDialog === "urgent" ? `[URGENTE] ${maintForm.notes}` : maintForm.notes,
      status: "scheduled",
    });
    if (error) return toast.error(error.message);
    toast.success("Mantenimiento programado");
    setMaintDialog(null);
    setMaintForm({ type: "Inspección general", date: "", notes: "" });
    void load();
  }

  function contactOwner(via: "wa" | "tel" | "mail") {
    if (!owner) return;
    if (via === "wa" && owner.phone) {
      const num = owner.phone.replace(/\D/g, "");
      window.open(`https://wa.me/${num}`, "_blank");
    } else if (via === "tel" && owner.phone) {
      window.location.href = `tel:${owner.phone}`;
    } else if (via === "mail") {
      // email lives on auth.users; admins can use admin panel; placeholder
      toast.info("Email del dueño no disponible aquí. Usa la sección Usuarios.");
    } else {
      toast.error("Sin datos de contacto");
    }
  }

  if (loading) {
    return (
      <AdminLayout title="Detalle de Auto">
        <div className="space-y-4">
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-96 w-full" />
        </div>
      </AdminLayout>
    );
  }

  if (!vehicle) {
    return (
      <AdminLayout title="Detalle de Auto">
        <p className="text-muted-foreground">Vehículo no encontrado.</p>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title={`${vehicle.brand} ${vehicle.model}`}>
      <div className="space-y-4">
        {/* Top bar */}
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <Button variant="ghost" size="sm" onClick={() => navigate("/admin/flota")}>
            <ArrowLeft className="h-4 w-4" /> Volver a flota
          </Button>
          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" size="sm" onClick={() => window.print()}>
              <Printer className="h-4 w-4" /> Imprimir
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link to={`/my-vehicles/${vehicle.id}/editar`}>
                <Pencil className="h-4 w-4" /> Editar
              </Link>
            </Button>
            <Button variant="outline" size="sm" onClick={togglePause}>
              {vehicle.available ? <PauseCircle className="h-4 w-4" /> : <PlayCircle className="h-4 w-4" />}
              {vehicle.available ? "Pausar" : "Reanudar"}
            </Button>
            {vehicle.active ? (
              <Button variant="destructive" size="sm" onClick={() => setActive(false)}>
                <AlertCircle className="h-4 w-4" /> Desactivar
              </Button>
            ) : (
              <Button size="sm" onClick={() => setActive(true)}>
                <PlayCircle className="h-4 w-4" /> Reactivar
              </Button>
            )}
          </div>
        </div>

        {/* Header */}
        <Card>
          <CardContent className="p-4 grid lg:grid-cols-[1.2fr_1fr] gap-4">
            {/* Carrusel */}
            <div className="relative bg-muted rounded-lg overflow-hidden aspect-[16/10]">
              <img
                src={photos[photoIdx] ?? "/placeholder.svg"}
                alt={`${vehicle.brand} ${vehicle.model}`}
                className="w-full h-full object-cover"
              />
              {photos.length > 1 && (
                <>
                  <button
                    aria-label="Anterior"
                    onClick={() => setPhotoIdx((i) => (i === 0 ? photos.length - 1 : i - 1))}
                    className="absolute left-2 top-1/2 -translate-y-1/2 bg-background/80 rounded-full p-1.5 hover:bg-background"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                  <button
                    aria-label="Siguiente"
                    onClick={() => setPhotoIdx((i) => (i + 1) % photos.length)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 bg-background/80 rounded-full p-1.5 hover:bg-background"
                  >
                    <ChevronRight className="h-5 w-5" />
                  </button>
                  <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
                    {photos.map((_, i) => (
                      <span
                        key={i}
                        className={`h-1.5 rounded-full transition-all ${
                          i === photoIdx ? "w-4 bg-primary" : "w-1.5 bg-background/70"
                        }`}
                      />
                    ))}
                  </div>
                </>
              )}
            </div>
            {/* Info */}
            <div className="flex flex-col gap-3">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-2xl font-bold">
                    {vehicle.brand} {vehicle.model}
                  </h2>
                  <Badge variant="outline">{vehicle.year}</Badge>
                  <Badge
                    className={
                      status === "active"
                        ? "bg-emerald-500"
                        : status === "paused"
                        ? "bg-amber-500"
                        : status === "maintenance"
                        ? "bg-blue-500"
                        : "bg-slate-500"
                    }
                  >
                    {status === "active" ? "Activo" : status === "paused" ? "Pausado" : status === "maintenance" ? "En mantenimiento" : "Inactivo"}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                  <MapPin className="h-3.5 w-3.5" /> {vehicle.location}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-muted-foreground">Placa</p>
                  <p className="font-medium">{vehicle.plate ?? application?.vehicle_plate ?? "—"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">VIN</p>
                  <p className="font-medium truncate">{vehicle.vin ?? "—"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Tarifa diaria</p>
                  <p className="font-medium">${Number(vehicle.price_per_day).toFixed(0)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Rating</p>
                  <p className="font-medium flex items-center gap-1">
                    <Star className="h-3.5 w-3.5 fill-amber-500 text-amber-500" />
                    {ratingSummary.avg.toFixed(1)} <span className="text-muted-foreground">({ratingSummary.total})</span>
                  </p>
                </div>
              </div>
              <Separator />
              <div className="flex gap-2 flex-wrap">
                <Button size="sm" variant="outline" onClick={() => contactOwner("wa")}>
                  <MessageSquare className="h-4 w-4" /> WhatsApp
                </Button>
                <Button size="sm" variant="outline" onClick={() => contactOwner("tel")}>
                  <Phone className="h-4 w-4" /> Llamar
                </Button>
                <Button size="sm" variant="outline" onClick={() => contactOwner("mail")}>
                  <Mail className="h-4 w-4" /> Email
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tabs */}
        <Tabs defaultValue="info" className="w-full">
          <TabsList className="flex flex-wrap h-auto">
            <TabsTrigger value="info">Información</TabsTrigger>
            <TabsTrigger value="finanzas">Tarifas & Financiero</TabsTrigger>
            <TabsTrigger value="calendario">Calendario</TabsTrigger>
            <TabsTrigger value="mantenimiento">Inspecciones</TabsTrigger>
            <TabsTrigger value="reviews">Reviews</TabsTrigger>
            <TabsTrigger value="docs">Documentación</TabsTrigger>
          </TabsList>

          {/* INFO */}
          <TabsContent value="info" className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Dueño</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <p>
                    <span className="text-muted-foreground">Nombre:</span> {owner?.full_name ?? "—"}
                  </p>
                  <p>
                    <span className="text-muted-foreground">Teléfono:</span> {owner?.phone ?? application?.phone ?? "—"}
                  </p>
                  <p>
                    <span className="text-muted-foreground">Cédula:</span> {owner?.cedula ?? application?.cedula ?? "—"}
                  </p>
                  <p>
                    <span className="text-muted-foreground">Dirección:</span>{" "}
                    {owner?.address ?? application?.address ?? "—"}
                  </p>
                  <Button asChild variant="link" size="sm" className="px-0">
                    <Link to={`/admin/usuarios/${vehicle.owner_id}`}>Ver perfil completo →</Link>
                  </Button>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Especificaciones</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-2 gap-2 text-sm">
                  <p><span className="text-muted-foreground">Color:</span> {vehicle.color ?? application?.vehicle_color ?? "—"}</p>
                  <p><span className="text-muted-foreground">Combustible:</span> {vehicle.fuel_type ?? application?.fuel_type ?? "—"}</p>
                  <p><span className="text-muted-foreground">Transmisión:</span> {vehicle.transmission ?? application?.transmission ?? "—"}</p>
                  <p><span className="text-muted-foreground">Asientos:</span> {vehicle.seats ?? "—"}</p>
                  <p><span className="text-muted-foreground">Kilometraje:</span> {application?.mileage ?? "—"}</p>
                  <p><span className="text-muted-foreground">Zona:</span> {vehicle.zone ?? application?.vehicle_zone ?? "—"}</p>
                </CardContent>
              </Card>
            </div>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Notas internas (solo admin)</CardTitle>
                <CardDescription>Historial de problemas, mantenimiento especial u observaciones.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <Textarea
                  rows={4}
                  value={notesDraft}
                  onChange={(e) => setNotesDraft(e.target.value)}
                  placeholder="Anota observaciones internas…"
                />
                <Button size="sm" onClick={saveNotes}>Guardar notas</Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* FINANZAS */}
          <TabsContent value="finanzas" className="space-y-4">
            <div className="grid md:grid-cols-4 gap-3">
              <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Tarifa diaria</p><p className="text-2xl font-bold">${Number(vehicle.price_per_day).toFixed(0)}</p></CardContent></Card>
              <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Fin de semana</p><p className="text-2xl font-bold">{vehicle.weekend_price ? `$${Number(vehicle.weekend_price).toFixed(0)}` : "—"}</p></CardContent></Card>
              <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Semanal</p><p className="text-2xl font-bold">{vehicle.weekly_price ? `$${Number(vehicle.weekly_price).toFixed(0)}` : "—"}</p></CardContent></Card>
              <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Mensual</p><p className="text-2xl font-bold">{vehicle.monthly_price ? `$${Number(vehicle.monthly_price).toFixed(0)}` : "—"}</p></CardContent></Card>
            </div>
            <Card>
              <CardHeader><CardTitle className="text-base">Ingresos últimos 6 meses</CardTitle></CardHeader>
              <CardContent style={{ height: 260 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthlyRevenue}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <RTooltip formatter={(v: any) => `$${v}`} />
                    <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            {(() => {
              const totalRev = monthlyRevenue.reduce((a, m) => a + m.revenue, 0);
              const commission = Math.round(totalRev * 0.1);
              const payout = totalRev - commission;
              const lastMonth = monthlyRevenue[monthlyRevenue.length - 1]?.revenue ?? 0;
              return (
                <div className="grid md:grid-cols-3 gap-3">
                  <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Revenue 6m</p><p className="text-2xl font-bold">${totalRev}</p></CardContent></Card>
                  <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Comisión RuedaVe (10%)</p><p className="text-2xl font-bold">${commission}</p></CardContent></Card>
                  <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Payout estimado dueño</p><p className="text-2xl font-bold">${payout}</p><p className="text-xs text-muted-foreground mt-1">Último mes: ${lastMonth}</p></CardContent></Card>
                </div>
              );
            })()}
          </TabsContent>

          {/* CALENDARIO */}
          <TabsContent value="calendario" className="space-y-4">
            <Card>
              <CardHeader className="flex-row items-center justify-between gap-2">
                <CardTitle className="text-base">{format(calMonth, "MMMM yyyy", { locale: es })}</CardTitle>
                <div className="flex gap-1">
                  <Button size="icon" variant="outline" onClick={() => setCalMonth(subMonths(calMonth, 1))}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="outline" onClick={() => setCalMonth(subMonths(calMonth, -1))}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-7 gap-1 text-xs text-muted-foreground mb-2">
                  {["L", "M", "X", "J", "V", "S", "D"].map((d) => (
                    <div key={d} className="text-center font-medium">{d}</div>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-1">
                  {calendarDays.map((day) => {
                    const dayRes = reservationsForDay(day);
                    const inMonth = isSameMonth(day, calMonth);
                    const today = isSameDay(day, new Date());
                    return (
                      <button
                        key={day.toISOString()}
                        onClick={() => setDayDialog(day)}
                        className={`min-h-[60px] rounded-md border p-1 text-left text-xs transition-colors hover:bg-accent/30 ${
                          inMonth ? "bg-card" : "bg-muted/30 text-muted-foreground"
                        } ${today ? "ring-2 ring-primary" : ""}`}
                      >
                        <div className="font-medium">{format(day, "d")}</div>
                        <div className="flex flex-wrap gap-0.5 mt-1">
                          {dayRes.slice(0, 4).map((r) => (
                            <span
                              key={r.id}
                              className={`h-1.5 w-1.5 rounded-full ${STATUS_COLOR[r.status] ?? "bg-slate-400"}`}
                            />
                          ))}
                        </div>
                      </button>
                    );
                  })}
                </div>
                <div className="flex flex-wrap gap-3 mt-3 text-xs">
                  {Object.entries(STATUS_LABEL).map(([k, l]) => (
                    <span key={k} className="flex items-center gap-1">
                      <span className={`h-2 w-2 rounded-full ${STATUS_COLOR[k]}`} /> {l}
                    </span>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* MANTENIMIENTO */}
          <TabsContent value="mantenimiento" className="space-y-4">
            <div className="flex gap-2">
              <Button size="sm" onClick={() => setMaintDialog("scheduled")}>
                <CalendarDays className="h-4 w-4" /> Programar mantenimiento
              </Button>
              <Button size="sm" variant="destructive" onClick={() => setMaintDialog("urgent")}>
                <Wrench className="h-4 w-4" /> Solicitar inspección urgente
              </Button>
            </div>
            <Card>
              <CardHeader><CardTitle className="text-base">Historial</CardTitle></CardHeader>
              <CardContent>
                {maintenance.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Sin registros.</p>
                ) : (
                  <div className="divide-y">
                    {maintenance.map((m) => (
                      <div key={m.id} className="py-3 flex items-center justify-between gap-2">
                        <div>
                          <p className="font-medium text-sm">{m.type}</p>
                          <p className="text-xs text-muted-foreground">{format(parseISO(m.scheduled_date), "dd MMM yyyy", { locale: es })}</p>
                          {m.notes && <p className="text-xs mt-1">{m.notes}</p>}
                        </div>
                        <Badge variant={m.status === "completed" ? "secondary" : m.status === "scheduled" ? "default" : "outline"}>
                          {m.status}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* REVIEWS */}
          <TabsContent value="reviews" className="space-y-4">
            <div className="grid md:grid-cols-3 gap-3">
              <Card>
                <CardContent className="p-4 flex flex-col items-center justify-center">
                  <p className="text-4xl font-bold">{ratingSummary.avg.toFixed(1)}</p>
                  <div className="flex gap-0.5 my-1">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <Star key={s} className={`h-4 w-4 ${s <= Math.round(ratingSummary.avg) ? "fill-amber-500 text-amber-500" : "text-muted"}`} />
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground">{ratingSummary.total} reviews</p>
                </CardContent>
              </Card>
              <Card className="md:col-span-2">
                <CardContent className="p-4 space-y-2">
                  {ratingSummary.dist.map((d) => (
                    <div key={d.star} className="flex items-center gap-2 text-xs">
                      <span className="w-6">{d.star}★</span>
                      <Progress value={ratingSummary.total ? (d.count / ratingSummary.total) * 100 : 0} className="flex-1 h-2" />
                      <span className="w-8 text-right">{d.count}</span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
            <Card>
              <CardHeader><CardTitle className="text-base">Últimos comentarios</CardTitle></CardHeader>
              <CardContent>
                {reviews.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Sin reviews.</p>
                ) : (
                  <div className="space-y-3">
                    {reviews.slice(0, 5).map((r) => (
                      <div
                        key={r.id}
                        className={`p-3 rounded-md border ${r.rating <= 2 ? "border-destructive/40 bg-destructive/5" : "bg-muted/20"}`}
                      >
                        <div className="flex items-center gap-2">
                          <div className="flex">
                            {[1, 2, 3, 4, 5].map((s) => (
                              <Star key={s} className={`h-3.5 w-3.5 ${s <= r.rating ? "fill-amber-500 text-amber-500" : "text-muted"}`} />
                            ))}
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {format(parseISO(r.created_at), "dd MMM yyyy", { locale: es })}
                          </span>
                        </div>
                        {r.comment && <p className="text-sm mt-1">{r.comment}</p>}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* DOCS */}
          <TabsContent value="docs" className="space-y-4">
            {[
              { label: "SOAT", url: vehicle.soat_doc_url ?? application?.insurance_doc_url, expiry: vehicle.soat_expiry },
              { label: "Permiso de circulación", url: vehicle.circulation_doc_url ?? application?.title_doc_url, expiry: vehicle.circulation_expiry },
              { label: "Póliza de seguro adicional", url: vehicle.insurance_doc_url, expiry: vehicle.insurance_expiry },
            ].map((d) => (
              <Card key={d.label}>
                <CardContent className="p-4 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <FileText className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="font-medium text-sm">{d.label}</p>
                      <p className="text-xs text-muted-foreground">
                        {d.expiry ? `Vence: ${format(parseISO(d.expiry), "dd MMM yyyy", { locale: es })}` : "Sin fecha de vencimiento"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {expiryBadge(d.expiry)}
                    {d.url ? (
                      <Button size="sm" variant="outline" asChild>
                        <a href={d.url} target="_blank" rel="noreferrer">Ver</a>
                      </Button>
                    ) : (
                      <Badge variant="outline">No cargado</Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </TabsContent>
        </Tabs>
      </div>

      {/* Day reservations dialog */}
      <Dialog open={!!dayDialog} onOpenChange={(o) => !o && setDayDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {dayDialog && format(dayDialog, "EEEE d 'de' MMMM yyyy", { locale: es })}
            </DialogTitle>
            <DialogDescription>Reservas activas en esta fecha.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {dayDialog && reservationsForDay(dayDialog).length === 0 && (
              <p className="text-sm text-muted-foreground">Sin reservas.</p>
            )}
            {dayDialog &&
              reservationsForDay(dayDialog).map((r) => (
                <div key={r.id} className="border rounded-md p-3 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="font-medium text-sm">{(r as any).renter_name ?? "Usuario"}</p>
                      <p className="text-xs text-muted-foreground">
                        {format(parseISO(r.start_date), "dd MMM", { locale: es })} – {format(parseISO(r.end_date), "dd MMM", { locale: es })} · ${Number(r.total_price).toFixed(0)}
                      </p>
                    </div>
                    <Badge className={STATUS_COLOR[r.status]}>{STATUS_LABEL[r.status]}</Badge>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {r.status === "pending" && (
                      <>
                        <Button size="sm" variant="outline" onClick={() => setReservationStatus(r.id, "approved")}>
                          <CheckCircle2 className="h-3.5 w-3.5" /> Aprobar
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setReservationStatus(r.id, "rejected")}>
                          <XCircle className="h-3.5 w-3.5" /> Rechazar
                        </Button>
                      </>
                    )}
                    {r.status === "approved" && (
                      <Button size="sm" variant="outline" onClick={() => setReservationStatus(r.id, "active")}>
                        <Clock className="h-3.5 w-3.5" /> Marcar activa
                      </Button>
                    )}
                    {r.status === "active" && (
                      <Button size="sm" variant="outline" onClick={() => setReservationStatus(r.id, "completed")}>
                        <CheckCircle2 className="h-3.5 w-3.5" /> Completar
                      </Button>
                    )}
                    {!["completed", "cancelled", "rejected"].includes(r.status) && (
                      <Button size="sm" variant="outline" onClick={() => setReservationStatus(r.id, "cancelled")}>
                        <XCircle className="h-3.5 w-3.5" /> Cancelar
                      </Button>
                    )}
                  </div>
                </div>
              ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Maintenance dialog */}
      <Dialog open={!!maintDialog} onOpenChange={(o) => !o && setMaintDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {maintDialog === "urgent" ? "Solicitar inspección urgente" : "Programar mantenimiento"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Tipo</Label>
              <Select value={maintForm.type} onValueChange={(v) => setMaintForm((p) => ({ ...p, type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Inspección general">Inspección general</SelectItem>
                  <SelectItem value="Cambio de aceite">Cambio de aceite</SelectItem>
                  <SelectItem value="Frenos">Frenos</SelectItem>
                  <SelectItem value="Neumáticos">Neumáticos</SelectItem>
                  <SelectItem value="Mecánica general">Mecánica general</SelectItem>
                  <SelectItem value="Carrocería">Carrocería</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Fecha</Label>
              <Input type="date" value={maintForm.date} onChange={(e) => setMaintForm((p) => ({ ...p, date: e.target.value }))} />
            </div>
            <div>
              <Label>Notas</Label>
              <Textarea rows={3} value={maintForm.notes} onChange={(e) => setMaintForm((p) => ({ ...p, notes: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMaintDialog(null)}>Cancelar</Button>
            <Button onClick={createMaintenance}>Confirmar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
