import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { format, subDays, startOfMonth, startOfWeek } from "date-fns";
import { es } from "date-fns/locale";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
  BarChart,
  Bar,
  Cell,
  PieChart,
  Pie,
} from "recharts";
import {
  DollarSign,
  TrendingUp,
  Car,
  Users,
  Star,
  AlertTriangle,
  CalendarCheck,
  XCircle,
  Clock,
  Activity,
} from "lucide-react";
import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";

type RangeKey = "today" | "week" | "month" | "30d" | "90d";

const RANGES: { key: RangeKey; label: string }[] = [
  { key: "today", label: "Hoy" },
  { key: "week", label: "Esta semana" },
  { key: "month", label: "Este mes" },
  { key: "30d", label: "Últimos 30 días" },
  { key: "90d", label: "Últimos 90 días" },
];

function rangeDates(key: RangeKey): { from: Date; to: Date } {
  const to = new Date();
  let from = new Date();
  switch (key) {
    case "today": from = new Date(); break;
    case "week": from = startOfWeek(to, { weekStartsOn: 1 }); break;
    case "month": from = startOfMonth(to); break;
    case "30d": from = subDays(to, 30); break;
    case "90d": from = subDays(to, 90); break;
  }
  return { from, to };
}

function formatUSD(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n || 0);
}

interface Metrics {
  kpis: Record<string, number>;
  revenue_series: { month: string; revenue: number; commissions: number; insurance: number }[];
  top_cars: { name: string; count: number; revenue: number }[];
  bottom_cars: { name: string; count: number; revenue: number }[];
  distribution: { label: string; value: number }[];
  recent_reservations: any[];
  alerts: { kind: string; title: string; detail: string; ts: string }[];
  recent_users: { user_id: string; full_name: string | null; created_at: string; last_login_at: string | null }[];
}

const PIE_COLORS = ["hsl(var(--primary))", "hsl(var(--accent))", "#f59e0b", "#3b82f6", "#a855f7", "#ec4899", "#14b8a6", "#64748b"];

function statusVariant(s: string): "default" | "secondary" | "destructive" | "outline" {
  if (s === "completed" || s === "active") return "default";
  if (s === "pending") return "secondary";
  if (s === "cancelled" || s === "rejected") return "destructive";
  return "outline";
}

