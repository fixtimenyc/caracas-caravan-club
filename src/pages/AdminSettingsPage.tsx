import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  Settings, Building2, Shield, CreditCard, Plug, Mail, MessageSquare,
  Users as UsersIcon, ScrollText, Save, Search,
} from "lucide-react";
import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

const STORAGE_KEY = "ruedave_system_settings_v1";

type Settings = {
  business: {
    name: string; logo_url: string; favicon_url: string; description: string;
    operation_zone: string; additional_zones: string;
    support_phone: string; support_email: string; website: string;
  };
  policies: {
    commission_pct: number;
    cancel_lt_24h_refund: number;
    cancel_24_48h_refund: number;
    cancel_gt_48h_refund: number;
    security_deposits: { economy: number; sedan: number; suv: number; pickup: number; luxury: number; sports: number; van: number };
    deposit_pct_of_value: number;
    auto_cancel_minutes: number;
    min_renter_age: number;
    require_id: boolean;
    require_license: boolean;
    require_selfie: boolean;
    require_social: boolean;
  };
  payments: {
    stripe_enabled: boolean;
    stripe_public_key: string;
    paypal_enabled: boolean;
    paypal_email: string;
    bank_enabled: boolean;
    bank_name: string;
    bank_account_holder: string;
    bank_account_number: string;
    bank_rif: string;
    cash_enabled: boolean;
    bcv_rate: number;
    bcv_auto_update: boolean;
    fx: {
      default_currency: "USD" | "VES" | "EUR" | "USDT";
      accepted_currencies: { USD: boolean; VES: boolean; EUR: boolean; USDT: boolean };
      rates: { USD: number; EUR: number; USDT: number }; // unidades de Bs por 1 unidad
      surcharge_pct: number; // sobrecargo % por pagar en divisa distinta a la default
      show_dual_pricing: boolean; // mostrar precio en Bs y divisa
      rate_source: "manual" | "bcv" | "binance" | "paralelo";
      zelle_enabled: boolean;
      zelle_email: string;
      zelle_holder: string;
      binance_enabled: boolean;
      binance_pay_id: string;
      binance_email: string;
      wire_enabled: boolean;
      wire_bank: string;
      wire_account: string;
      wire_routing: string;
      wire_swift: string;
      wire_beneficiary: string;
      wire_address: string;
      instructions: string;
    };
  };
  integrations: {
    google_maps_key: string;
    twilio_sid: string;
    twilio_token: string;
    twilio_whatsapp_from: string;
    email_provider: string;
    email_api_key: string;
    auditcar_endpoint: string;
    auditcar_token: string;
    slack_webhook: string;
  };
  email_templates: Record<string, { subject: string; body: string }>;
  sms_templates: Record<string, string>;
  contract: {
    enabled: boolean;
    version: string;
    subject: string;
    require_digital_acceptance: boolean;
    send_on_payment_confirmed: boolean;
    cc_owner: boolean;
    company_legal_name: string;
    company_rif: string;
    company_address: string;
    jurisdiction: string;
    body: string;
  };
};

