import { useEffect, useMemo, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import {
  AlertTriangle,
  Wrench,
  CalendarClock,
  Truck,
  CreditCard,
  Wallet,
  ShieldAlert,
  Receipt,
  UserCheck,
  UserX,
  LifeBuoy,
  Repeat,
  Star,
  Wifi,
  Plug,
  HardDrive,
  CheckCircle2,
  Bell,
  Mail,
  Smartphone,
  Slack,
  LayoutDashboard,
  Filter,
  Search,
  Check,
  Trash2,
} from "lucide-react";
import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { RefreshCw } from "lucide-react";

type Severity = "critical" | "warning" | "info" | "success";
type Category = "operational" | "financial" | "users" | "technical";

type AlertItem = {
  id: string;
  category: Category;
  type: string;
  title: string;
  description: string;
  severity: Severity;
  createdAt: string; // ISO
  read: boolean;
  resolved: boolean;
  link?: { label: string; href: string };
  icon: React.ComponentType<{ className?: string }>;
};

const STATE_KEY = "ruedave.admin.alerts.state.v2";
const PREFS_KEY = "ruedave.admin.alerts.prefs.v1";

type ChannelPrefs = {
  email: boolean;
  emailAddress: string;
  push: boolean;
  slack: boolean;
  slackWebhook: string;
  dashboard: boolean;
};

type CategoryPrefs = Record<string, { enabled: boolean; channels: ("email" | "push" | "slack" | "dashboard")[] }>;

type Prefs = {
  channels: ChannelPrefs;
  types: CategoryPrefs;
};

const DEFAULT_PREFS: Prefs = {
  channels: {
    email: true,
    emailAddress: "admin@ruedave.com",
    push: false,
    slack: false,
    slackWebhook: "",
    dashboard: true,
  },
  types: {
    soat_expired: { enabled: true, channels: ["email", "dashboard"] },
    inspection_pending: { enabled: true, channels: ["dashboard"] },
    maintenance_overdue: { enabled: true, channels: ["email", "dashboard"] },
    reservation_unconfirmed: { enabled: true, channels: ["dashboard"] },
    return_late: { enabled: true, channels: ["email", "dashboard"] },
    payment_failed: { enabled: true, channels: ["email", "dashboard"] },
    payout_pending: { enabled: true, channels: ["email", "dashboard"] },
    suspicious_transaction: { enabled: true, channels: ["email", "dashboard"] },
    payment_discrepancy: { enabled: true, channels: ["email", "dashboard"] },
    user_verified: { enabled: false, channels: ["dashboard"] },
    user_suspended: { enabled: true, channels: ["dashboard"] },
    critical_ticket: { enabled: true, channels: ["email", "dashboard"] },
    multiple_cancellations: { enabled: true, channels: ["email", "dashboard"] },
    bad_review: { enabled: true, channels: ["dashboard"] },
    api_timeout: { enabled: true, channels: ["email", "dashboard"] },
    integration_error: { enabled: true, channels: ["email", "dashboard"] },
    storage_low: { enabled: true, channels: ["email", "dashboard"] },
    backup_complete: { enabled: false, channels: ["dashboard"] },
  },
};

const ALERT_TYPES: { key: string; category: Category; label: string; icon: React.ComponentType<{ className?: string }>; severity: Severity }[] = [
  { key: "soat_expired", category: "operational", label: "SOAT vencido", icon: AlertTriangle, severity: "critical" },
  { key: "inspection_pending", category: "operational", label: "Inspección pendiente (>5 días)", icon: Wrench, severity: "warning" },
  { key: "maintenance_overdue", category: "operational", label: "Mantenimiento vencido", icon: Wrench, severity: "warning" },
  { key: "reservation_unconfirmed", category: "operational", label: "Reserva sin confirmar (>24h)", icon: CalendarClock, severity: "warning" },
  { key: "return_late", category: "operational", label: "Devolución retrasada", icon: Truck, severity: "critical" },
  { key: "payment_failed", category: "financial", label: "Pago rechazado", icon: CreditCard, severity: "critical" },
  { key: "payout_pending", category: "financial", label: "Payout pendiente (>7 días)", icon: Wallet, severity: "warning" },
  { key: "suspicious_transaction", category: "financial", label: "Transacción sospechosa", icon: ShieldAlert, severity: "critical" },
  { key: "payment_discrepancy", category: "financial", label: "Discrepancia (reserva sin pago)", icon: Receipt, severity: "warning" },
  { key: "user_verified", category: "users", label: "Usuario nuevo verificado", icon: UserCheck, severity: "info" },
  { key: "user_suspended", category: "users", label: "Usuario suspendido", icon: UserX, severity: "warning" },
  { key: "critical_ticket", category: "users", label: "Ticket crítico abierto", icon: LifeBuoy, severity: "critical" },
  { key: "multiple_cancellations", category: "users", label: "Múltiples cancelaciones (posible fraude)", icon: Repeat, severity: "warning" },
  { key: "bad_review", category: "users", label: "Review muy negativa", icon: Star, severity: "warning" },
  { key: "api_timeout", category: "technical", label: "API timeout", icon: Wifi, severity: "warning" },
  { key: "integration_error", category: "technical", label: "Error en integración", icon: Plug, severity: "critical" },
  { key: "storage_low", category: "technical", label: "Espacio de almacenamiento bajo", icon: HardDrive, severity: "warning" },
  { key: "backup_complete", category: "technical", label: "Backup completado", icon: CheckCircle2, severity: "success" },
];

const CATEGORY_LABEL: Record<Category, string> = {
  operational: "Operacionales",
  financial: "Financieras",
  users: "Usuarios",
  technical: "Técnicas",
};

function seedAlerts(): AlertItem[] {
  const now = Date.now();
  const samples: Array<Partial<AlertItem> & { typeKey: string; offsetMin: number; description: string; link?: AlertItem["link"] }> = [
    { typeKey: "soat_expired", offsetMin: 30, description: "Toyota Corolla 2020 (placa AB123CD) — SOAT venció hace 3 días.", link: { label: "Ver vehículo", href: "/admin/flota" } },
    { typeKey: "return_late", offsetMin: 90, description: "Reserva #R-1042 lleva 4 horas de retraso en la devolución.", link: { label: "Ver reserva", href: "/admin/reservas" } },
    { typeKey: "payment_failed", offsetMin: 120, description: "Pago de USD 240 rechazado para reserva #R-1051.", link: { label: "Ver finanzas", href: "/admin/finanzas" } },
    { typeKey: "critical_ticket", offsetMin: 200, description: "Ticket #T-318: 'Auto no enciende, estoy varado'.", link: { label: "Ver soporte", href: "/admin/soporte" } },
    { typeKey: "payout_pending", offsetMin: 60 * 8, description: "3 dueños con payouts pendientes hace más de 7 días.", link: { label: "Procesar payouts", href: "/admin/finanzas" } },
    { typeKey: "reservation_unconfirmed", offsetMin: 60 * 26, description: "5 reservas sin confirmar hace más de 24h.", link: { label: "Ver reservas", href: "/admin/reservas" } },
    { typeKey: "maintenance_overdue", offsetMin: 60 * 48, description: "2 vehículos con mantenimiento vencido.", link: { label: "Ver flota", href: "/admin/flota" } },
    { typeKey: "multiple_cancellations", offsetMin: 60 * 12, description: "Usuario @rcardenas canceló 4 reservas en los últimos 7 días.", link: { label: "Ver usuario", href: "/admin/usuarios" } },
    { typeKey: "bad_review", offsetMin: 60 * 4, description: "Review de 1★ recibida en Ford Escape 2019.", link: { label: "Ver review", href: "/admin/flota" } },
    { typeKey: "user_verified", offsetMin: 60 * 1, description: "Carlos Pérez completó la verificación KYC.", link: { label: "Ver usuario", href: "/admin/usuarios" } },
    { typeKey: "api_timeout", offsetMin: 60 * 2, description: "Pasarela de pagos: 3 timeouts en los últimos 15 min." },
    { typeKey: "storage_low", offsetMin: 60 * 36, description: "Almacenamiento al 87% de capacidad." },
    { typeKey: "backup_complete", offsetMin: 60 * 6, description: "Backup automático nocturno completado correctamente." },
    { typeKey: "suspicious_transaction", offsetMin: 60 * 3, description: "5 intentos de pago fallidos en 2 minutos desde la misma IP.", link: { label: "Investigar", href: "/admin/finanzas" } },
  ];
  return samples.map((s, i) => {
    const t = ALERT_TYPES.find((x) => x.key === s.typeKey)!;
    return {
      id: `seed-${i}`,
      category: t.category,
      type: t.key,
      title: t.label,
      description: s.description,
      severity: t.severity,
      createdAt: new Date(now - s.offsetMin * 60 * 1000).toISOString(),
      read: false,
      resolved: false,
      link: s.link,
      icon: t.icon,
    };
  });
}

function loadAlerts(): AlertItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const seed = seedAlerts();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(seed.map(({ icon, ...rest }) => rest)));
      return seed;
    }
    const parsed = JSON.parse(raw) as Omit<AlertItem, "icon">[];
    return parsed.map((a) => {
      const t = ALERT_TYPES.find((x) => x.key === a.type);
      return { ...a, icon: t?.icon ?? Bell };
    });
  } catch {
    return seedAlerts();
  }
}

