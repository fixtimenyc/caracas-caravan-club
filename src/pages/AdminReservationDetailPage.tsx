import { useEffect, useMemo, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { format, differenceInCalendarDays } from "date-fns";
import { es } from "date-fns/locale";
import {
  ArrowLeft, Phone, MessageSquare, Mail, Calendar, Car, User, DollarSign,
  Clock, CheckCircle2, XCircle, AlertCircle, Send, FileText, MapPin, Bell,
} from "lucide-react";
import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import ReservationInspectionsPanel from "@/components/admin/ReservationInspectionsPanel";
import AdminPaymentVerification from "@/components/AdminPaymentVerification";
import { resolveVehiclePhoto } from "@/lib/vehiclePhoto";

const STATUS_META: Record<string, { label: string; cls: string }> = {
  pending: { label: "Pendiente", cls: "bg-yellow-500/10 text-yellow-700 border-yellow-500/30" },
  awaiting_payment: { label: "Esperando pago", cls: "bg-orange-500/10 text-orange-700 border-orange-500/30" },
  approved: { label: "Aprobada", cls: "bg-emerald-500/10 text-emerald-700 border-emerald-500/30" },
  active: { label: "Activa", cls: "bg-blue-500/10 text-blue-700 border-blue-500/30" },
  completed: { label: "Completada", cls: "bg-muted text-muted-foreground border-border" },
  cancelled: { label: "Cancelada", cls: "bg-red-500/10 text-red-700 border-red-500/30" },
  rejected: { label: "Rechazada", cls: "bg-red-500/10 text-red-700 border-red-500/30" },
};

const TIMELINE_STEPS = [
  { key: "created", label: "Creada" },
  { key: "awaiting_payment", label: "Pago" },
  { key: "approved", label: "Aprobada" },
  { key: "active", label: "Activa" },
  { key: "completed", label: "Completada" },
];

export default function AdminReservationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [reservation, setReservation] = useState<any>(null);
  const [vehicle, setVehicle] = useState<any>(null);
  const [vehiclePhoto, setVehiclePhoto] = useState<string | null>(null);
  const [renter, setRenter] = useState<any>(null);
  const [owner, setOwner] = useState<any>(null);
  const [events, setEvents] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [note, setNote] = useState("");
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("client");
  const [cancelNotes, setCancelNotes] = useState("");

  const load = async () => {
    if (!id) return;
    setLoading(true);
    const { data: r } = await supabase.from("reservations").select("*").eq("id", id).maybeSingle();
    if (!r) { setLoading(false); return; }
    setReservation(r);
    const [{ data: v }, { data: rp }, { data: ev }, { data: pay }] = await Promise.all([
      supabase.from("vehicles").select("*").eq("id", r.vehicle_id).maybeSingle(),
      supabase.from("profiles").select("*").eq("user_id", r.renter_id).maybeSingle(),
      supabase.from("reservation_events").select("*").eq("reservation_id", id).order("created_at", { ascending: false }),
      supabase.from("payments").select("*").eq("reservation_id", id).order("created_at", { ascending: false }),
    ]);
    setVehicle(v);
    setVehiclePhoto(
      v?.photos?.[0] ? await resolveVehiclePhoto(v.photos[0]) : null,
    );
    setRenter(rp);
    setEvents(ev || []);
    setPayments(pay || []);
    if (v?.owner_id) {
      const { data: o } = await supabase.from("profiles").select("*").eq("user_id", v.owner_id).maybeSingle();
      setOwner(o);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, [id]);

  const days = useMemo(() => {
    if (!reservation) return 0;
    return Math.max(differenceInCalendarDays(new Date(reservation.end_date), new Date(reservation.start_date)), 1);
  }, [reservation]);

  const finance = useMemo(() => {
    if (!reservation || !vehicle) return null;
    const dailyRate = Number(vehicle.price_per_day) || 0;
    const subtotal = dailyRate * days;
    const insurance = days * 8;
    const commission = Math.round(subtotal * 0.10 * 100) / 100;
    const total = Number(reservation.total_price) || (subtotal + insurance + commission);
    const payout = subtotal - commission;
    return { dailyRate, subtotal, insurance, commission, total, payout };
  }, [reservation, vehicle, days]);

  const currentStep = useMemo(() => {
    if (!reservation) return 0;
    if (["cancelled", "rejected"].includes(reservation.status)) return -1;
    const idx = TIMELINE_STEPS.findIndex(s => s.key === reservation.status);
    return idx >= 0 ? idx : 0;
  }, [reservation]);

  const setStatus = async (status: any) => {
    const { error } = await supabase.from("reservations").update({ status }).eq("id", id!);
    if (error) return toast.error(error.message);
    toast.success("Estado actualizado");
    load();
  };

  const computeRefund = () => {
    if (!reservation || !finance) return { pct: 0, amount: 0 };
    const start = new Date(reservation.start_date);
    const hours = (start.getTime() - Date.now()) / 36e5;
    const pct = hours < 24 ? 0 : hours < 48 ? 50 : 100;
    return { pct, amount: Math.round((finance.total * pct) / 100 * 100) / 100 };
  };

  const refund = computeRefund();

  const confirmCancel = async () => {
    const { error } = await supabase.from("reservations").update({
      status: "cancelled",
      cancellation_reason: cancelReason,
      refund_percent: refund.pct,
      refund_amount: refund.amount,
      cancelled_at: new Date().toISOString(),
    }).eq("id", id!);
    if (error) return toast.error(error.message);
    if (cancelNotes) {
      await supabase.from("reservation_events").insert({
        reservation_id: id!, event_type: "note", actor_id: (await supabase.auth.getUser()).data.user?.id,
        message: `Motivo cancelación: ${cancelNotes}`,
      });
    }
    setCancelOpen(false);
    toast.success("Reserva cancelada");
    load();
  };

  const addNote = async () => {
    if (!note.trim()) return;
    const uid = (await supabase.auth.getUser()).data.user?.id;
    const { error } = await supabase.from("reservation_events").insert({
      reservation_id: id!, event_type: "note", actor_id: uid, message: note,
    });
    if (error) return toast.error(error.message);
    setNote("");
    load();
  };

  const sendReminder = async () => {
    if (!renter?.user_id) return;
    const uid = (await supabase.auth.getUser()).data.user?.id;
    await supabase.from("notifications").insert({
      user_id: renter.user_id, type: "reservation",
      title: "Recordatorio de reserva",
      message: `Tu reserva del ${format(new Date(reservation.start_date), "dd MMM", { locale: es })} se acerca.`,
      action_url: `/mis-reservas`, reservation_id: id!,
    });
    await supabase.from("reservation_events").insert({
      reservation_id: id!, event_type: "reminder_sent", actor_id: uid, message: "Recordatorio enviado al rentador",
    });
    toast.success("Recordatorio enviado");
    load();
  };

  if (loading) {
    return <AdminLayout title="Detalle de Reserva"><div className="space-y-4"><Skeleton className="h-12 w-64" /><Skeleton className="h-96" /></div></AdminLayout>;
  }
  if (!reservation) {
    return <AdminLayout title="Detalle de Reserva"><div className="text-center py-12"><p className="text-muted-foreground">Reserva no encontrada</p><Button onClick={() => navigate("/admin/reservas")} className="mt-4">Volver</Button></div></AdminLayout>;
  }

  const status = STATUS_META[reservation.status] || STATUS_META.pending;
  const shortId = `RES-${reservation.id.slice(0, 8).toUpperCase()}`;
  const wa = renter?.phone ? `https://wa.me/${renter.phone.replace(/\D/g, "")}` : null;
  const ownerWa = owner?.phone ? `https://wa.me/${owner.phone.replace(/\D/g, "")}` : null;

  return (
    <AdminLayout title="Detalle de Reserva">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <Button variant="ghost" size="sm" onClick={() => navigate("/admin/reservas")} className="mb-2 -ml-2">
              <ArrowLeft className="h-4 w-4 mr-1" /> Volver
            </Button>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-bold">#{shortId}</h1>
              <Badge variant="outline" className={status.cls}>{status.label}</Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Creada el {format(new Date(reservation.created_at), "dd MMM yyyy 'a las' HH:mm", { locale: es })}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {reservation.status === "pending" && (
              <>
                <Button onClick={() => setStatus("awaiting_payment")}><CheckCircle2 className="h-4 w-4 mr-1" /> Aprobar (esperar pago)</Button>
                <Button variant="outline" onClick={() => setStatus("rejected")}><XCircle className="h-4 w-4 mr-1" /> Rechazar</Button>
              </>
            )}
            {reservation.status === "approved" && (
              <Button onClick={() => setStatus("active")}>Activar</Button>
            )}
            {reservation.status === "active" && (
              <Button onClick={() => setStatus("completed")}>Marcar completada</Button>
            )}
            {!["cancelled", "rejected", "completed"].includes(reservation.status) && (
              <Button variant="destructive" onClick={() => setCancelOpen(true)}>Cancelar</Button>
            )}
            <Button variant="outline" onClick={sendReminder}><Bell /> Recordatorio</Button>
          </div>
        </div>

        {/* Timeline */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between gap-2">
              {TIMELINE_STEPS.map((step, i) => {
                const done = currentStep >= 0 && i <= currentStep;
                const cancelled = currentStep === -1;
                return (
                  <div key={step.key} className="flex-1 flex items-center">
                    <div className="flex flex-col items-center flex-shrink-0">
                      <div className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-semibold ${
                        cancelled ? "bg-muted text-muted-foreground" : done ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                      }`}>{i + 1}</div>
                      <span className="text-xs mt-1 whitespace-nowrap">{step.label}</span>
                    </div>
                    {i < TIMELINE_STEPS.length - 1 && (
                      <div className={`flex-1 h-0.5 mx-2 ${done && currentStep > i ? "bg-primary" : "bg-muted"}`} />
                    )}
                  </div>
                );
              })}
            </div>
            {currentStep === -1 && (
              <div className="mt-4 flex items-center gap-2 text-sm text-red-700 bg-red-500/10 rounded p-2">
                <AlertCircle className="h-4 w-4" />
                Reserva {reservation.status === "cancelled" ? "cancelada" : "rechazada"}
                {reservation.cancellation_reason && ` — ${reservation.cancellation_reason}`}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Left: details */}
          <div className="lg:col-span-2 space-y-6">
            {/* Vehicle */}
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><Car className="h-4 w-4" /> Vehículo</CardTitle></CardHeader>
              <CardContent>
                <div className="flex gap-4">
                  {vehiclePhoto && (
                    <img src={vehiclePhoto} alt={`${vehicle?.brand || "Vehículo"} ${vehicle?.model || ""}`} className="w-32 h-24 object-cover rounded" />
                  )}
                  <div className="flex-1">
                    <p className="font-semibold">{vehicle?.brand} {vehicle?.model} {vehicle?.year}</p>
                    <p className="text-sm text-muted-foreground">Placa: {vehicle?.plate || "—"}</p>
                    <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                      <MapPin className="h-3 w-3" /> {vehicle?.zone || vehicle?.location}
                    </p>
                    <Link to={`/admin/flota/${vehicle?.id}`} className="text-xs text-primary hover:underline mt-2 inline-block">
                      Ver detalle de flota →
                    </Link>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Renter */}
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><User className="h-4 w-4" /> Rentador</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold">{renter?.full_name || "Sin nombre"}</p>
                    <p className="text-sm text-muted-foreground">{renter?.phone || "Sin teléfono"}</p>
                  </div>
                  <div className="flex gap-2">
                    {wa && <Button size="sm" variant="outline" asChild><a href={wa} target="_blank" rel="noreferrer"><MessageSquare className="h-4 w-4" /></a></Button>}
                    {renter?.phone && <Button size="sm" variant="outline" asChild><a href={`tel:${renter.phone}`}><Phone className="h-4 w-4" /></a></Button>}
                    <Link to={`/admin/usuarios/${renter?.user_id}`}><Button size="sm" variant="outline">Perfil</Button></Link>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Owner */}
            {owner && (
              <Card>
                <CardHeader><CardTitle className="flex items-center gap-2"><User className="h-4 w-4" /> Dueño</CardTitle></CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold">{owner.full_name || "Sin nombre"}</p>
                      <p className="text-sm text-muted-foreground">{owner.phone || "Sin teléfono"}</p>
                    </div>
                    <div className="flex gap-2">
                      {ownerWa && <Button size="sm" variant="outline" asChild><a href={ownerWa} target="_blank" rel="noreferrer"><MessageSquare className="h-4 w-4" /></a></Button>}
                      <Link to={`/admin/usuarios/${owner.user_id}`}><Button size="sm" variant="outline">Perfil</Button></Link>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Dates */}
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><Calendar className="h-4 w-4" /> Fechas</CardTitle></CardHeader>
              <CardContent className="grid grid-cols-3 gap-4 text-sm">
                <div><p className="text-muted-foreground">Inicio</p><p className="font-semibold">{format(new Date(reservation.start_date), "dd MMM yyyy", { locale: es })}</p></div>
                <div><p className="text-muted-foreground">Fin</p><p className="font-semibold">{format(new Date(reservation.end_date), "dd MMM yyyy", { locale: es })}</p></div>
                <div><p className="text-muted-foreground">Días</p><p className="font-semibold">{days}</p></div>
              </CardContent>
            </Card>

            {/* Mileage */}
            <MileageCard reservation={reservation} onSaved={load} />

            {/* Inspections */}
            <ReservationInspectionsPanel reservationId={reservation.id} />

            {/* Event log */}
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><Clock className="h-4 w-4" /> Historial</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div className="flex gap-2">
                  <Textarea placeholder="Agregar nota interna..." value={note} onChange={e => setNote(e.target.value)} rows={2} />
                  <Button onClick={addNote} size="sm"><Send className="h-4 w-4" /></Button>
                </div>
                <Separator />
                {events.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">Sin eventos</p>
                ) : (
                  <div className="space-y-3">
                    {events.map(e => (
                      <div key={e.id} className="flex gap-3 text-sm">
                        <div className="w-2 h-2 rounded-full bg-primary mt-1.5 flex-shrink-0" />
                        <div className="flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-medium capitalize">{e.event_type.replace(/_/g, " ")}</span>
                            <span className="text-xs text-muted-foreground">{format(new Date(e.created_at), "dd MMM HH:mm", { locale: es })}</span>
                          </div>
                          {e.message && <p className="text-muted-foreground">{e.message}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right: finance */}
          <div className="space-y-6">
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><DollarSign className="h-4 w-4" /> Finanzas</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Tarifa diaria</span><span>${finance?.dailyRate.toFixed(2)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Días</span><span>{days}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>${finance?.subtotal.toFixed(2)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Seguro ($8/día)</span><span>${finance?.insurance.toFixed(2)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Comisión RUEDAVE (10%)</span><span className="text-red-600">−${finance?.commission.toFixed(2)}</span></div>
                <Separator />
                <div className="flex justify-between font-semibold"><span>Total cobrado</span><span>${finance?.total.toFixed(2)}</span></div>
                <div className="flex justify-between font-semibold text-emerald-700"><span>Payout dueño</span><span>${finance?.payout.toFixed(2)}</span></div>
                {reservation.refund_amount != null && (
                  <>
                    <Separator />
                    <div className="flex justify-between text-sm"><span className="text-muted-foreground">Reembolso ({reservation.refund_percent}%)</span><span>${Number(reservation.refund_amount).toFixed(2)}</span></div>
                  </>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><FileText className="h-4 w-4" /> Pagos</CardTitle></CardHeader>
              <CardContent>
                {payments.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Sin pagos registrados</p>
                ) : payments.map(p => (
                  <div key={p.id} className="flex justify-between text-sm py-1">
                    <span>{p.payment_method}</span>
                    <span className="font-semibold">${Number(p.amount).toFixed(2)}</span>
                    <Badge variant="outline">{p.status}</Badge>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Cancel modal */}
      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancelar reserva</DialogTitle>
            <DialogDescription>Política automática según anticipación.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Motivo</Label>
              <Select value={cancelReason} onValueChange={setCancelReason}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="client">Cancelación del cliente</SelectItem>
                  <SelectItem value="request">Por solicitud</SelectItem>
                  <SelectItem value="problem">Por problema</SelectItem>
                  <SelectItem value="force_majeure">Fuerza mayor</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Notas adicionales</Label>
              <Textarea value={cancelNotes} onChange={e => setCancelNotes(e.target.value)} rows={3} />
            </div>
            <div className="bg-muted/50 rounded p-3 text-sm space-y-1">
              <p>Reembolso automático: <strong>{refund.pct}%</strong></p>
              <p>Monto a reembolsar: <strong>${refund.amount.toFixed(2)}</strong></p>
              <p className="text-xs text-muted-foreground">&lt;24h: 0% · 24-48h: 50% · &gt;48h: 100%</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelOpen(false)}>Cerrar</Button>
            <Button variant="destructive" onClick={confirmCancel}>Confirmar cancelación</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}

function MileageCard({ reservation, onSaved }: { reservation: any; onSaved: () => void }) {
  const [start, setStart] = useState<string>(reservation.start_mileage?.toString() ?? "");
  const [end, setEnd] = useState<string>(reservation.end_mileage?.toString() ?? "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setStart(reservation.start_mileage?.toString() ?? "");
    setEnd(reservation.end_mileage?.toString() ?? "");
  }, [reservation.id, reservation.start_mileage, reservation.end_mileage]);

  const driven =
    start && end && Number(end) >= Number(start) ? Number(end) - Number(start) : null;

  const save = async () => {
    setSaving(true);
    const { error } = await supabase
      .from("reservations")
      .update({
        start_mileage: start ? Number(start) : null,
        end_mileage: end ? Number(end) : null,
      })
      .eq("id", reservation.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Kilometraje actualizado");
    onSaved();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Car className="h-4 w-4" /> Kilometraje
        </CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
        <div>
          <Label className="text-xs text-muted-foreground">Km al inicio</Label>
          <Input
            type="number"
            inputMode="numeric"
            value={start}
            onChange={(e) => setStart(e.target.value)}
            placeholder="0"
          />
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Km al final</Label>
          <Input
            type="number"
            inputMode="numeric"
            value={end}
            onChange={(e) => setEnd(e.target.value)}
            placeholder="0"
          />
        </div>
        <div className="flex flex-col justify-end">
          <p className="text-xs text-muted-foreground">Km recorridos</p>
          <p className="font-semibold text-lg">
            {driven != null ? `${driven.toLocaleString()} km` : "—"}
          </p>
        </div>
        <div className="md:col-span-3 flex justify-end">
          <Button size="sm" onClick={save} disabled={saving}>
            {saving ? "Guardando..." : "Guardar kilometraje"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