const DEFAULTS: Settings = {
  business: {
    name: "RUEDAVE", logo_url: "", favicon_url: "",
    description: "Marketplace de alquiler de vehículos en Caracas, Venezuela.",
    operation_zone: "Caracas", additional_zones: "Miranda, La Guaira",
    support_phone: "+58 412 000 0000", support_email: "soporte@ruedave.com", website: "https://ruedave.com",
  },
  policies: {
    commission_pct: 20,
    cancel_lt_24h_refund: 0, cancel_24_48h_refund: 50, cancel_gt_48h_refund: 100,
    security_deposits: { economy: 100, sedan: 150, suv: 250, pickup: 250, luxury: 500, sports: 600, van: 300 },
    deposit_pct_of_value: 5,
    auto_cancel_minutes: 30, min_renter_age: 21,
    require_id: true, require_license: true, require_selfie: true, require_social: false,
  },
  payments: {
    stripe_enabled: false, stripe_public_key: "",
    paypal_enabled: false, paypal_email: "",
    bank_enabled: true, bank_name: "Banesco", bank_account_holder: "RUEDAVE C.A.",
    bank_account_number: "0134-XXXX-XX-XXXXXXXXXX", bank_rif: "J-XXXXXXXX-X",
    cash_enabled: true, bcv_rate: 36.5, bcv_auto_update: false,
    fx: {
      default_currency: "USD",
      accepted_currencies: { USD: true, VES: true, EUR: false, USDT: true },
      rates: { USD: 36.5, EUR: 39.8, USDT: 36.6 },
      surcharge_pct: 0,
      show_dual_pricing: true,
      rate_source: "bcv",
      zelle_enabled: true, zelle_email: "pagos@ruedave.com", zelle_holder: "RUEDAVE LLC",
      binance_enabled: true, binance_pay_id: "", binance_email: "binance@ruedave.com",
      wire_enabled: false, wire_bank: "", wire_account: "", wire_routing: "", wire_swift: "", wire_beneficiary: "RUEDAVE LLC", wire_address: "",
      instructions: "Envíe el comprobante al WhatsApp de soporte tras realizar el pago. Las reservas se confirman al verificar la transacción.",
    },
  },
  integrations: {
    google_maps_key: "", twilio_sid: "", twilio_token: "", twilio_whatsapp_from: "",
    email_provider: "sendgrid", email_api_key: "",
    auditcar_endpoint: "", auditcar_token: "", slack_webhook: "",
  },
  email_templates: {
    booking_confirmation: { subject: "Tu reserva está confirmada", body: "Hola {{nombre}}, tu reserva del {{auto}} fue confirmada del {{inicio}} al {{fin}}." },
    reminder_24h: { subject: "Recordatorio: tu alquiler comienza mañana", body: "Hola {{nombre}}, te recordamos que mañana comienza tu alquiler del {{auto}}." },
    payment_confirmation: { subject: "Pago recibido", body: "Hemos recibido tu pago de {{monto}}. ¡Gracias!" },
    review_request: { subject: "¿Cómo fue tu experiencia?", body: "Hola {{nombre}}, déjanos tu reseña sobre el {{auto}}." },
    issue_notification: { subject: "Reporte de problema", body: "Se ha reportado un problema en tu reserva. Nuestro equipo te contactará." },
  },
  sms_templates: {
    booking_confirmation: "RUEDAVE: Tu reserva del {{auto}} está confirmada. Inicio: {{inicio}}.",
    reminder_1h: "RUEDAVE: Tu alquiler del {{auto}} comienza en 1h. ¡Prepárate!",
    access_code: "RUEDAVE: Tu código de acceso al vehículo es {{codigo}}.",
    payment_notification: "RUEDAVE: Pago recibido por {{monto}}. ¡Gracias!",
  },
  contract: {
    enabled: true,
    version: "1.0",
    subject: "Contrato de alquiler — Reserva {{reserva_id}} — RUEDAVE",
    require_digital_acceptance: true,
    send_on_payment_confirmed: true,
    cc_owner: true,
    company_legal_name: "RUEDAVE C.A.",
    company_rif: "J-XXXXXXXX-X",
    company_address: "Caracas, Venezuela",
    jurisdiction: "Tribunales de la República Bolivariana de Venezuela, con sede en Caracas",
    body: `CONTRATO DE ARRENDAMIENTO DE VEHÍCULO AUTOMOTOR

Entre {{empresa_razon_social}}, RIF {{empresa_rif}}, domiciliada en {{empresa_direccion}}, en lo sucesivo "LA PLATAFORMA", actuando como intermediaria entre el PROPIETARIO {{propietario_nombre}} (cédula {{propietario_cedula}}) y el ARRENDATARIO {{arrendatario_nombre}}, titular de la cédula de identidad N° {{arrendatario_cedula}}, con licencia de conducir N° {{arrendatario_licencia}}, domiciliado en {{arrendatario_direccion}}, en lo sucesivo "EL ARRENDATARIO", se ha convenido en celebrar el presente contrato bajo las siguientes cláusulas:

PRIMERA — OBJETO
EL ARRENDATARIO recibe en calidad de alquiler el vehículo: {{vehiculo_marca}} {{vehiculo_modelo}} {{vehiculo_anio}}, color {{vehiculo_color}}, placa {{vehiculo_placa}}, serial {{vehiculo_vin}}, con kilometraje inicial de {{km_inicio}} km.

SEGUNDA — DURACIÓN Y ENTREGA
El alquiler inicia el {{inicio}} y finaliza el {{fin}}, con un total de {{dias}} días. La entrega se realizará en {{lugar_entrega}} y la devolución en {{lugar_devolucion}}.

TERCERA — PRECIO Y FORMA DE PAGO
Tarifa diaria: {{tarifa_dia}}. Subtotal: {{subtotal}}. Comisión de servicio (10%): {{comision}}. Seguro: {{seguro}}. Depósito en garantía: {{deposito}}. TOTAL: {{total}} ({{moneda}}). Método de pago utilizado: {{metodo_pago}}. Referencia: {{referencia_pago}}. Pago confirmado el {{fecha_pago}}.

CUARTA — DEPÓSITO EN GARANTÍA
EL ARRENDATARIO entrega como garantía la suma de {{deposito}}, la cual será devuelta dentro de los 7 días posteriores a la entrega del vehículo, previa verificación del estado y kilometraje pactado.

QUINTA — DEBERES DEL ARRENDATARIO
1. Conducir el vehículo con la diligencia de un buen padre de familia y respetar las leyes de tránsito.
2. No permitir que terceros no autorizados conduzcan el vehículo.
3. Devolver el vehículo en las mismas condiciones de aseo, combustible y kilometraje pactado ({{km_max_dia}} km/día).
4. No fumar dentro del vehículo (multa: {{multa_fumar}}). No transportar mascotas sin autorización.
5. Reportar de inmediato cualquier siniestro, falla o robo a LA PLATAFORMA y a las autoridades.
6. No utilizar el vehículo fuera del territorio nacional ni en zonas no permitidas (off-road, deportivos).
7. Cubrir multas, peajes y sanciones generadas durante el período de alquiler.

SEXTA — DERECHOS DEL ARRENDATARIO
1. Recibir el vehículo en óptimas condiciones mecánicas, de aseo y con la documentación legal vigente (SOAT, circulación, seguro).
2. Asistencia 24/7 a través de los canales de soporte de LA PLATAFORMA.
3. Acceso a un proceso de reclamación claro y a la devolución del depósito conforme a la cláusula CUARTA.
4. Confidencialidad y tratamiento adecuado de sus datos personales.

SÉPTIMA — POLÍTICA DE CANCELACIÓN
- Cancelación con más de 48 horas de anticipación: reembolso del 100%.
- Cancelación entre 24 y 48 horas: reembolso del 50%.
- Cancelación con menos de 24 horas: sin reembolso.

OCTAVA — SEGURO Y RESPONSABILIDAD
El vehículo cuenta con seguro de cobertura amplia. EL ARRENDATARIO responde por daños no cubiertos por la póliza, deducibles, y por los daños ocasionados por negligencia, dolo, conducción bajo efectos del alcohol o sustancias, o por incumplimiento de las leyes de tránsito.

NOVENA — RESOLUCIÓN ANTICIPADA
LA PLATAFORMA podrá resolver el contrato sin previo aviso si EL ARRENDATARIO incumple cualquiera de las cláusulas, recuperando el vehículo de inmediato sin perjuicio de las acciones legales aplicables.

DÉCIMA — PROTECCIÓN DE DATOS
EL ARRENDATARIO autoriza el tratamiento de sus datos personales conforme a la política de privacidad publicada en {{empresa_sitio}}.

UNDÉCIMA — JURISDICCIÓN
Las partes eligen como domicilio especial a la ciudad de Caracas y se someten a {{jurisdiccion}} para la resolución de cualquier controversia.

DUODÉCIMA — ACEPTACIÓN DIGITAL
EL ARRENDATARIO declara haber leído, comprendido y aceptado íntegramente las cláusulas del presente contrato, así como los Términos y Condiciones y la Política de Privacidad de LA PLATAFORMA. La aceptación se realiza de forma electrónica al confirmar la reserva y el pago, dejando constancia con los siguientes datos:

- Reserva ID: {{reserva_id}}
- Aceptado el: {{fecha_aceptacion}}
- IP de aceptación: {{ip_aceptacion}}
- Dispositivo: {{dispositivo}}
- Versión del contrato: {{contrato_version}}

Esta aceptación electrónica tiene plena validez legal conforme al Decreto-Ley sobre Mensajes de Datos y Firmas Electrónicas de la República Bolivariana de Venezuela.

En Caracas, a la fecha de aceptación digital indicada.

LA PLATAFORMA — {{empresa_razon_social}}
EL ARRENDATARIO — {{arrendatario_nombre}} — C.I. {{arrendatario_cedula}}`,
  },
};

