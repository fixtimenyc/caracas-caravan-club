import { useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { format, parseISO, differenceInCalendarDays } from "date-fns";
import { es } from "date-fns/locale";
import { ArrowLeft, Printer, FileText } from "lucide-react";
import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";

import { loadSystemSettings, computePriceBreakdown } from "@/lib/systemSettings";

const loadContractSettings = () => {
  const s = loadSystemSettings();
  return {
    version: s.contract.version,
    company_legal_name: s.contract.company_legal_name,
    company_rif: s.contract.company_rif,
    company_address: s.contract.company_address,
    jurisdiction: s.contract.jurisdiction,
    website: s.business.website,
    body: s.contract.body,
    enabled: s.contract.enabled,
  };
};

const DEFAULT_BODY = `CONTRATO DE ARRENDAMIENTO DE VEHÍCULO

Entre {{empresa_razon_social}} (RIF {{empresa_rif}}), con domicilio en {{empresa_direccion}}, actuando como intermediario de la plataforma {{empresa_sitio}}, y el ARRENDATARIO {{arrendatario_nombre}}, C.I. {{arrendatario_cedula}}, con licencia de conducir N° {{arrendatario_licencia}} y domicilio en {{arrendatario_direccion}}, y el PROPIETARIO {{propietario_nombre}}, C.I. {{propietario_cedula}}, se celebra el presente contrato de arrendamiento del vehículo {{vehiculo_marca}} {{vehiculo_modelo}} {{vehiculo_anio}}, color {{vehiculo_color}}, placa {{vehiculo_placa}}, VIN {{vehiculo_vin}}.

PERÍODO: Desde {{inicio}} hasta {{fin}} ({{dias}} día(s)).
LUGAR DE ENTREGA: {{lugar_entrega}}.
LUGAR DE DEVOLUCIÓN: {{lugar_devolucion}}.
KM INICIAL: {{km_inicio}} — KM MÁX POR DÍA: {{km_max_dia}}.

VALOR TOTAL: {{total}} {{moneda}}. Tarifa/día: {{tarifa_dia}}. Comisión plataforma: {{comision}}. Seguro: {{seguro}}. Depósito: {{deposito}}.
MÉTODO DE PAGO: {{metodo_pago}} — REF: {{referencia_pago}} — FECHA: {{fecha_pago}}.

JURISDICCIÓN: {{jurisdiccion}}.

Contrato versión {{contrato_version}} — Aceptado el {{fecha_aceptacion}} desde {{ip_aceptacion}} / {{dispositivo}}.`;

export default function AdminReservationContractPage() {
  const { id } = useParams<{ id: string }>();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const settings = useMemo(() => loadContractSettings(), []);

  useEffect(() => {
    if (!id) return;
    (async () => {
      setLoading(true);
      const { data: r } = await supabase
        .from("reservations")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (!r) {
        setLoading(false);
        return;
      }
      const [{ data: v }, { data: renterRows }, { data: payment }, { data: pickup }] = await Promise.all([
        supabase.from("vehicles").select("*").eq("id", r.vehicle_id).maybeSingle(),
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
        ? (
            await supabase
              .from("profiles")
              .select("*")
              .eq("user_id", v.owner_id)
              .maybeSingle()
          ).data
        : null;
      const renterProfile = (
        await supabase
          .from("profiles")
          .select("*")
          .eq("user_id", r.renter_id)
          .maybeSingle()
      ).data;
      setData({ r, v, renter, renterProfile, ownerProfile, payment, pickup });
      setLoading(false);
    })();
  }, [id]);

  const rendered = useMemo(() => {
    if (!data || !settings) return "";
    const { r, v, renter, renterProfile, ownerProfile, payment, pickup } = data;
    const sys = loadSystemSettings();
    const bd = computePriceBreakdown(sys, v, r.start_date, r.end_date);
    const { days, pricePerDay: tarifaDia, subtotal, commissionPct, commission: serviceFee, insurance: insuranceFee, deposit: securityDeposit, totalWithDeposit } = bd;
    const totalCharged = Number(r.total_price);
    const totalMostrar = totalCharged >= totalWithDeposit - 1 ? totalCharged : totalWithDeposit;
    const dash = (val: any) => (val === null || val === undefined || val === "" ? "—" : String(val));
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
      km_inicio: (pickup?.mileage ?? r.start_mileage) != null ? Number(pickup?.mileage ?? r.start_mileage).toLocaleString() : "Se registrará en la entrega",
      km_max_dia: (v?.house_rules as any)?.maxKmPerDay ? String((v.house_rules as any).maxKmPerDay) : "Sin límite",
      inicio: format(parseISO(r.start_date), "PPP", { locale: es }),
      fin: format(parseISO(r.end_date), "PPP", { locale: es }),
      dias: String(days),
      lugar_entrega: v?.location ?? v?.zone ?? "—",
      lugar_devolucion: v?.location ?? v?.zone ?? "—",
      tarifa_dia: fmt(tarifaDia),
      subtotal: fmt(subtotal),
      comision: `${fmt(serviceFee)} (${commissionPct}%)`,
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
    return settings.body.replace(/\{\{(\w+)\}\}/g, (_, k) => map[k] ?? `{{${k}}}`);
  }, [data, settings]);

  return (
    <AdminLayout title="Contrato de la reserva">
      <div className="space-y-4 print:space-y-0">
        <div className="flex items-center justify-between gap-2 print:hidden">
          <Button variant="ghost" size="sm" asChild>
            <Link to={`/admin/reservas/${id}`}>
              <ArrowLeft className="h-4 w-4" /> Volver a la reserva
            </Link>
          </Button>
          <div className="flex items-center gap-2">
            {data?.r?.status && (
              <Badge variant="outline">Estado: {data.r.status}</Badge>
            )}
            <Button size="sm" onClick={() => window.print()}>
              <Printer className="h-4 w-4" /> Imprimir / PDF
            </Button>
          </div>
        </div>

        <Card className="print:border-0 print:shadow-none">
          <CardContent className="p-6 md:p-10">
            {loading ? (
              <div className="space-y-2">
                {Array.from({ length: 12 }).map((_, i) => (
                  <Skeleton key={i} className="h-4 w-full" />
                ))}
              </div>
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
      </div>
    </AdminLayout>
  );
}
