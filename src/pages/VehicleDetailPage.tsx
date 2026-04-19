import { useEffect, useMemo, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { format, addDays, differenceInDays, eachDayOfInterval, parseISO, isSameDay } from "date-fns";
import { es } from "date-fns/locale";
import {
  ChevronLeft,
  ChevronRight,
  Star,
  MapPin,
  Users,
  Fuel,
  Cog,
  Gauge,
  Calendar as CalendarIcon,
  Shield,
  CheckCircle2,
  MessageCircle,
  Heart,
  Share2,
  Clock,
  Loader2,
  Car as CarIcon,
} from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { DateRange } from "react-day-picker";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

type VehicleRow = {
  id: string;
  brand: string;
  model: string;
  year: number;
  location: string;
  price_per_day: number;
  description: string | null;
  photos: string[] | null;
  owner_id: string;
  available: boolean;
  active: boolean;
};

type OwnerProfile = {
  full_name: string | null;
  avatar_url: string | null;
  verified: boolean;
  created_at: string;
};

type ReservationDates = {
  start_date: string;
  end_date: string;
  status: string;
};

const photoUrl = (p: string) =>
  p.startsWith("http")
    ? p
    : `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/vehicle-photos/${p}`;

const VehicleDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [vehicle, setVehicle] = useState<VehicleRow | null>(null);
  const [owner, setOwner] = useState<OwnerProfile | null>(null);
  const [bookedDates, setBookedDates] = useState<Date[]>([]);

  const [photoIndex, setPhotoIndex] = useState(0);
  const [isFavorite, setIsFavorite] = useState(false);
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!id) return;
    const load = async () => {
      setLoading(true);
      const { data: veh, error: vErr } = await supabase
        .from("vehicles")
        .select("*")
        .eq("id", id)
        .maybeSingle();

      if (vErr || !veh) {
        toast.error("Vehículo no encontrado");
        setLoading(false);
        return;
      }
      setVehicle(veh as VehicleRow);

      const [{ data: prof }, { data: resv }] = await Promise.all([
        supabase
          .from("profiles")
          .select("full_name, avatar_url, verified, created_at")
          .eq("user_id", veh.owner_id)
          .maybeSingle(),
        supabase
          .from("reservations")
          .select("start_date, end_date, status")
          .eq("vehicle_id", id)
          .in("status", ["pending", "approved"]),
      ]);

      setOwner((prof as OwnerProfile) || null);

      const blocked: Date[] = [];
      ((resv as ReservationDates[]) || []).forEach((r) => {
        const days = eachDayOfInterval({
          start: parseISO(r.start_date),
          end: parseISO(r.end_date),
        });
        blocked.push(...days);
      });
      setBookedDates(blocked);
      setLoading(false);
    };
    load();
  }, [id]);

  const photos = useMemo(() => {
    if (!vehicle?.photos?.length) return ["/placeholder.svg"];
    return vehicle.photos.map(photoUrl);
  }, [vehicle]);

  const days =
    dateRange?.from && dateRange?.to
      ? Math.max(differenceInDays(dateRange.to, dateRange.from), 1)
      : 0;
  const dailyRate = Number(vehicle?.price_per_day || 0);
  const subtotal = days * dailyRate;
  const serviceFee = Math.round(subtotal * 0.1);
  const insuranceFee = days * 8;
  const total = subtotal + serviceFee + insuranceFee;

  const isDateBlocked = (date: Date) => {
    if (date < new Date(new Date().setHours(0, 0, 0, 0))) return true;
    return bookedDates.some((d) => isSameDay(d, date));
  };

  const nextPhoto = () => setPhotoIndex((p) => (p + 1) % photos.length);
  const prevPhoto = () =>
    setPhotoIndex((p) => (p - 1 + photos.length) % photos.length);

  const handleReserveClick = () => {
    if (!user) {
      toast.error("Inicia sesión para reservar");
      navigate(`/auth?mode=signup&redirect=/vehiculo/${id}`);
      return;
    }
    if (user.id === vehicle?.owner_id) {
      toast.error("No puedes reservar tu propio vehículo");
      return;
    }
    if (!dateRange?.from || !dateRange?.to) {
      toast.error("Selecciona las fechas de tu reserva");
      return;
    }
    // Validate no blocked dates inside range
    const range = eachDayOfInterval({ from: dateRange.from, to: dateRange.to } as any);
    const conflict = range.some((d) => bookedDates.some((b) => isSameDay(b, d)));
    if (conflict) {
      toast.error("Algunas fechas seleccionadas ya están reservadas");
      return;
    }
    setConfirmOpen(true);
  };

  const confirmReservation = async () => {
    if (!user || !vehicle || !dateRange?.from || !dateRange?.to) return;
    setSubmitting(true);
    try {
      const { data: resv, error } = await supabase
        .from("reservations")
        .insert({
          vehicle_id: vehicle.id,
          renter_id: user.id,
          start_date: format(dateRange.from, "yyyy-MM-dd"),
          end_date: format(dateRange.to, "yyyy-MM-dd"),
          total_price: total,
          status: "pending",
        })
        .select()
        .single();

      if (error) throw error;

      // Notify owner (best-effort)
      await supabase.from("notifications").insert({
        user_id: vehicle.owner_id,
        type: "reservation_request",
        title: "Nueva solicitud de reserva",
        message: `${days} ${days === 1 ? "día" : "días"} · $${total} · ${vehicle.brand} ${vehicle.model}`,
        reservation_id: resv.id,
        vehicle_id: vehicle.id,
        action_url: "/my-vehicles",
      });

      toast.success("Reserva enviada", {
        description: "El anfitrión tiene 24 horas para responder",
      });
      setConfirmOpen(false);
      navigate("/my-vehicles");
    } catch (e: any) {
      toast.error("No se pudo crear la reserva", { description: e.message });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <main className="container mx-auto px-4 pt-24 pb-12 space-y-6">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-96" />
          <Skeleton className="aspect-[21/9] w-full rounded-2xl" />
          <div className="grid lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-4">
              <Skeleton className="h-40" />
              <Skeleton className="h-40" />
            </div>
            <Skeleton className="h-96" />
          </div>
        </main>
      </div>
    );
  }

  if (!vehicle) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <main className="container mx-auto px-4 pt-32 pb-12 text-center">
          <Card className="max-w-md mx-auto p-8">
            <CarIcon className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h1 className="text-2xl font-bold mb-2">Vehículo no disponible</h1>
            <p className="text-muted-foreground mb-6">
              El vehículo que buscas no existe o ya no está activo.
            </p>
            <Button onClick={() => navigate("/")}>Ver catálogo</Button>
          </Card>
        </main>
        <Footer />
      </div>
    );
  }

  const ownerName = owner?.full_name || "Anfitrión";
  const memberSince = owner?.created_at
    ? format(parseISO(owner.created_at), "MMMM yyyy", { locale: es })
    : "—";

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <main className="container mx-auto px-4 pt-20 pb-12">
        <Link
          to="/"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4 transition-smooth"
        >
          <ChevronLeft className="w-4 h-4" />
          Volver al catálogo
        </Link>

        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-2">
              {vehicle.brand} {vehicle.model} {vehicle.year}
            </h1>
            <div className="flex flex-wrap items-center gap-4 text-sm">
              <div className="flex items-center gap-1">
                <Star className="w-4 h-4 fill-accent text-accent" />
                <span className="font-semibold text-foreground">Nuevo</span>
              </div>
              <div className="flex items-center gap-1 text-muted-foreground">
                <MapPin className="w-4 h-4" />
                <span>{vehicle.location}</span>
              </div>
              {owner?.verified && (
                <Badge variant="secondary" className="gap-1">
                  <Shield className="w-3 h-3" /> Anfitrión verificado
                </Badge>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={() => setIsFavorite(!isFavorite)}
            >
              <Heart
                className={cn("w-4 h-4", isFavorite && "fill-accent text-accent")}
              />
            </Button>
            <Button variant="outline" size="icon">
              <Share2 className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Photo Gallery */}
        <div className="relative rounded-2xl overflow-hidden bg-muted mb-2 aspect-[16/9] md:aspect-[21/9]">
          <img
            src={photos[photoIndex]}
            alt={`${vehicle.brand} ${vehicle.model} - foto ${photoIndex + 1}`}
            className="w-full h-full object-cover"
          />
          {photos.length > 1 && (
            <>
              <button
                onClick={prevPhoto}
                className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 bg-card/90 backdrop-blur-sm rounded-full flex items-center justify-center shadow-card hover:bg-card transition-smooth"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                onClick={nextPhoto}
                className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 bg-card/90 backdrop-blur-sm rounded-full flex items-center justify-center shadow-card hover:bg-card transition-smooth"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </>
          )}
          <div className="absolute bottom-4 right-4 bg-card/90 backdrop-blur-sm rounded-lg px-3 py-1 text-sm font-medium">
            {photoIndex + 1} / {photos.length}
          </div>
        </div>

        {photos.length > 1 && (
          <div className="flex gap-2 mb-10 overflow-x-auto pb-2">
            {photos.map((p, idx) => (
              <button
                key={idx}
                onClick={() => setPhotoIndex(idx)}
                className={cn(
                  "relative shrink-0 w-24 h-16 rounded-lg overflow-hidden transition-smooth",
                  photoIndex === idx
                    ? "ring-2 ring-primary"
                    : "opacity-70 hover:opacity-100"
                )}
              >
                <img src={p} alt={`Miniatura ${idx + 1}`} className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        )}

        {/* Main Grid */}
        <div className="grid lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-8">
            {/* Description */}
            <section>
              <h2 className="text-2xl font-bold text-foreground mb-3">
                Acerca de este vehículo
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                {vehicle.description || "Sin descripción adicional."}
              </p>
            </section>

            {/* Owner */}
            <section>
              <h2 className="text-2xl font-bold text-foreground mb-4">
                Conoce a tu anfitrión
              </h2>
              <Card className="p-6">
                <div className="flex flex-col sm:flex-row items-start gap-4">
                  <Avatar className="w-20 h-20">
                    <AvatarImage src={owner?.avatar_url || ""} />
                    <AvatarFallback className="bg-primary text-primary-foreground text-xl font-bold">
                      {ownerName
                        .split(" ")
                        .map((n) => n[0])
                        .slice(0, 2)
                        .join("")}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-lg font-bold text-foreground">{ownerName}</h3>
                      {owner?.verified && (
                        <Badge variant="secondary" className="gap-1">
                          <Shield className="w-3 h-3" /> Verificado
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground mb-3">
                      Miembro desde {memberSince}
                    </p>
                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                      <Clock className="w-4 h-4 text-primary" />
                      Responde típicamente en 24 horas
                    </div>
                  </div>
                  <Button variant="outline" className="gap-2">
                    <MessageCircle className="w-4 h-4" />
                    Contactar
                  </Button>
                </div>
              </Card>
            </section>

            {/* Calendar */}
            <section>
              <h2 className="text-2xl font-bold text-foreground mb-3">
                Selecciona tus fechas
              </h2>
              <p className="text-muted-foreground mb-4">
                Las fechas en gris ya están reservadas
              </p>
              <Card className="p-4 inline-block">
                <Calendar
                  mode="range"
                  selected={dateRange}
                  onSelect={setDateRange}
                  numberOfMonths={1}
                  disabled={isDateBlocked}
                  locale={es}
                  className={cn("p-3 pointer-events-auto")}
                />
              </Card>
            </section>

            {/* Map */}
            <section>
              <h2 className="text-2xl font-bold text-foreground mb-3">Ubicación</h2>
              <p className="text-muted-foreground mb-4">
                Zona de recogida: {vehicle.location}
              </p>
              <div className="rounded-2xl overflow-hidden border border-border">
                <iframe
                  title="Mapa de ubicación"
                  src={`https://www.google.com/maps?q=${encodeURIComponent(
                    vehicle.location + ", Caracas, Venezuela"
                  )}&output=embed`}
                  className="w-full h-80 border-0"
                  loading="lazy"
                />
              </div>
            </section>
          </div>

          {/* Booking sidebar */}
          <div className="lg:col-span-1">
            <Card className="p-6 sticky top-24 shadow-card-hover">
              <div className="flex items-baseline gap-1 mb-4">
                <span className="text-3xl font-bold text-foreground">
                  ${dailyRate}
                </span>
                <span className="text-muted-foreground">/día</span>
              </div>

              <div className="space-y-3 mb-4">
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">
                    Recogida
                  </p>
                  <div className="flex items-center gap-2 p-3 border border-border rounded-lg">
                    <CalendarIcon className="w-4 h-4 text-primary" />
                    <span className="text-sm font-medium">
                      {dateRange?.from
                        ? format(dateRange.from, "PPP", { locale: es })
                        : "Selecciona fecha"}
                    </span>
                  </div>
                </div>
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">
                    Entrega
                  </p>
                  <div className="flex items-center gap-2 p-3 border border-border rounded-lg">
                    <CalendarIcon className="w-4 h-4 text-primary" />
                    <span className="text-sm font-medium">
                      {dateRange?.to
                        ? format(dateRange.to, "PPP", { locale: es })
                        : "Selecciona fecha"}
                    </span>
                  </div>
                </div>
              </div>

              <Separator className="my-4" />

              {days > 0 ? (
                <>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between text-muted-foreground">
                      <span>
                        ${dailyRate} × {days} {days === 1 ? "día" : "días"}
                      </span>
                      <span>${subtotal}</span>
                    </div>
                    <div className="flex justify-between text-muted-foreground">
                      <span>Tarifa de servicio (10%)</span>
                      <span>${serviceFee}</span>
                    </div>
                    <div className="flex justify-between text-muted-foreground">
                      <span>Seguro de protección</span>
                      <span>${insuranceFee}</span>
                    </div>
                  </div>

                  <Separator className="my-4" />

                  <div className="flex justify-between items-center mb-4">
                    <span className="font-bold text-foreground">Total</span>
                    <span className="text-2xl font-bold text-foreground">
                      ${total} USD
                    </span>
                  </div>
                </>
              ) : (
                <p className="text-sm text-muted-foreground mb-4">
                  Selecciona fechas para ver el precio total
                </p>
              )}

              <Button
                onClick={handleReserveClick}
                size="lg"
                disabled={!vehicle.available || days === 0}
                className="w-full bg-gradient-accent hover:opacity-90 text-accent-foreground font-semibold shadow-accent"
              >
                {vehicle.available ? "Reservar ahora" : "No disponible"}
              </Button>

              <p className="text-xs text-center text-muted-foreground mt-3">
                No se te cobrará todavía · El anfitrión tiene 24h para responder
              </p>
            </Card>
          </div>
        </div>
      </main>

      <Footer />

      {/* Confirm dialog */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar reserva</DialogTitle>
            <DialogDescription>
              Revisa los detalles antes de enviar tu solicitud
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Vehículo</span>
              <span className="font-medium">{vehicle.brand} {vehicle.model}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Recogida</span>
              <span className="font-medium">
                {dateRange?.from && format(dateRange.from, "PPP", { locale: es })}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Entrega</span>
              <span className="font-medium">
                {dateRange?.to && format(dateRange.to, "PPP", { locale: es })}
              </span>
            </div>
            <Separator />
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Subtotal ({days} días)</span>
              <span>${subtotal}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Servicio</span>
              <span>${serviceFee}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Seguro</span>
              <span>${insuranceFee}</span>
            </div>
            <Separator />
            <div className="flex justify-between font-bold text-lg">
              <span>Total</span>
              <span>${total} USD</span>
            </div>
            <p className="text-xs text-muted-foreground bg-muted/50 p-3 rounded-lg">
              Tu solicitud quedará pendiente. El anfitrión tiene 24 horas para aceptarla o rechazarla. No se te cobrará hasta la aceptación.
            </p>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)} disabled={submitting}>
              Cancelar
            </Button>
            <Button onClick={confirmReservation} disabled={submitting}>
              {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Confirmar solicitud
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default VehicleDetailPage;