const normalizeSettings = (input?: Partial<Settings> | null): Settings => {
  const source = (input && typeof input === "object" ? input : {}) as Partial<Settings>;
  const policies = (source.policies ?? {}) as Partial<Settings["policies"]>;
  const securityDeposits = (policies.security_deposits ?? {}) as Partial<Settings["policies"]["security_deposits"]>;

  return {
    business: { ...DEFAULTS.business, ...(source.business ?? {}) },
    policies: {
      ...DEFAULTS.policies,
      ...policies,
      security_deposits: {
        ...DEFAULTS.policies.security_deposits,
        ...securityDeposits,
      },
    },
    payments: (() => {
      const p = (source.payments ?? {}) as Partial<Settings["payments"]>;
      const fx = (p.fx ?? {}) as Partial<Settings["payments"]["fx"]>;
      return {
        ...DEFAULTS.payments,
        ...p,
        fx: {
          ...DEFAULTS.payments.fx,
          ...fx,
          accepted_currencies: { ...DEFAULTS.payments.fx.accepted_currencies, ...(fx.accepted_currencies ?? {}) },
          rates: { ...DEFAULTS.payments.fx.rates, ...(fx.rates ?? {}) },
        },
      };
    })(),
    integrations: { ...DEFAULTS.integrations, ...(source.integrations ?? {}) },
    email_templates: { ...DEFAULTS.email_templates, ...(source.email_templates ?? {}) },
    sms_templates: { ...DEFAULTS.sms_templates, ...(source.sms_templates ?? {}) },
    contract: { ...DEFAULTS.contract, ...(source.contract ?? {}) },
  };
};

const loadSettings = (): Settings => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULTS;
    return normalizeSettings(JSON.parse(raw));
  } catch {
    return DEFAULTS;
  }
};

