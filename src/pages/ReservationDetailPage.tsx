import { useEffect, useState } from "react";
import { useParams, Link, Navigate } from "react-router-dom";
import { format, differenceInCalendarDays, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import {
  ArrowLeft, Calendar, Car, FileText, Loader2, MapPin, User as UserIcon,
  DollarSign, ClipboardCheck, MessageCircle, Phone,
} from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { resolveVehiclePhoto } from "@/lib/vehiclePhoto";
import { getOrCreateConversation } from "@/lib/conversations";
import PaymentReceiptUpload from "@/components/PaymentReceiptUpload";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

const STATUS_META: Record<string, { label: string; cls: string }> = {
  pending: { label: "Pendiente", cls: "bg-yellow-500/10 text-yellow-700 border-yellow-500/30" },
  awaiting_payment: { label: "Esperando pago", cls: "bg-orange-500/10 text-orange-700 border-orange-500/30" },
  approved: { label: "Aprobada", cls: "bg-emerald-500/10 text-emerald-700 border-emerald-500/30" },
  active: { label: "Activa", cls: "bg-blue-500/10 text-blue-700 border-blue-500/30" },
  completed: { label: "Completada", cls: "bg-muted text-muted-foreground border-border" },
  cancelled: { label: "Cancelada", cls: "bg-red-500/10 text-red-700 border-red-500/30" },
  rejected: { label: "Rechazada", cls: "bg-red-500/10 text-red-700 border-red-500/30" },
};

export default function ReservationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [allowed, setAllowed] = useState(false);
  const [isOwnerView, setIsOwnerView] = useState(false);
  const [reservation, setReservation] = useState<any>(null);
  const [vehicle, setVehicle] = useState<any>(null);
  const [vehiclePhoto, setVehiclePhoto] = useState<string | null>(null);
  const [counterpart, setCounterpart] = useState<any>(null);
  const [payment, setPayment] = useState<any>(null);
  const [inspections, setInspections] = useState<{ pickup: boolean; ret: boolean }>({ pickup: false, ret: false });

  useEffect(() => {
    if (!id || !user) return;
    (async () => {
      setLoading(true);
      const { data: r } = await supabase.from("reservations").select("*").eq("id", id).maybeSingle();
      if (!r) { setLoading(false); return; }
      const { data: v } = await supabase.from("vehicles").select("*").eq("id", r.vehicle_id).maybeSingle();
      const owner = v?.owner_id === user.id;
      const renter = r.renter_id === user.id;
      if (!owner && !renter) { setLoading(false); return; }
      setAllowed(true);
      setIsOwnerView(owner);
      setReservation(r);
      setVehicle(v);
      setVehiclePhoto(v?.photos?.[0] ? await resolveVehiclePhoto(v.photos[0]) : null);

      const counterId = owner ? r.renter_id : v?.owner_id;
      if (counterId) {
        const { data: p } = await supabase
          .from("profiles")
          .select("full_name, avatar_url, phone")
          .eq("user_id", counterId)
          .maybeSingle();
        setCounterpart(p);
      }

      const { data: pay } = await supabase
        .from("payments")
        .select("*")
        .eq("reservation_id", id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      setPayment(pay);

      const { data: ins } = await supabase
        .from("vehicle_inspections")
        .select("type")
        .eq("reservation_id", id);
      setInspections({
        pickup: !!ins?.some((i: any) => i.type === "pickup"),
        ret: !!ins?.some((i: any) => i.type === "return"),
      });

      setLoading(false);
    })();
  }, [id, user]);

  const contactCounterpart = async () => {
    if (!user || !reservation || !vehicle) return;
    try {
      const convId = await getOrCreateConversation({
        renterId: reservation.renter_id,
        ownerId: vehicle.owner_id,
        vehicleId: reservation.vehicle_id,
        reservationId: reservation.id,
      });
      navigate(`/mensajes?c=${convId}`);
    } catch {
      toast.error("No se pudo abrir la conversación");
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!user) return <Navigate to="/auth" replace />;
  if (!allowed || !reservation || !vehicle) {
    return (
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <main className="flex-1 container mx-auto px-4 pt-24 pb-16 max-w-4xl">
          <p className="text-muted-foreground">Reserva no encontrada o sin acceso.</p>
        </main>
        <Footer />
      </div>
    );
  }

  const meta = STATUS_META[reservation.status] || STATUS_META.pending;
  const days = Math.max(
    1,
    differenceInCalendarDays(parseISO(reservation.end_date), parseISO(reservation.start_date)),
  );
  const total = Number(reservation.total_price);
  const back = isOwnerView ? "/mis-reservas" : "/mis-reservas";

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1 container mx-auto px-4 pt-24 pb-16 max-w-4xl">
        <Link to={back}>
          <Button variant="ghost" size="sm" className="mb-4">
            <ArrowLeft className="h-4 w-4 mr-2" /> Volver a mis reservas
          </Button>
        </Link>

        <div className="flex items-start justify-between gap-4 flex-wrap mb-6">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">Detalles de la reserva</h1>
            <p className="text-sm text-muted-foreground mt-1">
              #{String(reservation.id).slice(0, 8).toUpperCase()}
            </p>
          </div>
          <Badge variant="outline" className={meta.cls}>{meta.label}</Badge>
        </div>

        {reservation.status === "awaiting_payment" && !isOwnerView && (
          <div className="mb-4">
            <PaymentReceiptUpload
              reservationId={reservation.id}
              totalPrice={Number(reservation.total_price)}
              paymentDeadline={reservation.payment_deadline}
            />
          </div>
        )}

        {reservation.status === "awaiting_payment" && isOwnerView && (
          <div className="mb-4 rounded-lg border border-orange-500/30 bg-orange-500/5 p-4 text-sm">
            <p className="font-medium text-orange-800">Esperando pago del arrendatario</p>
            <p className="text-muted-foreground text-xs mt-1">
              La reserva quedará aprobada automáticamente cuando un administrador de RuedaVe
              verifique el comprobante de pago. Si no se recibe pago en 24h desde tu aprobación,
              la reserva se cancelará.
            </p>
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-3">
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Car className="h-4 w-4" /> Vehículo
              </CardTitle>
            </CardHeader>
            <CardContent className="flex gap-4">
              <div className="w-32 h-24 rounded-md bg-muted overflow-hidden flex-shrink-0">
                {vehiclePhoto ? (
                  <img src={vehiclePhoto} alt={`${vehicle.brand} ${vehicle.model}`} className="w-full h-full object-cover" />
                ) : (
                  <Car className="w-full h-full p-6 text-muted-foreground" />
                )}
              </div>
              <div className="min-w-0 space-y-1">
                <p className="font-semibold">{vehicle.brand} {vehicle.model} {vehicle.year}</p>
                {vehicle.plate && <p className="text-xs text-muted-foreground">Placa: {vehicle.plate}</p>}
                {vehicle.color && <p className="text-xs text-muted-foreground">Color: {vehicle.color}</p>}
                {(vehicle.location || vehicle.zone) && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <MapPin className="h-3 w-3" /> {vehicle.location || vehicle.zone}
                  </p>
                )}
                <Link to={`/vehiculo/${vehicle.id}`} className="text-xs text-primary hover:underline inline-block mt-1">
                  Ver ficha del vehículo →
                </Link>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <UserIcon className="h-4 w-4" /> {isOwnerView ? "Arrendatario" : "Anfitrión"}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              <p className="font-medium">{counterpart?.full_name || "—"}</p>
              {counterpart?.phone && (
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Phone className="h-3 w-3" /> {counterpart.phone}
                </p>
              )}
              <Button variant="outline" size="sm" className="mt-2 w-full" onClick={contactCounterpart}>
                <MessageCircle className="h-4 w-4 mr-1" /> Enviar mensaje
              </Button>
            </CardContent>
          </Card>

          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Calendar className="h-4 w-4" /> Fechas
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-xs text-muted-foreground">Inicio</p>
                <p className="font-medium">{format(parseISO(reservation.start_date), "PPP", { locale: es })}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Fin</p>
                <p className="font-medium">{format(parseISO(reservation.end_date), "PPP", { locale: es })}</p>
              </div>
              <div className="col-span-2">
                <p className="text-xs text-muted-foreground">Duración</p>
                <p className="font-medium">{days} día{days > 1 ? "s" : ""}</p>
              </div>
            </CardContent>
          </Card>

          {(() => {
            const dailyRate = Number(vehicle.price_per_day || 0);
            const subtotal = Math.round(dailyRate * days * 100) / 100;
            const insuranceFee = days * 8;
            const securityDeposit = Number((vehicle.house_rules as any)?.securityDeposit ?? 0);
            // Derive service fee from stored total so we always match what was charged
            const derivedFee = Math.max(
              0,
              Math.round((total - subtotal - insuranceFee - securityDeposit) * 100) / 100,
            );
            return (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <DollarSign className="h-4 w-4" /> Pago
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Tarifa/día</span>
                    <span>${dailyRate.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Días</span>
                    <span>{days}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span>${subtotal.toFixed(2)}</span>
                  </div>
                  {derivedFee > 0 && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Comisión de servicio</span>
                      <span>${derivedFee.toFixed(2)}</span>
                    </div>
                  )}
                  {insuranceFee > 0 && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Seguro</span>
                      <span>${insuranceFee.toFixed(2)}</span>
                    </div>
                  )}
                  {securityDeposit > 0 && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Depósito reembolsable</span>
                      <span>${securityDeposit.toFixed(2)}</span>
                    </div>
                  )}
                  <Separator />
                  <div className="flex justify-between font-semibold">
                    <span>Total</span>
                    <span>${total.toFixed(2)}</span>
                  </div>
                  {payment?.payment_method && (
                    <p className="text-xs text-muted-foreground pt-1">Método: {payment.payment_method}</p>
                  )}
                </CardContent>
              </Card>
            );
          })()}

          <Card className="md:col-span-3">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <ClipboardCheck className="h-4 w-4" /> Inspecciones y contrato
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              <Button asChild variant="outline" size="sm">
                <Link to={`/reservas/${reservation.id}/contrato`}>
                  <FileText className="h-4 w-4 mr-1" /> Ver contrato
                </Link>
              </Button>
              {(reservation.status === "approved" || reservation.status === "active") && !isOwnerView && (
                <Button asChild size="sm" variant={inspections.pickup ? "outline" : "default"}>
                  <Link to={`/reservas/${reservation.id}/inspeccion-entrega`}>
                    <ClipboardCheck className="h-4 w-4 mr-1" />
                    {inspections.pickup ? "Ver inspección de entrega" : "Confirmar entrega"}
                  </Link>
                </Button>
              )}
              {(reservation.status === "active" || reservation.status === "completed") && isOwnerView && (
                <Button asChild size="sm" variant={inspections.ret ? "outline" : "default"}>
                  <Link to={`/reservas/${reservation.id}/inspeccion-devolucion`}>
                    <ClipboardCheck className="h-4 w-4 mr-1" />
                    {inspections.ret ? "Ver inspección de devolución" : "Registrar devolución"}
                  </Link>
                </Button>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
      <Footer />
    </div>
  );
}
