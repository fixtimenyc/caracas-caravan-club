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

const DEFAULT_BODY = `CONTRATO DE ARRENDAMIENTO DE VEHÍCULO ENTRE PARTICULARES
Reserva N° {{reserva_id}} — Versión {{contrato_version}}

Entre {{empresa_razon_social}}, RIF {{empresa_rif}}, con domicilio en {{empresa_direccion}}, en su condición de operador de la plataforma digital {{empresa_sitio}} (en lo sucesivo "LA PLATAFORMA"), que actúa exclusivamente como intermediario tecnológico entre las partes; el ciudadano(a) {{propietario_nombre}}, titular de la cédula de identidad N° {{propietario_cedula}} (en lo sucesivo "EL PROPIETARIO"), y el ciudadano(a) {{arrendatario_nombre}}, titular de la cédula de identidad N° {{arrendatario_cedula}}, titular de la licencia de conducir N° {{arrendatario_licencia}}, con domicilio en {{arrendatario_direccion}} (en lo sucesivo "EL ARRENDATARIO"); se ha convenido celebrar el presente CONTRATO DE ARRENDAMIENTO DE VEHÍCULO, que se regirá por las cláusulas siguientes:

PRIMERA — OBJETO
EL PROPIETARIO da en arrendamiento a EL ARRENDATARIO, y este recibe conforme, el vehículo con las siguientes características:
  • Marca: {{vehiculo_marca}}
  • Modelo: {{vehiculo_modelo}}
  • Año: {{vehiculo_anio}}
  • Color: {{vehiculo_color}}
  • Placa: {{vehiculo_placa}}
  • Serial de carrocería (VIN): {{vehiculo_vin}}
El vehículo se entrega en pleno estado de funcionamiento, con sus documentos legales, kit de emergencia y accesorios inventariados en el acta de inspección de entrega, la cual forma parte integrante de este contrato.

SEGUNDA — PLAZO Y LUGAR
El arrendamiento tendrá una duración de {{dias}} día(s), comprendidos entre el {{inicio}} y el {{fin}}, ambos inclusive.
  • Lugar de entrega: {{lugar_entrega}}.
  • Lugar de devolución: {{lugar_devolucion}}.
Cualquier prórroga deberá ser solicitada y aprobada a través de LA PLATAFORMA antes del vencimiento, generando el cobro proporcional correspondiente.

TERCERA — PRECIO Y FORMA DE PAGO
EL ARRENDATARIO pagará por concepto de arrendamiento la cantidad total de {{total}} {{moneda}}, desglosada así:
  • Tarifa diaria: {{tarifa_dia}} × {{dias}} día(s) = {{subtotal}}
  • Comisión de la plataforma: {{comision}}
  • Cobertura de protección (seguro): {{seguro}}
  • Depósito de garantía reembolsable: {{deposito}}
Método de pago: {{metodo_pago}}. Referencia: {{referencia_pago}}. Fecha de pago: {{fecha_pago}}.
El depósito de garantía será devuelto dentro de los siete (7) días hábiles siguientes a la devolución del vehículo, previa verificación de que no existan daños, multas, faltantes o incumplimientos imputables a EL ARRENDATARIO.

CUARTA — USO DEL VEHÍCULO
EL ARRENDATARIO se obliga a:
  1. Conducir personalmente el vehículo con licencia vigente y apta para la categoría. Queda prohibido cederlo, subarrendarlo o permitir que sea conducido por terceros no autorizados por escrito.
  2. Respetar la Ley de Tránsito Terrestre, su reglamento y demás normas de circulación vigentes en la República Bolivariana de Venezuela.
  3. Circular exclusivamente dentro del territorio nacional, salvo autorización expresa y por escrito de EL PROPIETARIO.
  4. No utilizar el vehículo para: transporte remunerado de pasajeros o carga, competencias, pruebas, remolque, actividades ilícitas, cursos de manejo, ni para transportar sustancias peligrosas, inflamables o prohibidas por la ley.
  5. No fumar ni permitir fumar dentro del vehículo. El incumplimiento generará una penalidad de {{multa_fumar}} por concepto de limpieza profunda.
  6. No exceder el kilometraje máximo diario permitido: {{km_max_dia}}. Kilometraje inicial registrado: {{km_inicio}}.
  7. Cuidar el vehículo con la diligencia de un buen padre de familia, mantener niveles adecuados de aceite, refrigerante y presión de neumáticos, y reportar de inmediato cualquier falla mecánica.

QUINTA — COMBUSTIBLE
El vehículo se entrega y debe devolverse con el mismo nivel de combustible registrado en el acta de inspección de entrega. La diferencia será cobrada a precio de mercado más un cargo administrativo de USD 10.

SEXTA — ACCIDENTES, ROBO Y DAÑOS
En caso de accidente, robo, hurto, colisión o cualquier siniestro, EL ARRENDATARIO deberá:
  1. Notificar de inmediato a las autoridades competentes y a LA PLATAFORMA a través de los canales oficiales.
  2. No abandonar el vehículo ni realizar reparaciones sin autorización previa.
  3. Obtener y remitir copia del acta policial, informe médico si aplica y toda documentación pertinente dentro de las 24 horas siguientes al suceso.
El deducible o cargo por daños no cubiertos por la cobertura contratada será asumido por EL ARRENDATARIO hasta el monto del depósito de garantía y por el excedente conforme al peritaje. Los daños causados por conducción bajo efectos del alcohol, drogas, negligencia grave, dolo o uso indebido, no estarán cubiertos y correrán íntegramente por cuenta de EL ARRENDATARIO.

SÉPTIMA — MULTAS E INFRACCIONES
Todas las multas, sanciones administrativas, peajes, grúas y consecuencias legales derivadas del uso del vehículo durante el período de arrendamiento serán por cuenta exclusiva de EL ARRENDATARIO, quien autoriza expresamente a LA PLATAFORMA a cobrar dichos montos del depósito o del medio de pago registrado.

OCTAVA — INSPECCIONES DE ENTREGA Y DEVOLUCIÓN
Las partes suscribirán actas de inspección al momento de la entrega y de la devolución del vehículo, con fotografías, kilometraje, nivel de combustible y estado general. Dichas actas, firmadas digitalmente a través de LA PLATAFORMA, tienen pleno valor probatorio entre las partes.

NOVENA — DEVOLUCIÓN Y MORA
EL ARRENDATARIO se obliga a devolver el vehículo en la fecha, hora y lugar convenidos. El retraso injustificado generará una penalidad equivalente al 150% de la tarifa diaria por cada día o fracción, sin perjuicio de las acciones legales por apropiación indebida de uso previstas en la legislación venezolana.

DÉCIMA — TERMINACIÓN ANTICIPADA
EL PROPIETARIO o LA PLATAFORMA podrán dar por terminado el presente contrato de manera inmediata, sin derecho a reembolso, en caso de: uso indebido del vehículo, falsedad en la información suministrada, incumplimiento de cualquiera de las cláusulas, o cuando exista riesgo evidente para el vehículo o para terceros.

DÉCIMA PRIMERA — RESPONSABILIDAD DE LA PLATAFORMA
LA PLATAFORMA actúa exclusivamente como intermediario tecnológico y no es propietaria ni operadora del vehículo. Su responsabilidad se limita a facilitar la conexión entre las partes, la gestión de pagos y el soporte operativo. No responde por los daños directos o indirectos derivados del uso del vehículo, salvo por dolo o culpa grave debidamente comprobada.

DÉCIMA SEGUNDA — PROTECCIÓN DE DATOS
Las partes autorizan el tratamiento de sus datos personales por parte de LA PLATAFORMA con fines de ejecución del contrato, prevención de fraude, cumplimiento legal y mejora del servicio, conforme a su Política de Privacidad publicada en {{empresa_sitio}}.

DÉCIMA TERCERA — RESOLUCIÓN DE CONTROVERSIAS
Las partes procurarán resolver de buena fe cualquier controversia derivada de este contrato mediante negociación directa asistida por LA PLATAFORMA. En caso de no llegar a acuerdo, se someten expresamente a la jurisdicción de {{jurisdiccion}}, renunciando a cualquier otro fuero que pudiera corresponderles.

DÉCIMA CUARTA — DECLARACIONES FINALES
Las partes declaran haber leído íntegramente el presente contrato, comprender su alcance y aceptarlo en todas sus partes. Reconocen que la aceptación electrónica realizada a través de LA PLATAFORMA tiene plena validez legal conforme a la Ley sobre Mensajes de Datos y Firmas Electrónicas de la República Bolivariana de Venezuela.

Aceptado por EL ARRENDATARIO el {{fecha_aceptacion}}
Desde IP: {{ip_aceptacion}} — Dispositivo: {{dispositivo}}

_________________________                    _________________________
EL PROPIETARIO                                EL ARRENDATARIO
{{propietario_nombre}}                        {{arrendatario_nombre}}
C.I. {{propietario_cedula}}                   C.I. {{arrendatario_cedula}}

Por LA PLATAFORMA: {{empresa_razon_social}} — RIF {{empresa_rif}}`;

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
    const { r, v, renter, renterProfile, ownerProfile, payment, pickup } = data;
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
      km_inicio: (pickup?.mileage ?? r.start_mileage) != null ? Number(pickup?.mileage ?? r.start_mileage).toLocaleString() : "Se registrará en la entrega",
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