function saveAlerts(items: AlertItem[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items.map(({ icon, ...rest }) => rest)));
}

function loadPrefs(): Prefs {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (!raw) return DEFAULT_PREFS;
    const parsed = JSON.parse(raw);
    return {
      channels: { ...DEFAULT_PREFS.channels, ...(parsed.channels || {}) },
      types: { ...DEFAULT_PREFS.types, ...(parsed.types || {}) },
    };
  } catch {
    return DEFAULT_PREFS;
  }
}

const SEVERITY_STYLES: Record<Severity, { badge: string; ring: string; iconBg: string }> = {
  critical: { badge: "bg-destructive text-destructive-foreground", ring: "border-l-destructive", iconBg: "bg-destructive/10 text-destructive" },
  warning: { badge: "bg-amber-500 text-white", ring: "border-l-amber-500", iconBg: "bg-amber-500/10 text-amber-600 dark:text-amber-400" },
  info: { badge: "bg-sky-500 text-white", ring: "border-l-sky-500", iconBg: "bg-sky-500/10 text-sky-600 dark:text-sky-400" },
  success: { badge: "bg-emerald-500 text-white", ring: "border-l-emerald-500", iconBg: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" },
};

export default function AdminAlertsPage() {
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS);
  const [tab, setTab] = useState<"all" | Category>("all");
  const [severityFilter, setSeverityFilter] = useState<"all" | Severity>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "unread" | "resolved">("unread");
  const [query, setQuery] = useState("");

  useEffect(() => {
    setAlerts(loadAlerts());
    setPrefs(loadPrefs());
  }, []);

  const filtered = useMemo(() => {
    return alerts
      .filter((a) => (tab === "all" ? true : a.category === tab))
      .filter((a) => (severityFilter === "all" ? true : a.severity === severityFilter))
      .filter((a) => {
        if (statusFilter === "unread") return !a.read && !a.resolved;
        if (statusFilter === "resolved") return a.resolved;
        return true;
      })
      .filter((a) =>
        query.trim() === ""
          ? true
          : (a.title + " " + a.description).toLowerCase().includes(query.toLowerCase())
      )
      .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
  }, [alerts, tab, severityFilter, statusFilter, query]);

  const counts = useMemo(() => {
    const unread = alerts.filter((a) => !a.read && !a.resolved).length;
    const critical = alerts.filter((a) => a.severity === "critical" && !a.resolved).length;
    const warning = alerts.filter((a) => a.severity === "warning" && !a.resolved).length;
    const today = alerts.filter((a) => {
      const d = new Date(a.createdAt);
      const now = new Date();
      return d.toDateString() === now.toDateString();
    }).length;
    return { unread, critical, warning, today };
  }, [alerts]);

  function update(items: AlertItem[]) {
    setAlerts(items);
    saveAlerts(items);
  }

  function markRead(id: string) {
    update(alerts.map((a) => (a.id === id ? { ...a, read: true } : a)));
  }
  function markAllRead() {
    update(alerts.map((a) => ({ ...a, read: true })));
    toast.success("Todas las alertas marcadas como leídas");
  }
  function resolve(id: string) {
    update(alerts.map((a) => (a.id === id ? { ...a, resolved: true, read: true } : a)));
    toast.success("Alerta resuelta");
  }
  function remove(id: string) {
    update(alerts.filter((a) => a.id !== id));
  }
  function clearResolved() {
    update(alerts.filter((a) => !a.resolved));
    toast.success("Alertas resueltas eliminadas");
  }

  function savePrefs(next: Prefs) {
    setPrefs(next);
    localStorage.setItem(PREFS_KEY, JSON.stringify(next));
  }

  function toggleType(key: string) {
    const cur = prefs.types[key] ?? { enabled: true, channels: ["dashboard" as const] };
    savePrefs({ ...prefs, types: { ...prefs.types, [key]: { ...cur, enabled: !cur.enabled } } });
  }

  function toggleTypeChannel(key: string, ch: "email" | "push" | "slack" | "dashboard") {
    const cur = prefs.types[key] ?? { enabled: true, channels: ["dashboard" as const] };
    const has = cur.channels.includes(ch);
    const channels = has ? cur.channels.filter((c) => c !== ch) : [...cur.channels, ch];
    savePrefs({ ...prefs, types: { ...prefs.types, [key]: { ...cur, channels } } });
  }

  return (
    <AdminLayout title="Alertas & Notificaciones">
      <div className="space-y-6">
        {/* Stat cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard icon={Bell} label="Sin leer" value={counts.unread} tone="default" />
          <StatCard icon={AlertTriangle} label="Críticas activas" value={counts.critical} tone="critical" />
          <StatCard icon={ShieldAlert} label="Advertencias" value={counts.warning} tone="warning" />
          <StatCard icon={LayoutDashboard} label="Hoy" value={counts.today} tone="info" />
        </div>

        <Tabs defaultValue="inbox">
          <TabsList>
            <TabsTrigger value="inbox">Bandeja</TabsTrigger>
            <TabsTrigger value="types">Tipos de alertas</TabsTrigger>
            <TabsTrigger value="channels">Canales</TabsTrigger>
          </TabsList>

          {/* INBOX */}
          <TabsContent value="inbox" className="space-y-4 mt-4">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex flex-col lg:flex-row lg:items-center gap-3 lg:justify-between">
                  <div className="flex flex-wrap gap-2">
                    {(["all", "operational", "financial", "users", "technical"] as const).map((c) => (
                      <Button
                        key={c}
                        variant={tab === c ? "default" : "outline"}
                        size="sm"
                        onClick={() => setTab(c)}
                      >
                        {c === "all" ? "Todas" : CATEGORY_LABEL[c]}
                      </Button>
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-2 items-center">
                    <div className="relative">
                      <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Buscar..."
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        className="pl-8 h-9 w-44"
                      />
                    </div>
                    <Select value={severityFilter} onValueChange={(v) => setSeverityFilter(v as any)}>
                      <SelectTrigger className="h-9 w-36"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Toda severidad</SelectItem>
                        <SelectItem value="critical">Crítica</SelectItem>
                        <SelectItem value="warning">Advertencia</SelectItem>
                        <SelectItem value="info">Info</SelectItem>
                        <SelectItem value="success">Éxito</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
                      <SelectTrigger className="h-9 w-36"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="unread">Sin leer</SelectItem>
                        <SelectItem value="all">Todas</SelectItem>
                        <SelectItem value="resolved">Resueltas</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button variant="outline" size="sm" onClick={markAllRead}>
                      <Check className="h-4 w-4 mr-1" /> Marcar leídas
                    </Button>
                    <Button variant="outline" size="sm" onClick={clearResolved}>
                      <Trash2 className="h-4 w-4 mr-1" /> Limpiar resueltas
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {filtered.length === 0 ? (
                  <div className="py-12 text-center text-muted-foreground">
                    <Bell className="h-10 w-10 mx-auto mb-2 opacity-40" />
                    No hay alertas que coincidan con los filtros.
                  </div>
                ) : (
                  <ScrollArea className="h-[560px] pr-3">
                    <div className="space-y-2">
                      {filtered.map((a) => {
                        const styles = SEVERITY_STYLES[a.severity];
                        const Icon = a.icon;
                        return (
                          <div
                            key={a.id}
                            className={`flex gap-3 p-3 rounded-lg border border-l-4 ${styles.ring} ${
                              a.read ? "bg-background" : "bg-muted/40"
                            } ${a.resolved ? "opacity-60" : ""}`}
                          >
                            <div className={`h-10 w-10 rounded-md flex items-center justify-center shrink-0 ${styles.iconBg}`}>
                              <Icon className="h-5 w-5" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start gap-2 flex-wrap">
                                <span className="font-medium">{a.title}</span>
                                <Badge className={styles.badge}>{a.severity}</Badge>
                                <Badge variant="outline">{CATEGORY_LABEL[a.category]}</Badge>
                                {a.resolved && <Badge variant="secondary">Resuelta</Badge>}
                                {!a.read && !a.resolved && (
                                  <span className="h-2 w-2 rounded-full bg-primary mt-2" />
                                )}
                              </div>
                              <p className="text-sm text-muted-foreground mt-1">{a.description}</p>
                              <div className="text-xs text-muted-foreground mt-1">
                                {formatDistanceToNow(new Date(a.createdAt), { locale: es, addSuffix: true })}
                              </div>
                            </div>
                            <div className="flex flex-col gap-1 shrink-0">
                              {a.link && (
                                <Button asChild size="sm" variant="outline">
                                  <a href={a.link.href}>{a.link.label}</a>
                                </Button>
                              )}
                              {!a.read && !a.resolved && (
                                <Button size="sm" variant="ghost" onClick={() => markRead(a.id)}>
                                  Marcar leída
                                </Button>
                              )}
                              {!a.resolved && (
                                <Button size="sm" variant="ghost" onClick={() => resolve(a.id)}>
                                  Resolver
                                </Button>
                              )}
                              <Button size="sm" variant="ghost" onClick={() => remove(a.id)}>
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* TYPES */}
          <TabsContent value="types" className="space-y-4 mt-4">
            {(["operational", "financial", "users", "technical"] as Category[]).map((cat) => (
              <Card key={cat}>
                <CardHeader>
                  <CardTitle className="text-base">{CATEGORY_LABEL[cat]}</CardTitle>
                  <CardDescription>Activa o desactiva los tipos y elige por qué canal recibirlos.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  {ALERT_TYPES.filter((t) => t.category === cat).map((t) => {
                    const p = prefs.types[t.key] ?? { enabled: true, channels: ["dashboard" as const] };
                    const Icon = t.icon;
                    return (
                      <div key={t.key} className="flex items-center justify-between gap-3 p-3 border rounded-lg">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={`h-9 w-9 rounded-md flex items-center justify-center ${SEVERITY_STYLES[t.severity].iconBg}`}>
                            <Icon className="h-4 w-4" />
                          </div>
                          <div className="min-w-0">
                            <div className="font-medium truncate">{t.label}</div>
                            <Badge className={`${SEVERITY_STYLES[t.severity].badge} mt-1`} variant="secondary">
                              {t.severity}
                            </Badge>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap justify-end">
                          {(["dashboard", "email", "push", "slack"] as const).map((ch) => (
                            <Button
                              key={ch}
                              variant={p.channels.includes(ch) ? "default" : "outline"}
                              size="sm"
                              disabled={!p.enabled}
                              onClick={() => toggleTypeChannel(t.key, ch)}
                              className="h-8"
                            >
                              {ch === "dashboard" && <LayoutDashboard className="h-3.5 w-3.5 mr-1" />}
                              {ch === "email" && <Mail className="h-3.5 w-3.5 mr-1" />}
                              {ch === "push" && <Smartphone className="h-3.5 w-3.5 mr-1" />}
                              {ch === "slack" && <Slack className="h-3.5 w-3.5 mr-1" />}
                              {ch}
                            </Button>
                          ))}
                          <Switch checked={p.enabled} onCheckedChange={() => toggleType(t.key)} />
                        </div>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          {/* CHANNELS */}
          <TabsContent value="channels" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Canales de entrega</CardTitle>
                <CardDescription>Configura cómo y dónde se entregan las alertas.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <ChannelRow
                  icon={Mail}
                  title="Email"
                  description="Recibe alertas por correo electrónico."
                  enabled={prefs.channels.email}
                  onToggle={(v) => savePrefs({ ...prefs, channels: { ...prefs.channels, email: v } })}
                >
                  <div className="grid gap-2 max-w-md">
                    <Label>Email destinatario</Label>
                    <Input
                      value={prefs.channels.emailAddress}
                      onChange={(e) => savePrefs({ ...prefs, channels: { ...prefs.channels, emailAddress: e.target.value } })}
                      placeholder="alertas@ruedave.com"
                    />
                  </div>
                </ChannelRow>

                <ChannelRow
                  icon={Smartphone}
                  title="Push notifications"
                  description="Notificaciones push en la app móvil del administrador."
                  enabled={prefs.channels.push}
                  onToggle={(v) => savePrefs({ ...prefs, channels: { ...prefs.channels, push: v } })}
                />

                <ChannelRow
                  icon={Slack}
                  title="Slack"
                  description="Envía alertas a un canal de Slack vía webhook."
                  enabled={prefs.channels.slack}
                  onToggle={(v) => savePrefs({ ...prefs, channels: { ...prefs.channels, slack: v } })}
                >
                  <div className="grid gap-2 max-w-md">
                    <Label>Webhook URL</Label>
                    <Input
                      value={prefs.channels.slackWebhook}
                      onChange={(e) => savePrefs({ ...prefs, channels: { ...prefs.channels, slackWebhook: e.target.value } })}
                      placeholder="https://hooks.slack.com/services/..."
                    />
                  </div>
                </ChannelRow>

                <ChannelRow
                  icon={LayoutDashboard}
                  title="Dashboard widget"
                  description="Muestra alertas en el widget del panel principal."
                  enabled={prefs.channels.dashboard}
                  onToggle={(v) => savePrefs({ ...prefs, channels: { ...prefs.channels, dashboard: v } })}
                />

                <div className="flex justify-end">
                  <Button onClick={() => toast.success("Preferencias guardadas")}>Guardar cambios</Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  tone: "default" | "critical" | "warning" | "info";
}) {
  const toneCls =
    tone === "critical"
      ? "text-destructive"
      : tone === "warning"
      ? "text-amber-600 dark:text-amber-400"
      : tone === "info"
      ? "text-sky-600 dark:text-sky-400"
      : "text-foreground";
  return (
    <Card>
      <CardContent className="p-4 flex items-center gap-3">
        <div className={`h-10 w-10 rounded-md bg-muted flex items-center justify-center ${toneCls}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <div className="text-xs text-muted-foreground">{label}</div>
          <div className={`text-2xl font-semibold ${toneCls}`}>{value}</div>
        </div>
      </CardContent>
    </Card>
  );
}

function ChannelRow({
  icon: Icon,
  title,
  description,
  enabled,
  onToggle,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  enabled: boolean;
  onToggle: (v: boolean) => void;
  children?: React.ReactNode;
}) {
  return (
    <div className="border rounded-lg p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex gap-3">
          <div className="h-10 w-10 rounded-md bg-muted flex items-center justify-center">
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <div className="font-medium">{title}</div>
            <div className="text-sm text-muted-foreground">{description}</div>
          </div>
        </div>
        <Switch checked={enabled} onCheckedChange={onToggle} />
      </div>
      {enabled && children && <div className="pl-13">{children}</div>}
    </div>
  );
}
