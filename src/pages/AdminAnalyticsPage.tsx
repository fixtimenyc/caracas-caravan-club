import { useEffect, useMemo, useState } from "react";
import { format, subMonths, startOfMonth, endOfMonth, differenceInDays } from "date-fns";
import { es } from "date-fns/locale";
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar, AreaChart, Area,
  PieChart, Pie, Cell, XAxis, YAxis, Tooltip, CartesianGrid, Legend,
} from "recharts";
import {
  Users, Car, TrendingUp, Star, Target, DollarSign, Download,
  FileText, Calendar, Mail, Plus, Trash2, CheckCircle2, Clock, AlertCircle,
} from "lucide-react";
import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Link } from "react-router-dom";

const COMMISSION = 0.20;
const COLORS = ["hsl(var(--primary))", "hsl(var(--accent))", "#f59e0b", "#10b981", "#6366f1", "#ec4899", "#06b6d4", "#f43f5e"];
const fmt = (n: number) => `$${Number(n || 0).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
const num = (n: number) => Number(n || 0).toLocaleString("en-US");

type Row = Record<string, any>;

export default function AdminAnalyticsPage() {
  const [loading, setLoading] = useState(true);
  const [reservations, setReservations] = useState<Row[]>([]);
  const [vehicles, setVehicles] = useState<Row[]>([]);
  const [profiles, setProfiles] = useState<Row[]>([]);
  const [reviews, setReviews] = useState<Row[]>([]);
  const [tickets, setTickets] = useState<Row[]>([]);
  const [maintenance, setMaintenance] = useState<Row[]>([]);
  const [roles, setRoles] = useState<Row[]>([]);

  const load = async () => {
    setLoading(true);
    const [r, v, p, rv, t, m, ur] = await Promise.all([
      supabase.from("reservations").select("*").limit(5000),
      supabase.from("vehicles").select("*").limit(5000),
      supabase.from("profiles").select("*").limit(5000),
      supabase.from("reviews").select("*").limit(5000),
      supabase.from("support_tickets").select("*").limit(5000),
      supabase.from("vehicle_maintenance").select("*").limit(5000),
      supabase.from("user_roles").select("*").limit(5000),
    ]);
    setReservations(r.data || []);
    setVehicles(v.data || []);
    setProfiles(p.data || []);
    setReviews(rv.data || []);
    setTickets(t.data || []);
    setMaintenance(m.data || []);
    setRoles(ur.data || []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const data = useMemo(() => buildAnalytics({ reservations, vehicles, profiles, reviews, tickets, maintenance, roles }), [reservations, vehicles, profiles, reviews, tickets, maintenance, roles]);

  return (
    <AdminLayout title="Analytics & KPIs">
      {loading ? <Skeleton className="h-96" /> : (
        <Tabs defaultValue="metrics">
          <TabsList className="flex flex-wrap h-auto">
            <TabsTrigger value="metrics">Métricas Clave</TabsTrigger>
            <TabsTrigger value="growth">Crecimiento</TabsTrigger>
            <TabsTrigger value="users">Usuarios</TabsTrigger>
            <TabsTrigger value="cars">Autos</TabsTrigger>
            <TabsTrigger value="ops">Operacional</TabsTrigger>
            <TabsTrigger value="reports">Reportes</TabsTrigger>
            <TabsTrigger value="schedule">Programación</TabsTrigger>
          </TabsList>

          <TabsContent value="metrics" className="mt-6"><MetricsTab d={data} /></TabsContent>
          <TabsContent value="growth" className="mt-6"><GrowthTab d={data} /></TabsContent>
          <TabsContent value="users" className="mt-6"><UsersTab d={data} /></TabsContent>
          <TabsContent value="cars" className="mt-6"><CarsTab d={data} /></TabsContent>
          <TabsContent value="ops" className="mt-6"><OpsTab d={data} /></TabsContent>
          <TabsContent value="reports" className="mt-6"><ReportsTab raw={{ reservations, vehicles, profiles, reviews, tickets }} d={data} /></TabsContent>
          <TabsContent value="schedule" className="mt-6"><ScheduleTab /></TabsContent>
        </Tabs>
      )}
    </AdminLayout>
  );
}

/* ============== Computations ============== */
function buildAnalytics({ reservations, vehicles, profiles, reviews, tickets, maintenance, roles }: any) {
  const now = new Date();
  const totalUsers = profiles.length;
  const ownerIds = new Set(roles.filter((r: Row) => r.role === "owner").map((r: Row) => r.user_id));
  const renterIds = new Set(roles.filter((r: Row) => r.role === "renter").map((r: Row) => r.user_id));
  const totalOwners = ownerIds.size;
  const totalRenters = renterIds.size;
  const totalCars = vehicles.length;
  const activeCars = vehicles.filter((v: Row) => v.active).length;

  // Occupancy: reserved days / available days last 30 days
  const last30 = subMonths(now, 1);
  const reservedDays = reservations
    .filter((r: Row) => ["completed", "active"].includes(r.status) && new Date(r.start_date) >= last30)
    .reduce((s: number, r: Row) => s + Math.max(differenceInDays(new Date(r.end_date), new Date(r.start_date)), 1), 0);
  const availableDays = activeCars * 30 || 1;
  const occupancy = (reservedDays / availableDays) * 100;

  const nps = reviews.length ? reviews.reduce((s: number, r: Row) => s + (r.rating || 0), 0) / reviews.length : 0;
  const conversion = totalUsers ? (renterIds.size / Math.max(totalUsers * 5, 1)) * 100 : 0; // approximation
  const cac = 12; // estimated marketing cost / new user (placeholder)

  // 12-month series
  const months = Array.from({ length: 12 }, (_, i) => startOfMonth(subMonths(now, 11 - i)));
  const monthly = months.map((m) => {
    const me = endOfMonth(m);
    const inM = (d: string) => { const x = new Date(d); return x >= m && x <= me; };
    const newUsers = profiles.filter((p: Row) => inM(p.created_at)).length;
    const newCars = vehicles.filter((v: Row) => inM(v.created_at)).length;
    const monthRes = reservations.filter((r: Row) => inM(r.created_at));
    const completedRes = monthRes.filter((r: Row) => ["completed", "active"].includes(r.status));
    const revenue = completedRes.reduce((s: number, r: Row) => s + Number(r.total_price || 0), 0);
    return {
      mes: format(m, "MMM yy", { locale: es }),
      usuarios: newUsers, autos: newCars,
      reservas: monthRes.length, revenue,
    };
  });

  // Active vs inactive owners (active = has reservation last 60 days)
  const sixtyAgo = subMonths(now, 2);
  const ownersWithRecent = new Set(
    reservations.filter((r: Row) => new Date(r.created_at) >= sixtyAgo)
      .map((r: Row) => vehicles.find((v: Row) => v.id === r.vehicle_id)?.owner_id)
      .filter(Boolean)
  );
  const activeOwners = [...ownerIds].filter((id) => ownersWithRecent.has(id)).length;
  const inactiveOwners = totalOwners - activeOwners;

  // Renters by zone
  const zoneAgg: Record<string, number> = {};
  reservations.forEach((r: Row) => {
    const v = vehicles.find((x: Row) => x.id === r.vehicle_id);
    const z = (v?.location || "N/A").split(",")[0].trim();
    zoneAgg[z] = (zoneAgg[z] || 0) + 1;
  });
  const byZone = Object.entries(zoneAgg).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 8);

  // Retention: % of renters with >1 reservation
  const renterCounts: Record<string, number> = {};
  reservations.forEach((r: Row) => { renterCounts[r.renter_id] = (renterCounts[r.renter_id] || 0) + 1; });
  const repeated = Object.values(renterCounts).filter((c) => c > 1).length;
  const retention = Object.keys(renterCounts).length ? (repeated / Object.keys(renterCounts).length) * 100 : 0;

  // High value users: top 20% by spend
  const renterSpend: Record<string, number> = {};
  reservations.forEach((r: Row) => {
    if (["completed", "active"].includes(r.status)) {
      renterSpend[r.renter_id] = (renterSpend[r.renter_id] || 0) + Number(r.total_price || 0);
    }
  });
  const sortedSpenders = Object.entries(renterSpend).sort((a, b) => b[1] - a[1]);
  const top20 = sortedSpenders.slice(0, Math.max(Math.ceil(sortedSpenders.length * 0.2), 1)).map(([id, spend]) => {
    const p = profiles.find((x: Row) => x.user_id === id);
    return { user_id: id, name: p?.full_name || "—", spend };
  });

  // Cars analysis
  const carAgg: Record<string, { count: number; revenue: number; vehicle: Row }> = {};
  vehicles.forEach((v: Row) => { carAgg[v.id] = { count: 0, revenue: 0, vehicle: v }; });
  reservations.forEach((r: Row) => {
    if (!carAgg[r.vehicle_id]) return;
    if (["completed", "active"].includes(r.status)) {
      carAgg[r.vehicle_id].count++;
      carAgg[r.vehicle_id].revenue += Number(r.total_price || 0);
    }
  });
  const carRanked = Object.values(carAgg).map(({ vehicle, count, revenue }) => ({
    name: `${vehicle.brand} ${vehicle.model}`, count, revenue, id: vehicle.id,
  }));
  const top10Cars = [...carRanked].sort((a, b) => b.count - a.count).slice(0, 10);
  const bottom10Cars = [...carRanked].sort((a, b) => a.count - b.count).slice(0, 10);
  const revenueRanking = [...carRanked].sort((a, b) => b.revenue - a.revenue).slice(0, 15);

  // Occupancy by type (using seats heuristic: <=5 sedan, >5 SUV)
  const typeAgg: Record<string, { res: number; cars: number }> = {};
  vehicles.forEach((v: Row) => {
    const t = (v.seats || 5) > 5 ? "SUV" : "Sedan";
    if (!typeAgg[t]) typeAgg[t] = { res: 0, cars: 0 };
    typeAgg[t].cars++;
  });
  reservations.forEach((r: Row) => {
    if (!["completed", "active"].includes(r.status)) return;
    const v = vehicles.find((x: Row) => x.id === r.vehicle_id);
    if (!v) return;
    const t = (v.seats || 5) > 5 ? "SUV" : "Sedan";
    if (typeAgg[t]) typeAgg[t].res++;
  });
  const occByType = Object.entries(typeAgg).map(([name, { res, cars }]) => ({ name, value: cars ? Math.round((res / cars) * 100) / 100 : 0 }));

  // Operational
  const closedTickets = tickets.filter((t: Row) => ["resolved", "closed"].includes(t.status));
  const resolutionTimes = closedTickets
    .filter((t: Row) => t.responded_at)
    .map((t: Row) => differenceInDays(new Date(t.responded_at), new Date(t.created_at)));
  const avgResolution = resolutionTimes.length ? resolutionTimes.reduce((a: number, b: number) => a + b, 0) / resolutionTimes.length : 0;
  const issueRate = reservations.length ? (tickets.length / reservations.length) * 100 : 0;
  const cancelRate = reservations.length ? (reservations.filter((r: Row) => r.status === "cancelled").length / reservations.length) * 100 : 0;
  const pendingMaint = maintenance.filter((m: Row) => m.status === "scheduled").length;
  const completedMaint = maintenance.filter((m: Row) => m.status === "completed").length;

  return {
    totalUsers, totalOwners, totalRenters, totalCars, activeCars, occupancy, nps, conversion, cac,
    monthly, activeOwners, inactiveOwners, byZone, retention, top20,
    top10Cars, bottom10Cars, revenueRanking, occByType,
    avgResolution, issueRate, cancelRate, pendingMaint, completedMaint,
    totalRevenue: monthly.reduce((s, m) => s + m.revenue, 0),
  };
}

/* ============== Tabs ============== */
function KPI({ icon: Icon, label, value, sub, color = "text-primary" }: any) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className={`text-2xl font-bold ${color}`}>{value}</p>
            {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
          </div>
          <Icon className={`h-8 w-8 ${color} opacity-30`} />
        </div>
      </CardContent>
    </Card>
  );
}

function MetricsTab({ d }: any) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
      <KPI icon={Users} label="Total Usuarios" value={num(d.totalUsers)} sub={`${d.totalOwners} dueños · ${d.totalRenters} rentadores`} />
      <KPI icon={Car} label="Autos Listados" value={num(d.totalCars)} sub={`${d.activeCars} activos`} color="text-accent" />
      <KPI icon={Target} label="% Ocupación" value={`${d.occupancy.toFixed(1)}%`} sub="Últimos 30 días" color="text-emerald-600" />
      <KPI icon={Star} label="NPS Promedio" value={d.nps.toFixed(2)} sub="Basado en reseñas" color="text-amber-600" />
      <KPI icon={TrendingUp} label="Conversión" value={`${d.conversion.toFixed(1)}%`} sub="Visitantes → rentadores (est.)" />
      <KPI icon={DollarSign} label="CAC" value={fmt(d.cac)} sub="Costo adquisición (est.)" color="text-rose-600" />
    </div>
  );
}

function GrowthTab({ d }: any) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Card>
        <CardHeader><CardTitle className="text-base">Usuarios nuevos (12 meses)</CardTitle></CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={d.monthly}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
              <XAxis dataKey="mes" /><YAxis /><Tooltip />
              <Area type="monotone" dataKey="usuarios" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.3} />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="text-base">Autos listados (12 meses)</CardTitle></CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={d.monthly}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
              <XAxis dataKey="mes" /><YAxis /><Tooltip />
              <Bar dataKey="autos" fill="hsl(var(--accent))" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="text-base">Reservas mensuales</CardTitle></CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={d.monthly}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
              <XAxis dataKey="mes" /><YAxis /><Tooltip />
              <Line type="monotone" dataKey="reservas" stroke="hsl(var(--primary))" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="text-base">Revenue (tendencia)</CardTitle></CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={d.monthly}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
              <XAxis dataKey="mes" /><YAxis /><Tooltip formatter={(v: any) => fmt(Number(v))} />
              <Area type="monotone" dataKey="revenue" stroke="#10b981" fill="#10b981" fillOpacity={0.3} />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}

function UsersTab({ d }: any) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Card>
        <CardHeader><CardTitle className="text-base">Dueños activos vs inactivos</CardTitle></CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie data={[{ name: "Activos", value: d.activeOwners }, { name: "Inactivos", value: d.inactiveOwners }]} dataKey="value" nameKey="name" outerRadius={90} label>
                <Cell fill="hsl(var(--primary))" /><Cell fill="hsl(var(--muted))" />
              </Pie>
              <Tooltip /><Legend />
            </PieChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="text-base">Rentadores por zona</CardTitle></CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={d.byZone} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
              <XAxis type="number" /><YAxis dataKey="name" type="category" width={100} /><Tooltip />
              <Bar dataKey="value" fill="hsl(var(--accent))" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="text-base">Retención mensual</CardTitle></CardHeader>
        <CardContent className="flex items-center justify-center h-[240px]">
          <div className="text-center">
            <p className="text-5xl font-bold text-primary">{d.retention.toFixed(1)}%</p>
            <p className="text-sm text-muted-foreground mt-2">de rentadores con &gt;1 reserva</p>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="text-base">Top 20% usuarios de alto valor</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow><TableHead>Usuario</TableHead><TableHead className="text-right">Gasto total</TableHead></TableRow></TableHeader>
            <TableBody>
              {d.top20.slice(0, 10).map((u: any) => (
                <TableRow key={u.user_id}>
                  <TableCell><Link to={`/admin/usuarios/${u.user_id}`} className="text-primary hover:underline">{u.name}</Link></TableCell>
                  <TableCell className="text-right font-semibold">{fmt(u.spend)}</TableCell>
                </TableRow>
              ))}
              {d.top20.length === 0 && <TableRow><TableCell colSpan={2} className="text-center text-muted-foreground py-6">Sin datos</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function CarsTab({ d }: any) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Card>
        <CardHeader><CardTitle className="text-base">Top 10 más rentados</CardTitle></CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={d.top10Cars} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
              <XAxis type="number" /><YAxis dataKey="name" type="category" width={120} /><Tooltip />
              <Bar dataKey="count" fill="hsl(var(--primary))" name="Reservas" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="text-base">Bottom 10 menos rentados</CardTitle></CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={d.bottom10Cars} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
              <XAxis type="number" /><YAxis dataKey="name" type="category" width={120} /><Tooltip />
              <Bar dataKey="count" fill="hsl(var(--destructive))" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="text-base">Ocupación por tipo</CardTitle></CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie data={d.occByType} dataKey="value" nameKey="name" outerRadius={90} label>
                {d.occByType.map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip formatter={(v: any) => `${v} reservas/auto`} /><Legend />
            </PieChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="text-base">Revenue por auto (top 15)</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow><TableHead>Auto</TableHead><TableHead className="text-right">Revenue</TableHead></TableRow></TableHeader>
            <TableBody>
              {d.revenueRanking.map((c: any) => (
                <TableRow key={c.id}>
                  <TableCell><Link to={`/admin/flota/${c.id}`} className="text-primary hover:underline text-sm">{c.name}</Link></TableCell>
                  <TableCell className="text-right font-semibold">{fmt(c.revenue)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function OpsTab({ d }: any) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <KPI icon={Clock} label="Tiempo prom. resolución" value={`${d.avgResolution.toFixed(1)} d`} sub="Tickets cerrados" color="text-amber-600" />
      <KPI icon={AlertCircle} label="Tasa de problemas" value={`${d.issueRate.toFixed(1)}%`} sub="Tickets / reservas" color="text-rose-600" />
      <KPI icon={AlertCircle} label="Cancelaciones" value={`${d.cancelRate.toFixed(1)}%`} sub="% sobre total" color="text-destructive" />
      <KPI icon={CheckCircle2} label="Mantenimiento" value={`${d.completedMaint}/${d.completedMaint + d.pendingMaint}`} sub={`${d.pendingMaint} pendientes`} color="text-emerald-600" />
    </div>
  );
}

/* ============== Reports ============== */
function ReportsTab({ raw, d }: any) {
  const [from, setFrom] = useState(format(subMonths(new Date(), 3), "yyyy-MM-dd"));
  const [to, setTo] = useState(format(new Date(), "yyyy-MM-dd"));

  const inRange = (dateStr: string) => {
    const x = new Date(dateStr);
    return x >= new Date(from) && x <= new Date(to + "T23:59:59");
  };

  const downloadCSV = (filename: string, rows: any[][]) => {
    const csv = rows.map(r => r.map(c => {
      let s = String(c ?? "");
      // Prevent CSV formula injection in spreadsheet apps (Excel/Sheets/Numbers).
      if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
      return s.includes(",") || s.includes('"') || s.includes("\n") ? `"${s.replace(/"/g, '""')}"` : s;
    }).join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  };

  const downloadPDF = (title: string, lines: string[]) => {
    const escapeHtml = (s: unknown) =>
      String(s ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
    const safeTitle = escapeHtml(title);
    const safeLines = lines.map(escapeHtml).join("\n");
    const safeDate = escapeHtml(format(new Date(), "dd/MM/yyyy HH:mm"));
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${safeTitle}</title><style>body{font-family:system-ui;padding:40px;color:#1a1a1a}h1{color:#065f46}h2{margin-top:24px;border-bottom:1px solid #ddd;padding-bottom:4px}pre{font-family:inherit;white-space:pre-wrap}</style></head><body><h1>${safeTitle}</h1><p>RuedaVe · ${safeDate}</p><pre>${safeLines}</pre><script>window.print()<\/script></body></html>`;
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const w = window.open(url, "_blank");
    if (!w) {
      const a = document.createElement("a");
      a.href = url;
      a.download = `${title.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.html`;
      a.click();
    }
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  };

  const reportFinanciero = (fmtType: string) => {
    const res = raw.reservations.filter((r: Row) => inRange(r.created_at));
    const revenue = res.filter((r: Row) => ["completed", "active"].includes(r.status)).reduce((s: number, r: Row) => s + Number(r.total_price), 0);
    const commissions = revenue * COMMISSION;
    if (fmtType === "csv") {
      const rows = [["Métrica", "Valor"], ["Período", `${from} a ${to}`], ["Reservas", res.length], ["Ingresos", revenue], ["Comisiones (20%)", commissions], ["Payouts a dueños", revenue - commissions]];
      downloadCSV(`reporte-financiero-${from}_${to}.csv`, rows);
    } else {
      downloadPDF("Reporte Financiero", [
        `Período: ${from} a ${to}`, "",
        `Reservas: ${res.length}`,
        `Ingresos: ${fmt(revenue)}`,
        `Comisiones (20%): ${fmt(commissions)}`,
        `Payouts a dueños: ${fmt(revenue - commissions)}`,
        `Proyección próximos 3 meses: ${fmt(revenue * 1.1)}`,
      ]);
    }
  };

  const reportUsuarios = () => {
    const rows = [["Tipo", "Nombre", "Cédula", "Teléfono", "Verificado", "Estado"]];
    raw.profiles.forEach((p: Row) => {
      rows.push(["—", p.full_name || "", p.cedula || "", p.phone || "", p.verified ? "Sí" : "No", p.account_status || ""]);
    });
    downloadCSV(`reporte-usuarios-${format(new Date(), "yyyyMMdd")}.csv`, rows);
  };

  const reportAutos = (fmtType: string) => {
    if (fmtType === "csv") {
      const rows = [["Marca", "Modelo", "Año", "Placa", "Ubicación", "Precio/día", "Activo"]];
      raw.vehicles.forEach((v: Row) => rows.push([v.brand, v.model, v.year, v.plate || "", v.location, v.price_per_day, v.active ? "Sí" : "No"]));
      downloadCSV(`reporte-autos-${format(new Date(), "yyyyMMdd")}.csv`, rows);
    } else {
      const lines = raw.vehicles.slice(0, 30).map((v: Row) => `${v.brand} ${v.model} ${v.year} · ${v.location} · ${fmt(Number(v.price_per_day))}/día`);
      downloadPDF("Reporte de Autos", lines);
    }
  };

  const reportReservas = (fmtType: string) => {
    const res = raw.reservations.filter((r: Row) => inRange(r.created_at));
    if (fmtType === "csv") {
      const rows = [["ID", "Fecha", "Estado", "Inicio", "Fin", "Total"]];
      res.forEach((r: Row) => rows.push([r.id.slice(0, 8), r.created_at, r.status, r.start_date, r.end_date, r.total_price]));
      downloadCSV(`reporte-reservas-${from}_${to}.csv`, rows);
    } else {
      const lines = [`Total: ${res.length}`, "", ...res.slice(0, 50).map((r: Row) => `${r.id.slice(0, 8)} · ${r.status} · ${r.start_date} → ${r.end_date} · ${fmt(Number(r.total_price))}`)];
      downloadPDF("Reporte de Reservas", lines);
    }
  };

  const reportProblemas = () => {
    const tk = raw.tickets;
    const open = tk.filter((t: Row) => ["open", "in_progress"].includes(t.status)).length;
    const closed = tk.filter((t: Row) => ["resolved", "closed"].includes(t.status)).length;
    const byCat: Record<string, number> = {};
    tk.forEach((t: Row) => { byCat[t.category] = (byCat[t.category] || 0) + 1; });
    downloadPDF("Reporte de Problemas", [
      `Total tickets: ${tk.length}`,
      `Abiertos: ${open}`,
      `Cerrados: ${closed}`,
      `Tiempo promedio resolución: ${d.avgResolution.toFixed(1)} días`, "",
      "Por categoría:",
      ...Object.entries(byCat).map(([k, v]) => `  ${k}: ${v}`),
    ]);
  };

  const reports = [
    { title: "Reporte Financiero", desc: "Ingresos, comisiones, payouts, proyecciones", icon: DollarSign, formats: ["pdf", "csv"], onClick: reportFinanciero },
    { title: "Reporte de Usuarios", desc: "Dueños y rentadores con contacto y estado", icon: Users, formats: ["csv"], onClick: () => reportUsuarios() },
    { title: "Reporte de Autos", desc: "Ficha técnica, ocupación y revenue", icon: Car, formats: ["pdf", "csv"], onClick: reportAutos },
    { title: "Reporte de Reservas", desc: "Listado detallado por período", icon: Calendar, formats: ["pdf", "csv"], onClick: reportReservas },
    { title: "Reporte de Problemas", desc: "Tickets abiertos, cerrados, tiempos", icon: AlertCircle, formats: ["pdf"], onClick: () => reportProblemas() },
  ];

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 flex flex-wrap gap-3 items-end">
          <div><Label className="text-xs">Desde</Label><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
          <div><Label className="text-xs">Hasta</Label><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {reports.map((r) => (
          <Card key={r.title}>
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <r.icon className="h-8 w-8 text-primary" />
                <div className="flex-1">
                  <p className="font-semibold">{r.title}</p>
                  <p className="text-sm text-muted-foreground">{r.desc}</p>
                  <div className="flex gap-2 mt-3">
                    {r.formats.map((f) => (
                      <Button key={f} size="sm" variant="outline" onClick={() => r.onClick(f)}>
                        <Download className="h-3 w-3 mr-1" /> {f.toUpperCase()}
                      </Button>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

/* ============== Schedule ============== */
type ScheduleItem = { id: string; type: string; freq: string; email: string; format: string };
function ScheduleTab() {
  const [items, setItems] = useState<ScheduleItem[]>(() => {
    try { return JSON.parse(localStorage.getItem("ruedave_schedules") || "[]"); } catch { return []; }
  });
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<ScheduleItem>({ id: "", type: "financial", freq: "monthly", email: "", format: "pdf" });

  const save = (next: ScheduleItem[]) => {
    setItems(next);
    localStorage.setItem("ruedave_schedules", JSON.stringify(next));
  };

  const add = () => {
    if (!draft.email) return toast({ title: "Email requerido", variant: "destructive" });
    save([...items, { ...draft, id: crypto.randomUUID() }]);
    setOpen(false); setDraft({ id: "", type: "financial", freq: "monthly", email: "", format: "pdf" });
    toast({ title: "Programación creada" });
  };

  const remove = (id: string) => save(items.filter((i) => i.id !== id));

  const typeLabels: Record<string, string> = {
    financial: "Reporte financiero", payouts: "Payout a dueños", performance: "Métricas de performance",
  };
  const freqLabels: Record<string, string> = { weekly: "Semanal", monthly: "Mensual" };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">Programa el envío automático de reportes por email.</p>
        <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-2" />Nueva programación</Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Reporte</TableHead><TableHead>Frecuencia</TableHead>
                <TableHead>Email</TableHead><TableHead>Formato</TableHead><TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Sin programaciones activas</TableCell></TableRow>}
              {items.map((i) => (
                <TableRow key={i.id}>
                  <TableCell>{typeLabels[i.type]}</TableCell>
                  <TableCell><Badge variant="outline">{freqLabels[i.freq]}</Badge></TableCell>
                  <TableCell className="text-sm"><Mail className="inline h-3 w-3 mr-1" />{i.email}</TableCell>
                  <TableCell><Badge>{i.format.toUpperCase()}</Badge></TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="ghost" onClick={() => remove(i.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nueva programación de reporte</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Tipo de reporte</Label>
              <Select value={draft.type} onValueChange={(v) => setDraft({ ...draft, type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="financial">Reporte financiero</SelectItem>
                  <SelectItem value="payouts">Payout a dueños</SelectItem>
                  <SelectItem value="performance">Métricas de performance</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Frecuencia</Label>
              <Select value={draft.freq} onValueChange={(v) => setDraft({ ...draft, freq: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="weekly">Semanal</SelectItem>
                  <SelectItem value="monthly">Mensual</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Email destinatario</Label>
              <Input type="email" placeholder="finanzas@ruedave.com" value={draft.email} onChange={(e) => setDraft({ ...draft, email: e.target.value })} />
            </div>
            <div>
              <Label>Formato</Label>
              <Select value={draft.format} onValueChange={(v) => setDraft({ ...draft, format: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pdf">PDF</SelectItem>
                  <SelectItem value="excel">Excel</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={add}>Crear</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