function KpiCard({ icon: Icon, label, value, sub }: { icon: any; label: string; value: string; sub?: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide">{label}</p>
            <p className="text-2xl font-bold mt-1">{value}</p>
            {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
          </div>
          <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function AdminDashboardPage() {
  const [range, setRange] = useState<RangeKey>("month");
  const [data, setData] = useState<Metrics | null>(null);
  const [loading, setLoading] = useState(true);

  const { from, to } = useMemo(() => rangeDates(range), [range]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      const { data: res, error } = await supabase.rpc("admin_overview_metrics", {
        _from: format(from, "yyyy-MM-dd"),
        _to: format(to, "yyyy-MM-dd"),
      });
      if (!cancelled) {
        if (error) console.error(error);
        setData(res as unknown as Metrics);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [from, to]);

  const k = data?.kpis ?? ({} as Record<string, number>);
  const occupancyData = useMemo(() => {
    if (!data) return [];
    // merge top + bottom unique
    const map = new Map<string, { name: string; count: number }>();
    [...(data.top_cars || []), ...(data.bottom_cars || [])].forEach((c) =>
      map.set(c.name, { name: c.name, count: c.count }),
    );
    return Array.from(map.values()).sort((a, b) => b.count - a.count).slice(0, 10);
  }, [data]);

  const maxCount = Math.max(1, ...occupancyData.map((d) => d.count));
  const barColor = (cnt: number) => {
    const ratio = cnt / maxCount;
    if (ratio >= 0.66) return "hsl(var(--primary))";
    if (ratio >= 0.33) return "#f59e0b";
    return "#ef4444";
  };

  return (
    <AdminLayout title="Dashboard">
      <div className="space-y-6">
        {/* Filters */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-2xl font-bold">Visión general</h2>
            <p className="text-sm text-muted-foreground">
              {format(from, "d MMM yyyy", { locale: es })} – {format(to, "d MMM yyyy", { locale: es })}
            </p>
          </div>
          <Select value={range} onValueChange={(v) => setRange(v as RangeKey)}>
            <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {RANGES.map((r) => <SelectItem key={r.key} value={r.key}>{r.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {/* KPI grid */}
        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-24" />)}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <KpiCard icon={DollarSign} label="Ingresos" value={formatUSD(k.total_revenue)} sub={`Comisiones ${formatUSD(k.commissions)}`} />
              <KpiCard icon={CalendarCheck} label="Reservas" value={String(k.total_reservations || 0)} sub={`${k.active || 0} activas · ${k.pending || 0} pendientes`} />
              <KpiCard icon={Car} label="Flota activa" value={String(k.total_vehicles || 0)} sub={`Avg ${formatUSD(k.avg_revenue_per_car)} / auto`} />
              <KpiCard icon={Users} label="Usuarios nuevos" value={String(k.new_users || 0)} sub="En el período" />
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <KpiCard icon={TrendingUp} label="Completadas" value={String(k.completed || 0)} />
              <KpiCard icon={XCircle} label="Tasa cancelación" value={`${k.cancellation_rate || 0}%`} sub={`${k.cancelled || 0} canceladas`} />
              <KpiCard icon={Star} label="Calificación promedio" value={k.nps ? Number(k.nps).toFixed(2) : "—"} sub="NPS interno" />
              <KpiCard icon={AlertTriangle} label="Tickets abiertos" value={String(k.open_tickets || 0)} sub={`${k.closed_tickets || 0} cerrados`} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Charts column */}
              <div className="lg:col-span-2 space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Ingresos últimos 6 meses</CardTitle>
                    <CardDescription>Ingresos totales, comisiones y seguros (USD)</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="h-72">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={data?.revenue_series || []}>
                          <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                          <XAxis dataKey="month" />
                          <YAxis tickFormatter={(v) => `$${v}`} />
                          <Tooltip formatter={(v: number) => formatUSD(v)} />
                          <Legend />
                          <Line type="monotone" dataKey="revenue" name="Ingresos" stroke="hsl(var(--primary))" strokeWidth={2} />
                          <Line type="monotone" dataKey="commissions" name="Comisiones" stroke="hsl(var(--accent))" strokeWidth={2} />
                          <Line type="monotone" dataKey="insurance" name="Seguros" stroke="#f59e0b" strokeWidth={2} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Card>
                    <CardHeader>
                      <CardTitle>Ocupancia por auto</CardTitle>
                      <CardDescription>Top + bottom 5 por reservas</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="h-72">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={occupancyData} layout="vertical" margin={{ left: 12 }}>
                            <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                            <XAxis type="number" allowDecimals={false} />
                            <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 11 }} />
                            <Tooltip />
                            <Bar dataKey="count" name="Reservas">
                              {occupancyData.map((d, i) => <Cell key={i} fill={barColor(d.count)} />)}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>Distribución de ingresos</CardTitle>
                      <CardDescription>Por zona/parroquia</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="h-72">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie data={data?.distribution || []} dataKey="value" nameKey="label" outerRadius={90} label={(e) => e.label}>
                              {(data?.distribution || []).map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                            </Pie>
                            <Tooltip formatter={(v: number) => formatUSD(v)} />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>

              {/* Right feeds */}
              <div className="space-y-4">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle className="text-base">Últimas reservas</CardTitle>
                    <Button asChild variant="ghost" size="sm"><Link to="/admin/reservas">Ver todas</Link></Button>
                  </CardHeader>
                  <CardContent className="p-0">
                    <ScrollArea className="h-72">
                      <ul className="divide-y">
                        {(data?.recent_reservations || []).map((r: any) => (
                          <li key={r.id} className="px-4 py-3 text-sm">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <p className="font-medium truncate">{r.vehicle || "Vehículo"}</p>
                                <p className="text-xs text-muted-foreground truncate">{r.renter || "—"}</p>
                              </div>
                              <Badge variant={statusVariant(r.status)} className="shrink-0">{r.status}</Badge>
                            </div>
                            <div className="flex items-center justify-between mt-1 text-xs text-muted-foreground">
                              <span>{format(new Date(r.created_at), "d MMM HH:mm", { locale: es })}</span>
                              <span className="font-medium text-foreground">{formatUSD(Number(r.total_price))}</span>
                            </div>
                          </li>
                        ))}
                        {!data?.recent_reservations?.length && (
                          <li className="px-4 py-6 text-center text-sm text-muted-foreground">Sin reservas aún</li>
                        )}
                      </ul>
                    </ScrollArea>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-orange-500" /> Alertas del sistema
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <ScrollArea className="h-56">
                      <ul className="divide-y">
                        {(data?.alerts || []).map((a, i) => (
                          <li key={i} className="px-4 py-3 text-sm">
                            <div className="flex items-start gap-2">
                              <Clock className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                              <div className="min-w-0">
                                <p className="font-medium truncate">{a.title}</p>
                                <p className="text-xs text-muted-foreground truncate">{a.detail}</p>
                              </div>
                            </div>
                          </li>
                        ))}
                        {!data?.alerts?.length && (
                          <li className="px-4 py-6 text-center text-sm text-muted-foreground">Todo en orden</li>
                        )}
                      </ul>
                    </ScrollArea>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Activity className="h-4 w-4" /> Actividad de usuarios
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <ScrollArea className="h-56">
                      <ul className="divide-y">
                        {(data?.recent_users || []).map((u) => (
                          <li key={u.user_id} className="px-4 py-3 text-sm">
                            <p className="font-medium truncate">{u.full_name || "Sin nombre"}</p>
                            <p className="text-xs text-muted-foreground">
                              Registro: {format(new Date(u.created_at), "d MMM yyyy", { locale: es })}
                              {u.last_login_at && ` · Último login: ${format(new Date(u.last_login_at), "d MMM", { locale: es })}`}
                            </p>
                          </li>
                        ))}
                        {!data?.recent_users?.length && (
                          <li className="px-4 py-6 text-center text-sm text-muted-foreground">Sin actividad</li>
                        )}
                      </ul>
                    </ScrollArea>
                  </CardContent>
                </Card>
              </div>
            </div>
          </>
        )}
      </div>
    </AdminLayout>
  );
}
