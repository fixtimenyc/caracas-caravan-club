import { useEffect, useMemo, useState } from "react";
import { useParams, Link, Navigate } from "react-router-dom";
import { format, parseISO, differenceInCalendarDays } from "date-fns";
import { es } from "date-fns/locale";
import { ArrowLeft, Printer, FileText, Loader2 } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

const STORAGE_KEY = "ruedave_system_settings_v1";

const loadContractSettings = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return {
      version: parsed?.contract?.version ?? "1.0",
      company_legal_name: parsed?.contract?.company_legal_name ?? "RUEDAVE C.A.",
      company_rif: parsed?.contract?.company_rif ?? "J-XXXXXXXX-X",
      company_address: parsed?.contract?.company_address ?? "Caracas, Venezuela",
      jurisdiction:
        parsed?.contract?.jurisdiction ??
        "Tribunales de la República Bolivariana de Venezuela, con sede en Caracas",
      website: parsed?.business?.website ?? "https://ruedave.com",
      body: parsed?.contract?.body ?? "",
      enabled: parsed?.contract?.enabled ?? true,
    };
  } catch {
    return null;
  }
};

const DEFAULT_BODY = `CONTRATO DE ARRENDAMIENTO DE VEHÍCULO

Entre {{empresa_razon_social}} (RIF {{empresa_rif}}), con domicilio en {{empresa_direccion}}, actuando como intermediario de la plataforma {{empresa_sitio}}, y el ARRENDATARIO {{arrendatario_nombre}}, C.I. {{arrendatario_cedula}}, con licencia de conducir N° {{arrendatario_licencia}} y domicilio en {{arrendatario_direccion}}, y el PROPIETARIO {{propietario_nombre}}, C.I. {{propietario_cedula}}, se celebra el presente contrato de arrendamiento del vehículo {{vehiculo_marca}} {{vehiculo_modelo}} {{vehiculo_anio}}, color {{vehiculo_color}}, placa {{vehiculo_placa}}, VIN {{vehiculo_vin}}.

PERÍODO: Desde {{inicio}} hasta {{fin}} ({{dias}} día(s)).
LUGAR DE ENTREGA: {{lugar_entrega}}.
LUGAR DE DEVOLUCIÓN: {{lugar_devolucion}}.
KM INICIAL: {{km_inicio}} — KM MÁX POR DÍA: {{km_max_dia}}.

VALOR TOTAL: {{total}} {{moneda}}. Tarifa/día: {{tarifa_dia}}. Comisión plataforma: {{comision}}. Seguro: {{seguro}}. Depósito: {{deposito}}.
MÉTODO DE PAGO: {{metodo_pago}} — REF: {{referencia_pago}} — FECHA: {{fecha_pago}}.

OBLIGACIONES DEL ARRENDATARIO: conducir con licencia vigente, respetar las leyes de tránsito, no fumar dentro del vehículo (multa {{multa_fumar}}), devolverlo en las mismas condiciones y con el mismo nivel de combustible.

JURISDICCIÓN: {{jurisdiccion}}.

Contrato versión {{contrato_version}} — Aceptado el {{fecha_aceptacion}} desde {{ip_aceptacion}} / {{dispositivo}}.`;

