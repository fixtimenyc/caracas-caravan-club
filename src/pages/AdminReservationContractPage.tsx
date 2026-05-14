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
      const [{ data: v }, { data: renter }, { data: payment }] = await Promise.all([
        supabase.from("vehicles").select("*").eq("id", r.vehicle_id).maybeSingle(),
        supabase
          .from("renter_verifications")
          .select("*")
          .eq("user_id", r.renter_id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from("payments")
          .select("*")
          .eq("reservation_id", id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);
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
      setData({ r, v, renter, renterProfile, ownerProfile, payment });
      setLoading(false);
    })();
  }, [id]);

  const rendered = useMemo(() => {
    if (!data || !settings) return "";
    const { r, v, renter, renterProfile, ownerProfile, payment } = data;
    const days = Math.max(
      1,
      differenceInCalendarDays(parseISO(r.end_date), parseISO(r.start_date)),
    );
    const tarifaDia = r.total_price > 0 ? r.total_price / days : 0;
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
      vehiculo_marca: v?.brand ?? "—",
      vehiculo_modelo: v?.model ?? "—",
      vehiculo_anio: String(v?.year ?? "—"),
      vehiculo_color: v?.color ?? "—",
      vehiculo_placa: v?.plate ?? "—",
      vehiculo_vin: v?.vin ?? "—",
      km_inicio: r.start_mileage != null ? r.start_mileage.toLocaleString() : "—",
      km_max_dia: String(v?.house_rules?.maxKmPerDay ?? "—"),
      inicio: format(parseISO(r.start_date), "PPP", { locale: es }),
      fin: format(parseISO(r.end_date), "PPP", { locale: es }),
      dias: String(days),
      lugar_entrega: v?.location ?? v?.zone ?? "—",
      lugar_devolucion: v?.location ?? v?.zone ?? "—",
      tarifa_dia: fmt(tarifaDia),
      subtotal: fmt(r.total_price),
      comision: fmt(r.total_price * 0.1),
      seguro: fmt(0),
      deposito: fmt(0),
      total: fmt(Number(r.total_price)),
      moneda: "USD",
      metodo_pago: payment?.payment_method ?? "—",
      referencia_pago: payment?.id?.slice(0, 8).toUpperCase() ?? "—",
      fecha_pago: payment?.created_at
        ? format(parseISO(payment.created_at), "PPP p", { locale: es })
        : "—",
      multa_fumar: `$${v?.house_rules?.smokingFine ?? 50}`,
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
