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
  Mail,
  Phone,
  Cigarette,
  PawPrint,
  Mountain,
  Droplet,
  AlertCircle,
  Check,
} from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Helmet } from "react-helmet-async";
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
import ReviewsSection from "@/components/ReviewsSection";
import ReviewDialog from "@/components/ReviewDialog";
import { resolveVehiclePhotos } from "@/lib/vehiclePhoto";
import { captureFraudSignal } from "@/lib/fraudCapture";

type HouseRules = {
  noSmoking?: boolean;
  smokingFine?: number;
  noPets?: boolean;
  returnSameFuel?: boolean;
  noOffRoad?: boolean;
  maxKmPerDay?: number | null;
  additional?: string;
};

type VehicleRow = {
  id: string;
  brand: string;
  model: string;
  year: number;
  color?: string | null;
  location: string;
  price_per_day: number;
  description: string | null;
  photos: string[] | null;
  owner_id: string;
  available: boolean;
  active: boolean;
  house_rules?: HouseRules | null;
  features?: string[] | null;
  custom_features?: string[] | null;
  fuel_type?: string | null;
  transmission?: string | null;
  seats?: number | null;
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

const VehicleDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [vehicle, setVehicle] = useState<VehicleRow | null>(null);
  const [resolvedPhotos, setResolvedPhotos] = useState<string[]>([]);
  const [owner, setOwner] = useState<OwnerProfile | null>(null);
  const [bookedDates, setBookedDates] = useState<Date[]>([]);
  const [ratingSummary, setRatingSummary] = useState<{ avg: number | null; count: number }>({ avg: null, count: 0 });
  const [renterCompletedReservation, setRenterCompletedReservation] = useState<{ id: string } | null>(null);
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);

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
        .select("id, owner_id, brand, model, year, color, location, zone, gps_lat, gps_lng, price_per_day, weekend_price, weekly_price, monthly_price, available, active, photos, description, house_rules, features, custom_features, fuel_type, transmission, seats, created_at, updated_at")
        .eq("id", id)
        .maybeSingle();

      if (vErr || !veh) {
        toast.error("Vehículo no encontrado");
        setLoading(false);
        return;
      }
      setVehicle(veh as VehicleRow);
      resolveVehiclePhotos((veh as VehicleRow).photos).then(setResolvedPhotos);

      const [{ data: prof }, { data: resv }] = await Promise.all([
        supabase
          .from("profiles_public" as any)
          .select("full_name, avatar_url, verified, created_at")
          .eq("user_id", veh.owner_id)
          .maybeSingle(),
        supabase
          .from("reservations")
          .select("start_date, end_date, status")
          .eq("vehicle_id", id)
          .in("status", ["pending", "approved"]),
      ]);

      setOwner((prof as unknown as OwnerProfile) || null);

      const blocked: Date[] = [];
      ((resv as ReservationDates[]) || []).forEach((r) => {
        const days = eachDayOfInterval({
          start: parseISO(r.start_date),
          end: parseISO(r.end_date),
        });
        blocked.push(...days);
      });
      setBookedDates(blocked);

      // Fetch rating summary
      const { data: ratingData } = await supabase.rpc("vehicle_rating_summary", {
        _vehicle_id: id,
      });
      const row = (ratingData as Array<{ avg_rating: number | null; review_count: number }> | null)?.[0];
      setRatingSummary({
        avg: row?.avg_rating ? Number(row.avg_rating) : null,
        count: Number(row?.review_count || 0),
      });

      setLoading(false);
    };
    load();
  }, [id]);

  // Check if logged-in renter has a completed reservation pending review
  useEffect(() => {
    if (!user || !id) {
      setRenterCompletedReservation(null);
      return;
    }
    const check = async () => {
      const { data: rsv } = await supabase
        .from("reservations")
        .select("id")
        .eq("vehicle_id", id)
        .eq("renter_id", user.id)
        .eq("status", "completed")
        .order("end_date", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!rsv) {
        setRenterCompletedReservation(null);
        return;
      }
      const { data: existing } = await supabase
        .from("reviews")
        .select("id")
        .eq("reservation_id", rsv.id)
        .eq("author_id", user.id)
        .maybeSingle();
      setRenterCompletedReservation(existing ? null : { id: rsv.id });
    };
    check();
  }, [user, id]);

  const photos = useMemo(() => {
    if (resolvedPhotos.length) return resolvedPhotos;
    return ["/placeholder.svg"];
  }, [resolvedPhotos]);

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

      // Silent fraud-prevention capture (IP, device, UA, geo)
      void captureFraudSignal({ event: "reservation", reservation_id: resv.id });

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
      {vehicle && (
        <Helmet>
          <title>{`${vehicle.brand} ${vehicle.model} ${vehicle.year} en alquiler - RuedaVe`}</title>
          <meta
            name="description"
            content={`Alquila un ${vehicle.brand} ${vehicle.model} ${vehicle.year} en ${vehicle.location} desde $${vehicle.price_per_day}/día. Reserva fácil y segura con RuedaVe.`}
          />
          <link rel="canonical" href={`https://caracas-caravan-club.lovable.app/vehiculo/${vehicle.id}`} />
          <meta property="og:title" content={`${vehicle.brand} ${vehicle.model} ${vehicle.year}`} />
          <meta
            property="og:description"
            content={`Alquílalo en ${vehicle.location} desde $${vehicle.price_per_day}/día.`}
          />
          <meta property="og:url" content={`https://caracas-caravan-club.lovable.app/vehiculo/${vehicle.id}`} />
          <meta property="og:type" content="product" />
          {resolvedPhotos[0] && <meta property="og:image" content={resolvedPhotos[0]} />}
          <script type="application/ld+json">{JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Product",
            name: `${vehicle.brand} ${vehicle.model} ${vehicle.year}`,
            brand: { "@type": "Brand", name: vehicle.brand },
            description: vehicle.description ?? `${vehicle.brand} ${vehicle.model} ${vehicle.year} en alquiler en ${vehicle.location}.`,
            image: resolvedPhotos.length ? resolvedPhotos : undefined,
            offers: {
              "@type": "Offer",
              priceCurrency: "USD",
              price: vehicle.price_per_day,
              availability: vehicle.available ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
              url: `https://caracas-caravan-club.lovable.app/vehiculo/${vehicle.id}`,
            },
            ...(ratingSummary.avg && ratingSummary.count > 0
              ? {
                  aggregateRating: {
                    "@type": "AggregateRating",
                    ratingValue: ratingSummary.avg,
                    reviewCount: ratingSummary.count,
                  },
                }
              : {}),
          })}</script>
        </Helmet>
      )}
      <Navbar />

      <main className="container mx-auto px-4 pt-20 pb-12">
        <Link
          to="/"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4 transition-smooth"
        >
          <ChevronLeft className="w-4 h-4" />
          Volver al catálogo
        </Link>

        {/* Pending review CTA for renter */}
        {renterCompletedReservation && user && vehicle && (
          <Card className="p-4 mb-6 border-accent/40 bg-accent/5 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-accent/20 flex items-center justify-center shrink-0">
                <Star className="w-5 h-5 text-accent fill-accent" />
              </div>
              <div>
                <p className="font-semibold text-foreground">
                  ¿Cómo fue tu viaje?
                </p>
                <p className="text-sm text-muted-foreground">
                  Califica tu experiencia con este vehículo y anfitrión.
                </p>
              </div>
            </div>
            <Button onClick={() => setReviewDialogOpen(true)}>
              Dejar reseña
            </Button>
          </Card>
        )}

        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-2">
              {vehicle.brand} {vehicle.model} {vehicle.year}
            </h1>
            <div className="flex flex-wrap items-center gap-4 text-sm">
              <div className="flex items-center gap-1">
                <Star className="w-4 h-4 fill-accent text-accent" />
                <span className="font-semibold text-foreground">
                  {ratingSummary.avg !== null ? ratingSummary.avg.toFixed(1) : "Nuevo"}
                </span>
                {ratingSummary.count > 0 && (
                  <span className="text-muted-foreground">
                    ({ratingSummary.count})
                  </span>
                )}
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
                aria-label="Imagen anterior"
                className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 bg-card/90 backdrop-blur-sm rounded-full flex items-center justify-center shadow-card hover:bg-card transition-smooth"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                onClick={nextPhoto}
                aria-label="Siguiente imagen"
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
              {(() => {
                // Strip auto-generated sentences (e.g., "Color: ...", "Transmisión: ...", "Combustible: ...", "Vehículo <marca> <modelo> <año>.")
                const raw = (vehicle.description || "").trim();
                const cleaned = raw
                  .split(/(?<=\.)\s+/)
                  .map((s) => s.trim())
                  .filter((s) => {
                    if (!s) return false;
                    if (/^Veh[íi]culo\s+.+\d{4}\.?$/i.test(s)) return false;
                    if (/^(Color|Transmisi[óo]n|Combustible|Asientos|A[ñn]o|Marca|Modelo)\s*:/i.test(s)) return false;
                    return true;
                  })
                  .join(" ")
                  .trim();
                return (
                  <p className="text-muted-foreground leading-relaxed">
                    {cleaned || "Sin descripción adicional."}
                  </p>
                );
              })()}

              {/* Specs (real data from vehicle) */}
              {(() => {
                const fuelLabel = vehicle.fuel_type
                  ? vehicle.fuel_type.charAt(0).toUpperCase() + vehicle.fuel_type.slice(1)
                  : null;
                const transLabel = vehicle.transmission
                  ? `Transmisión ${vehicle.transmission.toLowerCase()}`
                  : null;
                const specs: { icon: any; label: string }[] = [];
                if (vehicle.seats) specs.push({ icon: Users, label: `${vehicle.seats} asientos` });
                if (fuelLabel) specs.push({ icon: Fuel, label: fuelLabel });
                if (transLabel) specs.push({ icon: Cog, label: transLabel });
                if (vehicle.color) specs.push({ icon: Droplet, label: `Color: ${vehicle.color}` });
                if (vehicle.year) specs.push({ icon: CalendarIcon, label: `Año ${vehicle.year}` });
                if (specs.length === 0) return null;
                return (
                  <div className="mt-6 grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {specs.map(({ icon: Icon, label }) => (
                      <div
                        key={label}
                        className="flex items-center gap-2.5 rounded-xl border border-border bg-card px-3.5 py-2.5 text-sm font-medium text-foreground"
                      >
                        <Icon className="w-4 h-4 text-primary shrink-0" />
                        <span className="truncate">{label}</span>
                      </div>
                    ))}
                  </div>
                );
              })()}

              {(() => {
                const allFeatures = Array.from(
                  new Set(
                    [
                      ...(vehicle.features || []),
                      ...(vehicle.custom_features || []),
                    ].filter(Boolean)
                  )
                );
                if (allFeatures.length === 0) return null;
                return (
                  <div className="mt-6">
                    <h3 className="text-lg font-semibold text-foreground mb-3">
                      Características extras
                    </h3>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {allFeatures.map((f) => (
                        <div
                          key={f}
                          className="flex items-center gap-2.5 rounded-xl border border-border bg-card px-3.5 py-2.5 text-sm font-medium text-foreground"
                        >
                          <Check className="w-4 h-4 text-primary shrink-0" />
                          <span className="truncate">{f}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}
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
                  <Button
                    variant="outline"
                    className="gap-2"
                    onClick={async () => {
                      if (!user) { navigate('/auth'); return; }
                      if (!vehicle) return;
                      if (user.id === vehicle.owner_id) {
                        toast.info("No puedes contactarte a ti mismo");
                        return;
                      }
                      try {
                        const { getOrCreateConversation } = await import("@/lib/conversations");
                        const cid = await getOrCreateConversation({
                          renterId: user.id,
                          ownerId: vehicle.owner_id,
                          vehicleId: vehicle.id,
                        });
                        navigate(`/mensajes?c=${cid}`);
                      } catch (e) {
                        toast.error("No se pudo abrir la conversación");
                      }
                    }}
                  >
                    <MessageCircle className="w-4 h-4" />
                    Contactar
                  </Button>
                </div>

                {owner?.verified && (
                  <div className="mt-6 pt-6 border-t">
                    <h4 className="text-base font-semibold text-foreground mb-3">
                      Información verificada
                    </h4>
                    <ul className="grid sm:grid-cols-3 gap-2 text-sm text-foreground">
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-primary" />
                        Aprobado para conducir
                      </li>
                      <li className="flex items-center gap-2">
                        <Mail className="w-4 h-4 text-primary" />
                        Correo electrónico
                      </li>
                      <li className="flex items-center gap-2">
                        <Phone className="w-4 h-4 text-primary" />
                        Número de teléfono
                      </li>
                    </ul>
                    <p className="text-xs text-muted-foreground mt-3">
                      Genera confianza con otros usuarios en RuedaVe verificando tu información de contacto.
                    </p>
                  </div>
                )}
              </Card>
            </section>

            {/* House Rules */}
            {(() => {
              const r: HouseRules = vehicle.house_rules || {};
              const items: { icon: any; label: string }[] = [];
              if (r.noSmoking !== false)
                items.push({
                  icon: Cigarette,
                  label: `Prohibido fumar (multa de $${Number(r.smokingFine ?? 50)} si se incumple)`,
                });
              if (r.noPets !== false)
                items.push({ icon: PawPrint, label: "No se permiten mascotas" });
              if (r.returnSameFuel !== false)
                items.push({
                  icon: Droplet,
                  label: "Devolver con el mismo nivel de combustible",
                });
              if (r.noOffRoad !== false)
                items.push({
                  icon: Mountain,
                  label: "No circular fuera de carretera (off-road)",
                });
              if (r.maxKmPerDay && r.maxKmPerDay > 0)
                items.push({
                  icon: Gauge,
                  label: `Máximo ${r.maxKmPerDay} km por día`,
                });
              return (
                <section>
                  <h2 className="text-2xl font-bold text-foreground mb-4">
                    Normas del anfitrión
                  </h2>
                  <Card className="p-6">
                    {items.length === 0 && !r.additional ? (
                      <p className="text-sm text-muted-foreground">
                        Este anfitrión no ha definido normas adicionales.
                      </p>
                    ) : (
                      <ul className="grid sm:grid-cols-2 gap-3">
                        {items.map(({ icon: Icon, label }, i) => (
                          <li key={i} className="flex items-start gap-3 text-sm text-foreground">
                            <Icon className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                            <span>{label}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                    {r.additional && r.additional.trim().length > 0 && (
                      <div className="mt-4 pt-4 border-t flex items-start gap-3">
                        <AlertCircle className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                        <p className="text-sm text-foreground whitespace-pre-line">
                          {r.additional}
                        </p>
                      </div>
                    )}
                    <p className="text-xs text-muted-foreground mt-4">
                      Al reservar aceptas cumplir las normas del anfitrión. El incumplimiento puede generar cargos adicionales.
                    </p>
                  </Card>
                </section>
              );
            })()}
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

            {/* Reviews */}
            <ReviewsSection vehicleId={vehicle.id} />
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

      {/* Review dialog (renter reviewing this vehicle/owner) */}
      {renterCompletedReservation && vehicle && (
        <ReviewDialog
          open={reviewDialogOpen}
          onOpenChange={setReviewDialogOpen}
          reservationId={renterCompletedReservation.id}
          vehicleId={vehicle.id}
          subjectUserId={vehicle.owner_id}
          reviewerType="renter"
          contextLabel={`${vehicle.brand} ${vehicle.model}`}
          onSubmitted={() => setRenterCompletedReservation(null)}
        />
      )}
    </div>
  );
};

export default VehicleDetailPage;