export default function AdminSettingsPage() {
  const [rawSettings, setRawSettings] = useState<Settings>(loadSettings);
  const settings = useMemo(() => normalizeSettings(rawSettings), [rawSettings]);
  const [admins, setAdmins] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [logFilter, setLogFilter] = useState({ admin: "all", action: "all", q: "" });
  const [loadingAdmins, setLoadingAdmins] = useState(false);
  const [newAdminEmail, setNewAdminEmail] = useState("");

  const save = (next: Settings) => {
    const normalized = normalizeSettings(next);
    setRawSettings(normalized);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
  };
  const saveAll = () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    toast({ title: "Configuración guardada", description: "Los cambios se aplicaron correctamente." });
  };

  const loadAdminsAndLogs = async () => {
    setLoadingAdmins(true);
    const { data: roleRows } = await supabase.from("user_roles").select("*").in("role", ["admin"]).limit(500);
    const adminIds = (roleRows || []).map((r: any) => r.user_id);
    let profilesMap: Record<string, any> = {};
    if (adminIds.length) {
      const { data: profs } = await supabase.from("profiles").select("user_id,full_name,phone,last_login_at,account_status,avatar_url").in("user_id", adminIds);
      (profs || []).forEach((p: any) => (profilesMap[p.user_id] = p));
    }
    setAdmins(adminIds.map((id: string) => ({ user_id: id, ...(profilesMap[id] || {}) })));

    const { data: actions } = await supabase
      .from("admin_user_actions")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    const actorIds = Array.from(new Set((actions || []).map((a: any) => a.admin_id).filter(Boolean)));
    let actorMap: Record<string, string> = {};
    if (actorIds.length) {
      const { data: aprofs } = await supabase.from("profiles").select("user_id,full_name").in("user_id", actorIds);
      (aprofs || []).forEach((p: any) => (actorMap[p.user_id] = p.full_name || p.user_id));
    }
    setLogs((actions || []).map((a: any) => ({ ...a, admin_name: actorMap[a.admin_id] || a.admin_id })));
    setLoadingAdmins(false);
  };

  useEffect(() => { loadAdminsAndLogs(); }, []);

  const filteredLogs = useMemo(() => {
    return logs.filter((l) => {
      if (logFilter.admin !== "all" && l.admin_id !== logFilter.admin) return false;
      if (logFilter.action !== "all" && l.action_type !== logFilter.action) return false;
      if (logFilter.q && !JSON.stringify(l).toLowerCase().includes(logFilter.q.toLowerCase())) return false;
      return true;
    });
  }, [logs, logFilter]);

  const actionTypes = useMemo(() => Array.from(new Set(logs.map((l) => l.action_type))), [logs]);

  return (
    <AdminLayout title="Configuración">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10"><Settings className="h-6 w-6 text-primary" /></div>
          <div>
            <h1 className="text-2xl font-bold">Configuración del Sistema</h1>
            <p className="text-sm text-muted-foreground">Ajustes generales, políticas, integraciones y administradores.</p>
          </div>
        </div>
        <Button onClick={saveAll}><Save className="h-4 w-4 mr-2" /> Guardar cambios</Button>
      </div>

      <Tabs defaultValue="business">
        <TabsList className="flex flex-wrap h-auto">
          <TabsTrigger value="business"><Building2 className="h-4 w-4 mr-2" />Negocio</TabsTrigger>
          <TabsTrigger value="policies"><Shield className="h-4 w-4 mr-2" />Políticas</TabsTrigger>
          <TabsTrigger value="payments"><CreditCard className="h-4 w-4 mr-2" />Pagos</TabsTrigger>
          <TabsTrigger value="integrations"><Plug className="h-4 w-4 mr-2" />Integraciones</TabsTrigger>
          <TabsTrigger value="emails"><Mail className="h-4 w-4 mr-2" />Emails</TabsTrigger>
          <TabsTrigger value="sms"><MessageSquare className="h-4 w-4 mr-2" />SMS/WhatsApp</TabsTrigger>
          <TabsTrigger value="admins"><UsersIcon className="h-4 w-4 mr-2" />Admins</TabsTrigger>
          <TabsTrigger value="contract"><ScrollText className="h-4 w-4 mr-2" />Contrato</TabsTrigger>
          <TabsTrigger value="logs"><ScrollText className="h-4 w-4 mr-2" />Logs</TabsTrigger>
        </TabsList>

        {/* BUSINESS */}
        <TabsContent value="business" className="mt-6">
          <Card>
            <CardHeader><CardTitle>Información de negocio</CardTitle><CardDescription>Datos públicos de la empresa.</CardDescription></CardHeader>
            <CardContent className="grid md:grid-cols-2 gap-4">
              <Field label="Nombre empresa" value={settings.business.name} onChange={(v) => save({ ...settings, business: { ...settings.business, name: v } })} />
              <Field label="Website" value={settings.business.website} onChange={(v) => save({ ...settings, business: { ...settings.business, website: v } })} />
              <Field label="Logo (URL)" value={settings.business.logo_url} onChange={(v) => save({ ...settings, business: { ...settings.business, logo_url: v } })} />
              <Field label="Favicon (URL)" value={settings.business.favicon_url} onChange={(v) => save({ ...settings, business: { ...settings.business, favicon_url: v } })} />
              <Field label="Teléfono soporte" value={settings.business.support_phone} onChange={(v) => save({ ...settings, business: { ...settings.business, support_phone: v } })} />
              <Field label="Email soporte" value={settings.business.support_email} onChange={(v) => save({ ...settings, business: { ...settings.business, support_email: v } })} />
              <Field label="Zona principal" value={settings.business.operation_zone} onChange={(v) => save({ ...settings, business: { ...settings.business, operation_zone: v } })} />
              <Field label="Zonas adicionales" value={settings.business.additional_zones} onChange={(v) => save({ ...settings, business: { ...settings.business, additional_zones: v } })} />
              <div className="md:col-span-2">
                <Label>Descripción</Label>
                <Textarea rows={3} value={settings.business.description} onChange={(e) => save({ ...settings, business: { ...settings.business, description: e.target.value } })} />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* POLICIES */}
        <TabsContent value="policies" className="mt-6">
          <Card>
            <CardHeader><CardTitle>Políticas y reglas</CardTitle><CardDescription>Comisión, cancelación y verificación.</CardDescription></CardHeader>
            <CardContent className="grid md:grid-cols-2 gap-4">
              <NumField label="Comisión RUEDAVE (%)" value={settings.policies.commission_pct} onChange={(v) => save({ ...settings, policies: { ...settings.policies, commission_pct: v } })} />
              
              <NumField label="Reembolso < 24h (%)" value={settings.policies.cancel_lt_24h_refund} onChange={(v) => save({ ...settings, policies: { ...settings.policies, cancel_lt_24h_refund: v } })} />
              <NumField label="Reembolso 24-48h (%)" value={settings.policies.cancel_24_48h_refund} onChange={(v) => save({ ...settings, policies: { ...settings.policies, cancel_24_48h_refund: v } })} />
              <NumField label="Reembolso > 48h (%)" value={settings.policies.cancel_gt_48h_refund} onChange={(v) => save({ ...settings, policies: { ...settings.policies, cancel_gt_48h_refund: v } })} />
              <NumField label="Cancelación auto (min)" value={settings.policies.auto_cancel_minutes} onChange={(v) => save({ ...settings, policies: { ...settings.policies, auto_cancel_minutes: v } })} />
              <NumField label="Edad mínima rentador" value={settings.policies.min_renter_age} onChange={(v) => save({ ...settings, policies: { ...settings.policies, min_renter_age: v } })} />

              <Separator className="md:col-span-2" />
              <div className="md:col-span-2">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="font-medium">Depósito de seguridad por tipo de vehículo</p>
                    <p className="text-xs text-muted-foreground">Monto retenido al inicio del alquiler. Se devuelve si no hay daños ni infracciones.</p>
                  </div>
                  <div className="w-56">
                    <Label className="text-xs">% del valor del auto (alternativa)</Label>
                    <Input type="number" step={0.5} value={settings.policies.deposit_pct_of_value}
                      onChange={(e) => save({ ...settings, policies: { ...settings.policies, deposit_pct_of_value: Number(e.target.value) } })} />
                  </div>
                </div>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {([
                    ["economy", "Económico", "Hatchback básico, compacto"],
                    ["sedan", "Sedán", "Toyota Corolla, Honda Civic"],
                    ["suv", "SUV", "Toyota RAV4, Hyundai Tucson"],
                    ["pickup", "Pickup / 4x4", "Toyota Hilux, Ford Ranger"],
                    ["van", "Van / Minivan", "Hyundai H1, Kia Carnival"],
                    ["luxury", "Lujo", "Mercedes, BMW, Audi"],
                    ["sports", "Deportivo", "Mustang, Camaro"],
                  ] as const).map(([key, label, hint]) => (
                    <div key={key} className="border rounded-md p-3">
                      <div className="flex items-center justify-between mb-1">
                        <Label className="text-sm">{label}</Label>
                        <Badge variant="outline" className="text-xs">USD</Badge>
                      </div>
                      <Input type="number" min={0} value={settings.policies.security_deposits[key]}
                        onChange={(e) => save({ ...settings, policies: { ...settings.policies, security_deposits: { ...settings.policies.security_deposits, [key]: Number(e.target.value) } } })} />
                      <p className="text-[11px] text-muted-foreground mt-1">{hint}</p>
                    </div>
                  ))}
                </div>
              </div>
              <Separator className="md:col-span-2" />
              <div className="md:col-span-2">
                <p className="font-medium mb-3">Requisitos de verificación</p>
                <div className="grid sm:grid-cols-2 gap-3">
                  <ToggleRow label="Documento de identidad" checked={settings.policies.require_id} onChange={(v) => save({ ...settings, policies: { ...settings.policies, require_id: v } })} />
                  <ToggleRow label="Licencia de conducir" checked={settings.policies.require_license} onChange={(v) => save({ ...settings, policies: { ...settings.policies, require_license: v } })} />
                  <ToggleRow label="Selfie" checked={settings.policies.require_selfie} onChange={(v) => save({ ...settings, policies: { ...settings.policies, require_selfie: v } })} />
                  <ToggleRow label="Verificación de redes sociales" checked={settings.policies.require_social} onChange={(v) => save({ ...settings, policies: { ...settings.policies, require_social: v } })} />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* PAYMENTS */}
        <TabsContent value="payments" className="mt-6">
          <div className="grid gap-4">
            <Card>
              <CardHeader><CardTitle>Stripe</CardTitle></CardHeader>
              <CardContent className="grid md:grid-cols-2 gap-4">
                <ToggleRow label="Habilitar Stripe" checked={settings.payments.stripe_enabled} onChange={(v) => save({ ...settings, payments: { ...settings.payments, stripe_enabled: v } })} />
                <Field label="Public Key" value={settings.payments.stripe_public_key} onChange={(v) => save({ ...settings, payments: { ...settings.payments, stripe_public_key: v } })} />
                <p className="text-xs text-muted-foreground md:col-span-2">La Secret Key debe configurarse como secreto del backend, no en este formulario.</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>PayPal</CardTitle></CardHeader>
              <CardContent className="grid md:grid-cols-2 gap-4">
                <ToggleRow label="Habilitar PayPal" checked={settings.payments.paypal_enabled} onChange={(v) => save({ ...settings, payments: { ...settings.payments, paypal_enabled: v } })} />
                <Field label="Email PayPal" value={settings.payments.paypal_email} onChange={(v) => save({ ...settings, payments: { ...settings.payments, paypal_email: v } })} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Transferencia bancaria</CardTitle></CardHeader>
              <CardContent className="grid md:grid-cols-2 gap-4">
                <ToggleRow label="Habilitar transferencia" checked={settings.payments.bank_enabled} onChange={(v) => save({ ...settings, payments: { ...settings.payments, bank_enabled: v } })} />
                <Field label="Banco" value={settings.payments.bank_name} onChange={(v) => save({ ...settings, payments: { ...settings.payments, bank_name: v } })} />
                <Field label="Titular" value={settings.payments.bank_account_holder} onChange={(v) => save({ ...settings, payments: { ...settings.payments, bank_account_holder: v } })} />
                <Field label="Cuenta" value={settings.payments.bank_account_number} onChange={(v) => save({ ...settings, payments: { ...settings.payments, bank_account_number: v } })} />
                <Field label="RIF" value={settings.payments.bank_rif} onChange={(v) => save({ ...settings, payments: { ...settings.payments, bank_rif: v } })} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Efectivo y BCV</CardTitle></CardHeader>
              <CardContent className="grid md:grid-cols-2 gap-4">
                <ToggleRow label="Aceptar efectivo en recolección" checked={settings.payments.cash_enabled} onChange={(v) => save({ ...settings, payments: { ...settings.payments, cash_enabled: v } })} />
                <NumField label="Tasa BCV (Bs/USD)" step={0.01} value={settings.payments.bcv_rate} onChange={(v) => save({ ...settings, payments: { ...settings.payments, bcv_rate: v } })} />
                <ToggleRow label="Actualizar tasa BCV automáticamente" checked={settings.payments.bcv_auto_update} onChange={(v) => save({ ...settings, payments: { ...settings.payments, bcv_auto_update: v } })} />
              </CardContent>
            </Card>

            {/* PAGOS EN DIVISAS */}
            <Card>
              <CardHeader>
                <CardTitle>Pagos en divisas</CardTitle>
                <CardDescription>Configura las monedas aceptadas, tasas de cambio y métodos internacionales (Zelle, Binance/USDT, transferencia internacional).</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-6">
                {/* Monedas aceptadas */}
                <div className="grid gap-3">
                  <div className="text-sm font-medium">Monedas aceptadas</div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {(["USD", "VES", "EUR", "USDT"] as const).map((c) => (
                      <ToggleRow
                        key={c}
                        label={c}
                        checked={settings.payments.fx.accepted_currencies[c]}
                        onChange={(v) => save({ ...settings, payments: { ...settings.payments, fx: { ...settings.payments.fx, accepted_currencies: { ...settings.payments.fx.accepted_currencies, [c]: v } } } })}
                      />
                    ))}
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div className="grid gap-1.5">
                    <label className="text-sm font-medium">Moneda por defecto</label>
                    <Select
                      value={settings.payments.fx.default_currency}
                      onValueChange={(v) => save({ ...settings, payments: { ...settings.payments, fx: { ...settings.payments.fx, default_currency: v as any } } })}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="USD">USD - Dólar</SelectItem>
                        <SelectItem value="VES">VES - Bolívar</SelectItem>
                        <SelectItem value="EUR">EUR - Euro</SelectItem>
                        <SelectItem value="USDT">USDT - Tether</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-1.5">
                    <label className="text-sm font-medium">Fuente de tasa</label>
                    <Select
                      value={settings.payments.fx.rate_source}
                      onValueChange={(v) => save({ ...settings, payments: { ...settings.payments, fx: { ...settings.payments.fx, rate_source: v as any } } })}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="manual">Manual</SelectItem>
                        <SelectItem value="bcv">BCV</SelectItem>
                        <SelectItem value="binance">Binance P2P</SelectItem>
                        <SelectItem value="paralelo">Paralelo</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Tasas */}
                <div className="grid gap-3">
                  <div className="text-sm font-medium">Tasas de cambio (Bs por 1 unidad)</div>
                  <div className="grid md:grid-cols-3 gap-4">
                    <NumField label="Bs / USD" step={0.01} value={settings.payments.fx.rates.USD} onChange={(v) => save({ ...settings, payments: { ...settings.payments, fx: { ...settings.payments.fx, rates: { ...settings.payments.fx.rates, USD: v } } } })} />
                    <NumField label="Bs / EUR" step={0.01} value={settings.payments.fx.rates.EUR} onChange={(v) => save({ ...settings, payments: { ...settings.payments, fx: { ...settings.payments.fx, rates: { ...settings.payments.fx.rates, EUR: v } } } })} />
                    <NumField label="Bs / USDT" step={0.01} value={settings.payments.fx.rates.USDT} onChange={(v) => save({ ...settings, payments: { ...settings.payments, fx: { ...settings.payments.fx, rates: { ...settings.payments.fx.rates, USDT: v } } } })} />
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <NumField label="Sobrecargo % por divisa alterna" step={0.1} value={settings.payments.fx.surcharge_pct} onChange={(v) => save({ ...settings, payments: { ...settings.payments, fx: { ...settings.payments.fx, surcharge_pct: v } } })} />
                  <ToggleRow label="Mostrar precio dual (Bs + divisa)" checked={settings.payments.fx.show_dual_pricing} onChange={(v) => save({ ...settings, payments: { ...settings.payments, fx: { ...settings.payments.fx, show_dual_pricing: v } } })} />
                </div>

                {/* Zelle */}
                <div className="border-t pt-4 grid md:grid-cols-2 gap-4">
                  <div className="md:col-span-2 text-sm font-medium">Zelle (USD)</div>
                  <ToggleRow label="Habilitar Zelle" checked={settings.payments.fx.zelle_enabled} onChange={(v) => save({ ...settings, payments: { ...settings.payments, fx: { ...settings.payments.fx, zelle_enabled: v } } })} />
                  <Field label="Email Zelle" value={settings.payments.fx.zelle_email} onChange={(v) => save({ ...settings, payments: { ...settings.payments, fx: { ...settings.payments.fx, zelle_email: v } } })} />
                  <Field label="Titular" value={settings.payments.fx.zelle_holder} onChange={(v) => save({ ...settings, payments: { ...settings.payments, fx: { ...settings.payments.fx, zelle_holder: v } } })} />
                </div>

                {/* Binance / USDT */}
                <div className="border-t pt-4 grid md:grid-cols-2 gap-4">
                  <div className="md:col-span-2 text-sm font-medium">Binance Pay / USDT</div>
                  <ToggleRow label="Habilitar Binance/USDT" checked={settings.payments.fx.binance_enabled} onChange={(v) => save({ ...settings, payments: { ...settings.payments, fx: { ...settings.payments.fx, binance_enabled: v } } })} />
                  <Field label="Binance Pay ID" value={settings.payments.fx.binance_pay_id} onChange={(v) => save({ ...settings, payments: { ...settings.payments, fx: { ...settings.payments.fx, binance_pay_id: v } } })} />
                  <Field label="Email Binance" value={settings.payments.fx.binance_email} onChange={(v) => save({ ...settings, payments: { ...settings.payments, fx: { ...settings.payments.fx, binance_email: v } } })} />
                </div>

                {/* Wire transfer */}
                <div className="border-t pt-4 grid md:grid-cols-2 gap-4">
                  <div className="md:col-span-2 text-sm font-medium">Transferencia internacional (Wire)</div>
                  <ToggleRow label="Habilitar Wire" checked={settings.payments.fx.wire_enabled} onChange={(v) => save({ ...settings, payments: { ...settings.payments, fx: { ...settings.payments.fx, wire_enabled: v } } })} />
                  <Field label="Banco" value={settings.payments.fx.wire_bank} onChange={(v) => save({ ...settings, payments: { ...settings.payments, fx: { ...settings.payments.fx, wire_bank: v } } })} />
                  <Field label="Beneficiario" value={settings.payments.fx.wire_beneficiary} onChange={(v) => save({ ...settings, payments: { ...settings.payments, fx: { ...settings.payments.fx, wire_beneficiary: v } } })} />
                  <Field label="Cuenta" value={settings.payments.fx.wire_account} onChange={(v) => save({ ...settings, payments: { ...settings.payments, fx: { ...settings.payments.fx, wire_account: v } } })} />
                  <Field label="Routing / ABA" value={settings.payments.fx.wire_routing} onChange={(v) => save({ ...settings, payments: { ...settings.payments, fx: { ...settings.payments.fx, wire_routing: v } } })} />
                  <Field label="SWIFT / BIC" value={settings.payments.fx.wire_swift} onChange={(v) => save({ ...settings, payments: { ...settings.payments, fx: { ...settings.payments.fx, wire_swift: v } } })} />
                  <Field label="Dirección beneficiario" value={settings.payments.fx.wire_address} onChange={(v) => save({ ...settings, payments: { ...settings.payments, fx: { ...settings.payments.fx, wire_address: v } } })} />
                </div>

                <div className="border-t pt-4 grid gap-1.5">
                  <label className="text-sm font-medium">Instrucciones para el usuario</label>
                  <textarea
                    className="min-h-[90px] rounded-md border bg-background px-3 py-2 text-sm"
                    value={settings.payments.fx.instructions}
                    onChange={(e) => save({ ...settings, payments: { ...settings.payments, fx: { ...settings.payments.fx, instructions: e.target.value } } })}
                  />
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* INTEGRATIONS */}
        <TabsContent value="integrations" className="mt-6">
          <Card>
            <CardHeader><CardTitle>Integraciones externas</CardTitle><CardDescription>API keys y endpoints de servicios de terceros.</CardDescription></CardHeader>
            <CardContent className="grid md:grid-cols-2 gap-4">
              <Field label="Google Maps API Key" value={settings.integrations.google_maps_key} onChange={(v) => save({ ...settings, integrations: { ...settings.integrations, google_maps_key: v } })} />
              <Field label="Slack Webhook URL" value={settings.integrations.slack_webhook} onChange={(v) => save({ ...settings, integrations: { ...settings.integrations, slack_webhook: v } })} />
              <Field label="Twilio SID" value={settings.integrations.twilio_sid} onChange={(v) => save({ ...settings, integrations: { ...settings.integrations, twilio_sid: v } })} />
              <Field label="Twilio Token" value={settings.integrations.twilio_token} onChange={(v) => save({ ...settings, integrations: { ...settings.integrations, twilio_token: v } })} />
              <Field label="Twilio WhatsApp From" value={settings.integrations.twilio_whatsapp_from} onChange={(v) => save({ ...settings, integrations: { ...settings.integrations, twilio_whatsapp_from: v } })} />
              <div>
                <Label>Email provider</Label>
                <Select value={settings.integrations.email_provider} onValueChange={(v) => save({ ...settings, integrations: { ...settings.integrations, email_provider: v } })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sendgrid">SendGrid</SelectItem>
                    <SelectItem value="mailchimp">Mailchimp</SelectItem>
                    <SelectItem value="resend">Resend</SelectItem>
                    <SelectItem value="ses">Amazon SES</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Field label="Email API Key" value={settings.integrations.email_api_key} onChange={(v) => save({ ...settings, integrations: { ...settings.integrations, email_api_key: v } })} />
              <Field label="AuditCar Endpoint" value={settings.integrations.auditcar_endpoint} onChange={(v) => save({ ...settings, integrations: { ...settings.integrations, auditcar_endpoint: v } })} />
              <Field label="AuditCar Token" value={settings.integrations.auditcar_token} onChange={(v) => save({ ...settings, integrations: { ...settings.integrations, auditcar_token: v } })} />
              <p className="text-xs text-muted-foreground md:col-span-2">Recomendamos almacenar tokens y secretos sensibles como secretos del backend.</p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* EMAIL TEMPLATES */}
        <TabsContent value="emails" className="mt-6">
          <div className="grid gap-4">
            {Object.entries(settings.email_templates).map(([key, tpl]) => (
              <Card key={key}>
                <CardHeader><CardTitle className="capitalize">{key.replace(/_/g, " ")}</CardTitle></CardHeader>
                <CardContent className="grid gap-3">
                  <div>
                    <Label>Asunto</Label>
                    <Input value={tpl.subject} onChange={(e) => save({ ...settings, email_templates: { ...settings.email_templates, [key]: { ...tpl, subject: e.target.value } } })} />
                  </div>
                  <div>
                    <Label>Cuerpo</Label>
                    <Textarea rows={4} value={tpl.body} onChange={(e) => save({ ...settings, email_templates: { ...settings.email_templates, [key]: { ...tpl, body: e.target.value } } })} />
                    <p className="text-xs text-muted-foreground mt-1">Variables: {"{{nombre}}, {{auto}}, {{inicio}}, {{fin}}, {{monto}}"}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* SMS */}
        <TabsContent value="sms" className="mt-6">
          <Card>
            <CardHeader><CardTitle>Plantillas SMS / WhatsApp</CardTitle><CardDescription>Mensajes cortos enviados automáticamente.</CardDescription></CardHeader>
            <CardContent className="grid gap-4">
              {Object.entries(settings.sms_templates).map(([key, body]) => (
                <div key={key}>
                  <Label className="capitalize">{key.replace(/_/g, " ")}</Label>
                  <Textarea rows={2} value={body} onChange={(e) => save({ ...settings, sms_templates: { ...settings.sms_templates, [key]: e.target.value } })} />
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ADMINS */}
        <TabsContent value="admins" className="mt-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Administradores</CardTitle>
                  <CardDescription>Usuarios con rol admin en la plataforma.</CardDescription>
                </div>
                <Badge variant="secondary">{admins.length} admins</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2 mb-4">
                <Input placeholder="Email del usuario a promover a admin" value={newAdminEmail} onChange={(e) => setNewAdminEmail(e.target.value)} />
                <Button variant="outline" onClick={async () => {
                  if (!newAdminEmail) return;
                  toast({ title: "Acción manual requerida", description: "Por seguridad, los roles deben asignarse vía base de datos. Contacta al super admin." });
                }}>Invitar admin</Button>
              </div>
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Nombre</TableHead><TableHead>Teléfono</TableHead><TableHead>Rol</TableHead>
                  <TableHead>Estado</TableHead><TableHead>Último login</TableHead><TableHead>Acciones</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {loadingAdmins ? (
                    <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Cargando…</TableCell></TableRow>
                  ) : admins.length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Sin administradores</TableCell></TableRow>
                  ) : admins.map((a) => (
                    <TableRow key={a.user_id}>
                      <TableCell className="font-medium">{a.full_name || a.user_id.slice(0, 8)}</TableCell>
                      <TableCell>{a.phone || "—"}</TableCell>
                      <TableCell><Badge>Admin</Badge></TableCell>
                      <TableCell><Badge variant={a.account_status === "active" ? "default" : "secondary"}>{a.account_status || "active"}</Badge></TableCell>
                      <TableCell>{a.last_login_at ? format(new Date(a.last_login_at), "PP", { locale: es }) : "—"}</TableCell>
                      <TableCell>
                        <Button size="sm" variant="ghost" onClick={() => toast({ title: "Acción registrada", description: "Función disponible próximamente." })}>Editar</Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <Separator className="my-4" />
              <div>
                <p className="font-medium mb-2">Permisos por rol</p>
                <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-2 text-sm">
                  {[
                    "Ver dashboard", "Gestionar autos", "Gestionar reservas", "Gestionar usuarios",
                    "Gestionar finanzas", "Ver reportes", "Contactar usuarios", "Editar configuración", "Ver logs",
                  ].map((p) => (
                    <div key={p} className="flex items-center gap-2 p-2 rounded-md border">
                      <Switch defaultChecked /> <span>{p}</span>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground mt-2">La asignación granular por usuario se aplicará en la próxima iteración con tablas de permisos.</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* LOGS */}
        <TabsContent value="logs" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Logs y auditoría</CardTitle>
              <CardDescription>Acciones realizadas por administradores sobre usuarios.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-3 gap-3 mb-4">
                <div className="relative">
                  <Search className="h-4 w-4 absolute left-3 top-3 text-muted-foreground" />
                  <Input className="pl-9" placeholder="Buscar…" value={logFilter.q} onChange={(e) => setLogFilter({ ...logFilter, q: e.target.value })} />
                </div>
                <Select value={logFilter.admin} onValueChange={(v) => setLogFilter({ ...logFilter, admin: v })}>
                  <SelectTrigger><SelectValue placeholder="Admin" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos los admins</SelectItem>
                    {admins.map((a) => <SelectItem key={a.user_id} value={a.user_id}>{a.full_name || a.user_id.slice(0, 8)}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={logFilter.action} onValueChange={(v) => setLogFilter({ ...logFilter, action: v })}>
                  <SelectTrigger><SelectValue placeholder="Acción" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas las acciones</SelectItem>
                    {actionTypes.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Fecha</TableHead><TableHead>Admin</TableHead><TableHead>Acción</TableHead>
                  <TableHead>Objeto</TableHead><TableHead>Detalles</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {filteredLogs.length === 0 ? (
                    <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Sin registros</TableCell></TableRow>
                  ) : filteredLogs.map((l) => (
                    <TableRow key={l.id}>
                      <TableCell className="text-sm">{format(new Date(l.created_at), "PPp", { locale: es })}</TableCell>
                      <TableCell className="text-sm">{l.admin_name}</TableCell>
                      <TableCell><Badge variant="outline">{l.action_type}</Badge></TableCell>
                      <TableCell className="text-xs font-mono">{(l.target_user_id || "").slice(0, 8)}</TableCell>
                      <TableCell className="text-sm max-w-md truncate">{l.details || "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <p className="text-xs text-muted-foreground mt-2">Mostrando los últimos 200 eventos.</p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* CONTRATO */}
        <TabsContent value="contract" className="mt-6">
          <div className="grid gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Contrato modelo de alquiler</CardTitle>
                <CardDescription>
                  Plantilla legal que se envía por correo al arrendatario al confirmar la reserva con pago. Incluye políticas, deberes, derechos y aceptación digital con plena validez legal (Decreto-Ley sobre Mensajes de Datos y Firmas Electrónicas).
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4">
                <div className="grid md:grid-cols-3 gap-4">
                  <ToggleRow label="Contrato habilitado" checked={settings.contract.enabled} onChange={(v) => save({ ...settings, contract: { ...settings.contract, enabled: v } })} />
                  <ToggleRow label="Enviar al confirmar pago" checked={settings.contract.send_on_payment_confirmed} onChange={(v) => save({ ...settings, contract: { ...settings.contract, send_on_payment_confirmed: v } })} />
                  <ToggleRow label="Copia al propietario" checked={settings.contract.cc_owner} onChange={(v) => save({ ...settings, contract: { ...settings.contract, cc_owner: v } })} />
                  <ToggleRow label="Requerir aceptación digital" checked={settings.contract.require_digital_acceptance} onChange={(v) => save({ ...settings, contract: { ...settings.contract, require_digital_acceptance: v } })} />
                  <Field label="Versión del contrato" value={settings.contract.version} onChange={(v) => save({ ...settings, contract: { ...settings.contract, version: v } })} />
                  <Field label="Asunto del correo" value={settings.contract.subject} onChange={(v) => save({ ...settings, contract: { ...settings.contract, subject: v } })} />
                </div>

                <Separator />

                <div className="grid md:grid-cols-2 gap-4">
                  <Field label="Razón social" value={settings.contract.company_legal_name} onChange={(v) => save({ ...settings, contract: { ...settings.contract, company_legal_name: v } })} />
                  <Field label="RIF" value={settings.contract.company_rif} onChange={(v) => save({ ...settings, contract: { ...settings.contract, company_rif: v } })} />
                  <Field label="Domicilio fiscal" value={settings.contract.company_address} onChange={(v) => save({ ...settings, contract: { ...settings.contract, company_address: v } })} />
                  <Field label="Jurisdicción" value={settings.contract.jurisdiction} onChange={(v) => save({ ...settings, contract: { ...settings.contract, jurisdiction: v } })} />
                </div>

                <div className="grid gap-1.5">
                  <Label>Cuerpo del contrato</Label>
                  <Textarea
                    className="min-h-[480px] font-mono text-xs"
                    value={settings.contract.body}
                    onChange={(e) => save({ ...settings, contract: { ...settings.contract, body: e.target.value } })}
                  />
                  <p className="text-xs text-muted-foreground">
                    Variables disponibles: <code>{`{{reserva_id}}`}</code>, <code>{`{{arrendatario_nombre}}`}</code>, <code>{`{{arrendatario_cedula}}`}</code>, <code>{`{{arrendatario_licencia}}`}</code>, <code>{`{{arrendatario_direccion}}`}</code>, <code>{`{{propietario_nombre}}`}</code>, <code>{`{{propietario_cedula}}`}</code>, <code>{`{{vehiculo_marca}}`}</code>, <code>{`{{vehiculo_modelo}}`}</code>, <code>{`{{vehiculo_anio}}`}</code>, <code>{`{{vehiculo_color}}`}</code>, <code>{`{{vehiculo_placa}}`}</code>, <code>{`{{vehiculo_vin}}`}</code>, <code>{`{{km_inicio}}`}</code>, <code>{`{{km_max_dia}}`}</code>, <code>{`{{inicio}}`}</code>, <code>{`{{fin}}`}</code>, <code>{`{{dias}}`}</code>, <code>{`{{lugar_entrega}}`}</code>, <code>{`{{lugar_devolucion}}`}</code>, <code>{`{{tarifa_dia}}`}</code>, <code>{`{{subtotal}}`}</code>, <code>{`{{comision}}`}</code>, <code>{`{{seguro}}`}</code>, <code>{`{{deposito}}`}</code>, <code>{`{{total}}`}</code>, <code>{`{{moneda}}`}</code>, <code>{`{{metodo_pago}}`}</code>, <code>{`{{referencia_pago}}`}</code>, <code>{`{{fecha_pago}}`}</code>, <code>{`{{multa_fumar}}`}</code>, <code>{`{{empresa_razon_social}}`}</code>, <code>{`{{empresa_rif}}`}</code>, <code>{`{{empresa_direccion}}`}</code>, <code>{`{{empresa_sitio}}`}</code>, <code>{`{{jurisdiccion}}`}</code>, <code>{`{{contrato_version}}`}</code>, <code>{`{{fecha_aceptacion}}`}</code>, <code>{`{{ip_aceptacion}}`}</code>, <code>{`{{dispositivo}}`}</code>.
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Vista previa</CardTitle>
                <CardDescription>Render con datos de ejemplo. Así verá el arrendatario el contrato adjunto al correo de confirmación.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="rounded-md border bg-muted/30 p-4 max-h-[420px] overflow-auto">
                  <pre className="text-xs whitespace-pre-wrap font-sans leading-relaxed">
                    {renderContractPreview(settings)}
                  </pre>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </AdminLayout>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <Label>{label}</Label>
      <Input value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
function NumField({ label, value, onChange, step = 1 }: { label: string; value: number; onChange: (v: number) => void; step?: number }) {
  return (
    <div>
      <Label>{label}</Label>
      <Input type="number" step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
    </div>
  );
}
function ToggleRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between p-3 border rounded-md">
      <span className="text-sm">{label}</span>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

function renderContractPreview(settings: SettingsType): string {
  const sample: Record<string, string> = {
    reserva_id: "RV-2026-00123",
    arrendatario_nombre: "Carlos Pérez",
    arrendatario_cedula: "V-12.345.678",
    arrendatario_licencia: "12345678",
    arrendatario_direccion: "Av. Francisco de Miranda, Los Palos Grandes, Caracas",
    propietario_nombre: "María González",
    propietario_cedula: "V-9.876.543",
    vehiculo_marca: "Toyota",
    vehiculo_modelo: "Corolla",
    vehiculo_anio: "2022",
    vehiculo_color: "Plata",
    vehiculo_placa: "AB123CD",
    vehiculo_vin: "JTDBL40E099012345",
    km_inicio: "45.230",
    km_max_dia: "200",
    inicio: "2026-05-20",
    fin: "2026-05-25",
    dias: "5",
    lugar_entrega: "Chacao, Caracas",
    lugar_devolucion: "Chacao, Caracas",
    tarifa_dia: "$45",
    subtotal: "$225",
    comision: "$22.50",
    seguro: "$40",
    deposito: "$150",
    total: "$287.50",
    moneda: "USD",
    metodo_pago: "Zelle",
    referencia_pago: "ZL-998877",
    fecha_pago: "2026-05-14 10:32",
    multa_fumar: "$50",
    empresa_razon_social: settings.contract.company_legal_name,
    empresa_rif: settings.contract.company_rif,
    empresa_direccion: settings.contract.company_address,
    empresa_sitio: settings.business.website,
    jurisdiccion: settings.contract.jurisdiction,
    contrato_version: settings.contract.version,
    fecha_aceptacion: "2026-05-14 10:35",
    ip_aceptacion: "190.202.10.45",
    dispositivo: "Chrome 124 / iPhone 15",
  };
  return settings.contract.body.replace(/\{\{(\w+)\}\}/g, (_, k) => sample[k] ?? `{{${k}}}`);
}