export default function ReservationContractPage() {
  const { id } = useParams<{ id: string }>();
  const { user, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [allowed, setAllowed] = useState(false);
  const [data, setData] = useState<any>(null);
  const settings = useMemo(() => loadContractSettings(), []);

  useEffect(() => {
    if (!id || !user) return;
    (async () => {
      setLoading(true);
      const { data: r } = await supabase
        .from("reservations")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (!r) { setLoading(false); return; }
      const { data: v } = await supabase.from("vehicles").select("*").eq("id", r.vehicle_id).maybeSingle();
      const canView = r.renter_id === user.id || v?.owner_id === user.id;
      if (!canView) { setLoading(false); return; }
      setAllowed(true);
      const [{ data: renterRows }, { data: payment }, { data: pickup }] = await Promise.all([
        supabase.rpc("get_reservation_renter_info", { _reservation_id: id }),
        supabase
          .from("payments")
          .select("*")
          .eq("reservation_id", id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from("vehicle_inspections")
          .select("mileage")
          .eq("reservation_id", id)
          .eq("type", "pickup")
          .maybeSingle(),
      ]);
      const renter = Array.isArray(renterRows) ? renterRows[0] : renterRows;
      const ownerProfile = v?.owner_id
        ? (await supabase.from("profiles").select("*").eq("user_id", v.owner_id).maybeSingle()).data
        : null;
      const renterProfile = (
        await supabase.from("profiles").select("*").eq("user_id", r.renter_id).maybeSingle()
      ).data;
      setData({ r, v, renter, renterProfile, ownerProfile, payment, pickup });
      setLoading(false);
    })();
  }, [id, user]);

  const rendered = useMemo(() => {
    if (!data || !settings) return "";
    const { r, v, renter, renterProfile, ownerProfile, payment } = data;
    const days = Math.max(1, differenceInCalendarDays(parseISO(r.end_date), parseISO(r.start_date)));
    const securityDeposit = Number((v?.house_rules as any)?.securityDeposit ?? 200);
    const insuranceFee = days * 8;
    const tarifaDia = Number(v?.price_per_day ?? 0);
    const subtotal = tarifaDia * days;
    const serviceFee = Math.round(subtotal * 0.1 * 100) / 100;
    const totalCharged = Number(r.total_price);
    const totalConDeposito = subtotal + serviceFee + insuranceFee + securityDeposit;
    const totalMostrar = totalCharged >= totalConDeposito - 1 ? totalCharged : totalConDeposito;
    const dash = (v: any) => (v === null || v === undefined || v === "" ? "—" : String(v));
    const fmt = (n: number) => `$${n.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
    const accepted = r.created_at;
    const map: Record<string, string> = {
      reserva_id: r.id,
      arrendatario_nombre: renter?.full_name ?? renterProfile?.full_name ?? "—",
      arrendatario_cedula: renter?.document_number ?? renterProfile?.cedula ?? "—",
      arrendatario_licencia: renter?.driving_license_number ?? "—",
      arrendatario_direccion: renter?.address ?? renterProfile?.address ?? "—",
      propietario_nombre: ownerProfile?.full_name ?? "—",
      propietario_cedula: ownerProfile?.cedula ?? "—",
      vehiculo_marca: dash(v?.brand),
      vehiculo_modelo: dash(v?.model),
      vehiculo_anio: dash(v?.year),
      vehiculo_color: dash(v?.color) === "—" ? "Por registrar" : v.color,
      vehiculo_placa: dash(v?.plate) === "—" ? "Por registrar" : v.plate,
      vehiculo_vin: dash(v?.vin) === "—" ? "Por registrar" : v.vin,
      km_inicio: r.start_mileage != null ? r.start_mileage.toLocaleString() : "Se registrará en la entrega",
      km_max_dia: (v?.house_rules as any)?.maxKmPerDay ? String((v.house_rules as any).maxKmPerDay) : "Sin límite",
      inicio: format(parseISO(r.start_date), "PPP", { locale: es }),
      fin: format(parseISO(r.end_date), "PPP", { locale: es }),
      dias: String(days),
      lugar_entrega: v?.location ?? v?.zone ?? "—",
      lugar_devolucion: v?.location ?? v?.zone ?? "—",
      tarifa_dia: fmt(tarifaDia),
      subtotal: fmt(subtotal),
      comision: fmt(serviceFee),
      seguro: fmt(insuranceFee),
      deposito: fmt(securityDeposit),
      total: fmt(totalMostrar),
      moneda: "USD",
      metodo_pago: payment?.payment_method && payment.payment_method !== "pending" ? payment.payment_method : "Pago pendiente de confirmación",
      referencia_pago: payment?.id?.slice(0, 8).toUpperCase() ?? "—",
      fecha_pago: payment?.created_at
        ? format(parseISO(payment.created_at), "PPP p", { locale: es })
        : "Pendiente",
      multa_fumar: `$${(v?.house_rules as any)?.smokingFine ?? 50}`,
      empresa_razon_social: settings.company_legal_name,
      empresa_rif: settings.company_rif,
      empresa_direccion: settings.company_address,
      empresa_sitio: settings.website,
      jurisdiccion: settings.jurisdiction,
      contrato_version: settings.version,
      fecha_aceptacion: format(parseISO(accepted), "PPP p", { locale: es }),
      ip_aceptacion: "—",
      dispositivo: "—",
    };
    const body = settings.body && settings.body.trim().length > 0 ? settings.body : DEFAULT_BODY;
    return body.replace(/\{\{(\w+)\}\}/g, (_, k) => map[k] ?? `{{${k}}}`);
  }, [data, settings]);

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!user) return <Navigate to="/auth" replace />;

  return (
    <div className="min-h-screen flex flex-col bg-muted/20 print:bg-white">
      <div className="print:hidden">
        <Navbar />
      </div>
      <main className="flex-1 container mx-auto px-4 pt-24 pb-16 max-w-4xl print:pt-6">
        <div className="flex items-center justify-between gap-2 mb-4 print:hidden">
          <Button variant="ghost" size="sm" asChild>
            <Link to={`/reservas/${id}`}>
              <ArrowLeft className="h-4 w-4 mr-1" /> Volver a la reserva
            </Link>
          </Button>
          <div className="flex items-center gap-2">
            {data?.r?.status && <Badge variant="outline">Estado: {data.r.status}</Badge>}
            <Button size="sm" onClick={() => window.print()}>
              <Printer className="h-4 w-4 mr-1" /> Imprimir / PDF
            </Button>
          </div>
        </div>
        <Card className="print:border-0 print:shadow-none">
          <CardContent className="p-6 md:p-10">
            {!allowed ? (
              <p className="text-sm text-muted-foreground">No tienes permiso para ver este contrato.</p>
            ) : !data ? (
              <p className="text-sm text-muted-foreground">Reserva no encontrada.</p>
            ) : (
              <article className="prose prose-sm max-w-none whitespace-pre-wrap font-serif text-foreground leading-relaxed">
                <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground mb-4 not-prose">
                  <FileText className="h-4 w-4" />
                  Contrato v{settings?.version} · Reserva #{id?.slice(0, 8).toUpperCase()}
                </div>
                {rendered}
              </article>
            )}
          </CardContent>
        </Card>
      </main>
      <div className="print:hidden">
        <Footer />
      </div>
    </div>
  );
}
