import { useEffect, useMemo, useState } from "react";
import { toCSV } from "@/lib/csv";
import { format, subMonths, startOfMonth, endOfMonth, addMonths, differenceInDays } from "date-fns";
import { es } from "date-fns/locale";
import {
  ResponsiveContainer,
  LineChart, Line,
  BarChart, Bar,
  PieChart, Pie, Cell,
  AreaChart, Area,
  XAxis, YAxis, Tooltip, CartesianGrid, Legend,
} from "recharts";
import {
  DollarSign, TrendingUp, AlertTriangle, Download, Bell, RefreshCw,
  CheckCircle2, Clock, XCircle, Search, FileText, MessageSquare, Send, Upload, ImageIcon,
} from "lucide-react";
import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Link } from "react-router-dom";
import PayoutMethodsTab from "@/components/admin/PayoutMethodsTab";
import { loadSystemSettings, INSURANCE_PER_DAY } from "@/lib/systemSettings";

const getCommissionRate = () =>
  Number(loadSystemSettings().policies.commission_pct ?? 20) / 100;
const COLORS = ["hsl(var(--primary))", "hsl(var(--accent))", "hsl(var(--secondary))", "hsl(var(--muted))", "#f59e0b", "#10b981", "#6366f1", "#ec4899"];
const fmt = (n: number) => `$${Number(n || 0).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
const txId = (id: string) => `RV-TX-${id.slice(0, 6).toUpperCase()}`;

type Payment = {
  id: string; reservation_id: string; amount: number; payment_method: string;
  status: string; created_at: string;
};
type Reservation = {
  id: string; vehicle_id: string; renter_id: string; total_price: number;
  start_date: string; end_date: string; status: string; created_at: string;
};
type Vehicle = { id: string; brand: string; model: string; owner_id: string; location: string };
type Profile = { user_id: string; full_name: string | null; phone: string | null };

export default function AdminFinancePage() {
  const [loading, setLoading] = useState(true);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);

  const load = async () => {
    setLoading(true);
    const [p, r, v, pr] = await Promise.all([
      supabase.from("payments").select("*").order("created_at", { ascending: false }).limit(2000),
      supabase.from("reservations").select("*").order("created_at", { ascending: false }).limit(2000),
      supabase.from("vehicles").select("id,brand,model,owner_id,location").limit(2000),
      supabase.from("profiles").select("user_id,full_name,phone").limit(5000),
    ]);
    setPayments((p.data as any) || []);
    setReservations((r.data as any) || []);
    setVehicles((v.data as any) || []);
    setProfiles((pr.data as any) || []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const vMap = useMemo(() => Object.fromEntries(vehicles.map((v) => [v.id, v])), [vehicles]);
  const pMap = useMemo(() => Object.fromEntries(profiles.map((p) => [p.user_id, p])), [profiles]);
  const rMap = useMemo(() => Object.fromEntries(reservations.map((r) => [r.id, r])), [reservations]);

  return (
    <AdminLayout title="Finanzas & Pagos">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">Dashboard financiero, transacciones y payouts.</p>
          <Button variant="outline" size="sm" onClick={load}>
            <RefreshCw className="h-4 w-4 mr-2" /> Actualizar
          </Button>
        </div>

        <Tabs defaultValue="payments">
          <TabsList>
            <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
            <TabsTrigger value="payments">Pagos de Rentadores</TabsTrigger>
            <TabsTrigger value="payouts">Payouts a Dueños</TabsTrigger>
            <TabsTrigger value="methods">Métodos de Pago</TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard" className="mt-6">
            <DashboardTab loading={loading} payments={payments} reservations={reservations} vehicles={vehicles} vMap={vMap} pMap={pMap} />
          </TabsContent>
          <TabsContent value="payments" className="mt-6">
            <PaymentsTab loading={loading} payments={payments} reservations={reservations} rMap={rMap} vMap={vMap} pMap={pMap} reload={load} />
          </TabsContent>
          <TabsContent value="payouts" className="mt-6">
            <PayoutsTab loading={loading} reservations={reservations} payments={payments} vMap={vMap} pMap={pMap} />
          </TabsContent>
          <TabsContent value="methods" className="mt-6">
            <PayoutMethodsTab />
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
}

/* ---------------- Dashboard ---------------- */
function DashboardTab({ loading, payments, reservations, vehicles, vMap, pMap }: any) {
  const data = useMemo(() => {
    const now = new Date();
    // 6 months series
    const months = Array.from({ length: 6 }, (_, i) => startOfMonth(subMonths(now, 5 - i)));
    const series = months.map((m) => {
      const monthEnd = endOfMonth(m);
      const inMonth = (d: string) => { const x = new Date(d); return x >= m && x <= monthEnd; };
      const monthRes = reservations.filter((r: Reservation) => inMonth(r.created_at) && ["completed", "active"].includes(r.status));
      const ingresos = monthRes.reduce((s: number, r: Reservation) => s + Number(r.total_price || 0), 0);
      const gastos = monthRes.reduce((s: number, r: Reservation) => {
        const days = Math.max(differenceInDays(new Date(r.end_date), new Date(r.start_date)), 1);
        return s + days * INSURANCE_PER_DAY; // insurance per day (config)
      }, 0);
      const commissionRate = getCommissionRate();
      const comision = ingresos * commissionRate;
      return { mes: format(m, "MMM yy", { locale: es }), ingresos, gastos, comision, neto: ingresos - gastos };
    });

    // 3 month projection (avg of last 3)
    const last3 = series.slice(-3);
    const avgIng = last3.reduce((s, x) => s + x.ingresos, 0) / 3 || 0;
    const projection = Array.from({ length: 3 }, (_, i) => ({
      mes: format(addMonths(now, i + 1), "MMM yy", { locale: es }),
      proyeccion: Math.round(avgIng * (1 + 0.05 * (i + 1))),
    }));

    // Composition by zone
    const zoneAgg: Record<string, number> = {};
    reservations.forEach((r: Reservation) => {
      if (!["completed", "active"].includes(r.status)) return;
      const v = vMap[r.vehicle_id];
      const zone = (v?.location || "N/A").split(",")[0].trim() || "N/A";
      zoneAgg[zone] = (zoneAgg[zone] || 0) + Number(r.total_price || 0);
    });
    const byZone = Object.entries(zoneAgg).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 6);

    // Composition by car (brand)
    const brandAgg: Record<string, number> = {};
    reservations.forEach((r: Reservation) => {
      if (!["completed", "active"].includes(r.status)) return;
      const v = vMap[r.vehicle_id];
      const k = v?.brand || "N/A";
      brandAgg[k] = (brandAgg[k] || 0) + Number(r.total_price || 0);
    });
    const byBrand = Object.entries(brandAgg).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 6);

    // Totals
    const totalRev = series.reduce((s, x) => s + x.ingresos, 0);
    const totalCom = series.reduce((s, x) => s + x.comision, 0);
    const totalGastos = series.reduce((s, x) => s + x.gastos, 0);

    // Alerts
    const sevenDaysAgo = new Date(); sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const pendingRenters = payments.filter((p: Payment) => p.status === "pending" && new Date(p.created_at) < sevenDaysAgo);
    const rejectedTx = payments.filter((p: Payment) => p.status === "failed");
    // discrepancies: reservations completed/active without any payment row
    const paymentsByRes = new Set(payments.map((p: Payment) => p.reservation_id));
    const discrepancies = reservations.filter((r: Reservation) => ["completed", "active"].includes(r.status) && !paymentsByRes.has(r.id));
    // owners with pending payouts: completed reservations with no "completed" payment
    const completedRes = reservations.filter((r: Reservation) => r.status === "completed");
    const ownerPending: Record<string, number> = {};
    completedRes.forEach((r: Reservation) => {
      const hasPaid = payments.some((p: Payment) => p.reservation_id === r.id && p.status === "completed");
      if (!hasPaid) {
        const owner = vMap[r.vehicle_id]?.owner_id;
        if (owner) ownerPending[owner] = (ownerPending[owner] || 0) + Number(r.total_price || 0) * (1 - getCommissionRate());
      }
    });

    return { series, projection, byZone, byBrand, totalRev, totalCom, totalGastos, pendingRenters, rejectedTx, discrepancies, ownerPending };
  }, [payments, reservations, vMap]);

  if (loading) return <Skeleton className="h-96" />;

  const kpis = [
    { label: "Ingresos (6m)", value: fmt(data.totalRev), icon: DollarSign, color: "text-emerald-600" },
    { label: "Comisión RUEDAVE", value: fmt(data.totalCom), icon: TrendingUp, color: "text-primary" },
    { label: "Gastos op. (seguro)", value: fmt(data.totalGastos), icon: DollarSign, color: "text-amber-600" },
    { label: "% Comisión", value: data.totalRev ? `${((data.totalCom / data.totalRev) * 100).toFixed(1)}%` : "0%", icon: TrendingUp, color: "text-accent" },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {kpis.map((k) => (
          <Card key={k.label}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">{k.label}</p>
                  <p className={`text-2xl font-bold ${k.color}`}>{k.value}</p>
                </div>
                <k.icon className={`h-8 w-8 ${k.color} opacity-30`} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle className="text-base">Ingresos vs Gastos (6 meses)</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={data.series}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis dataKey="mes" /><YAxis /><Tooltip /><Legend />
                <Bar dataKey="ingresos" fill="hsl(var(--primary))" name="Ingresos" />
                <Bar dataKey="gastos" fill="hsl(var(--destructive))" name="Gastos" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Comisión capturada</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={data.series}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis dataKey="mes" /><YAxis /><Tooltip />
                <Area type="monotone" dataKey="comision" stroke="hsl(var(--accent))" fill="hsl(var(--accent))" fillOpacity={0.3} name="Comisión" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Composición por zona</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={data.byZone} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label>
                  {data.byZone.map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(v: any) => fmt(Number(v))} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Composición por marca</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={data.byBrand} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label>
                  {data.byBrand.map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(v: any) => fmt(Number(v))} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader><CardTitle className="text-base">Proyección de flujo (próximos 3 meses)</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={[...data.series.map((s: any) => ({ mes: s.mes, valor: s.ingresos, tipo: "Real" })), ...data.projection.map((p: any) => ({ mes: p.mes, valor: p.proyeccion, tipo: "Proyección" }))]}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis dataKey="mes" /><YAxis /><Tooltip formatter={(v: any) => fmt(Number(v))} />
                <Line type="monotone" dataKey="valor" stroke="hsl(var(--primary))" strokeWidth={2} dot />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-600" /> Alertas Financieras
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <AlertCard title="Pagos pendientes (>7d)" count={data.pendingRenters.length} variant="warning" />
            <AlertCard title="Dueños con payouts pend." count={Object.keys(data.ownerPending).length} variant="info" />
            <AlertCard title="Transacciones rechazadas" count={data.rejectedTx.length} variant="destructive" />
            <AlertCard title="Reservas sin pago" count={data.discrepancies.length} variant="destructive" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function AlertCard({ title, count, variant }: { title: string; count: number; variant: "warning" | "info" | "destructive" }) {
  const cls = variant === "warning" ? "border-amber-500/30 bg-amber-500/5"
    : variant === "destructive" ? "border-destructive/30 bg-destructive/5"
    : "border-primary/30 bg-primary/5";
  return (
    <div className={`p-4 rounded-lg border ${cls}`}>
      <p className="text-xs text-muted-foreground">{title}</p>
      <p className="text-3xl font-bold mt-1">{count}</p>
    </div>
  );
}

/* ---------------- Pagos de Rentadores ---------------- */
function PaymentsTab({ loading, payments, reservations, rMap, vMap, pMap, reload }: any) {
  const [search, setSearch] = useState("");
  const [statusF, setStatusF] = useState("all");
  const [methodF, setMethodF] = useState("all");
  const [minAmt, setMinAmt] = useState("");
  const [maxAmt, setMaxAmt] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [refundOpen, setRefundOpen] = useState<Payment | null>(null);
  const [markPaidOpen, setMarkPaidOpen] = useState<Payment | null>(null);

  const filtered = useMemo(() => {
    return payments.filter((p: Payment) => {
      if (statusF !== "all" && p.status !== statusF) return false;
      if (methodF !== "all" && p.payment_method !== methodF) return false;
      if (minAmt && Number(p.amount) < Number(minAmt)) return false;
      if (maxAmt && Number(p.amount) > Number(maxAmt)) return false;
      if (fromDate && new Date(p.created_at) < new Date(fromDate)) return false;
      if (toDate && new Date(p.created_at) > new Date(toDate + "T23:59:59")) return false;
      if (search) {
        const r = rMap[p.reservation_id];
        const renter = r ? pMap[r.renter_id]?.full_name || "" : "";
        const hay = `${txId(p.id)} ${renter} ${p.payment_method}`.toLowerCase();
        if (!hay.includes(search.toLowerCase())) return false;
      }
      return true;
    });
  }, [payments, search, statusF, methodF, minAmt, maxAmt, fromDate, toDate, rMap, pMap]);

  const markPaid = async () => {
    if (!markPaidOpen) return;
    const { error } = await supabase.from("payments").update({ status: "completed" }).eq("id", markPaidOpen.id);
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else { toast({ title: "Marcado como pagado" }); reload(); }
    setMarkPaidOpen(null);
  };

  const refund = async () => {
    if (!refundOpen) return;
    const { error } = await supabase.from("payments").update({ status: "refunded" }).eq("id", refundOpen.id);
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else { toast({ title: "Reembolso procesado" }); reload(); }
    setRefundOpen(null);
  };

  const sendReminder = async (p: Payment) => {
    const r = rMap[p.reservation_id];
    if (!r) return;
    await supabase.from("notifications").insert({
      user_id: r.renter_id,
      type: "payment_reminder",
      title: "Recordatorio de pago",
      message: `Tienes un pago pendiente de ${fmt(Number(p.amount))} para tu reserva.`,
      reservation_id: r.id,
      action_url: "/mis-reservas",
    });
    toast({ title: "Recordatorio enviado" });
  };

  const downloadReceipt = (p: Payment) => {
    const r = rMap[p.reservation_id];
    const renter = r ? pMap[r.renter_id]?.full_name || "" : "";
    const v = r ? vMap[r.vehicle_id] : null;
    const txt = `RUEDAVE - RECIBO DE PAGO\n\nID: ${txId(p.id)}\nFecha: ${format(new Date(p.created_at), "dd/MM/yyyy HH:mm")}\nRentador: ${renter}\nVehículo: ${v ? `${v.brand} ${v.model}` : "-"}\nMonto: ${fmt(Number(p.amount))}\nMétodo: ${p.payment_method}\nEstado: ${p.status}\n`;
    const blob = new Blob([txt], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `recibo-${txId(p.id)}.txt`; a.click();
    URL.revokeObjectURL(url);
  };

  const pendingVerification = useMemo(() => {
    const paidResIds = new Set(
      payments.filter((p: Payment) => p.status === "completed").map((p: Payment) => p.reservation_id)
    );
    const latestPaymentByRes: Record<string, Payment> = {};
    payments.forEach((p: Payment) => {
      const cur = latestPaymentByRes[p.reservation_id];
      if (!cur || new Date(p.created_at) > new Date(cur.created_at)) {
        latestPaymentByRes[p.reservation_id] = p;
      }
    });
    return (reservations as Reservation[])
      .filter((r) => ["awaiting_payment", "approved"].includes(r.status) && !paidResIds.has(r.id))
      .map((r) => ({ reservation: r, payment: latestPaymentByRes[r.id] || null }))
      .sort((a, b) => new Date(b.reservation.created_at).getTime() - new Date(a.reservation.created_at).getTime());
  }, [payments, reservations]);

  return (
    <div className="space-y-4">
      {pendingVerification.length > 0 && (
        <Card className="border-amber-500/40 bg-amber-500/5">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              Pendientes de verificación ({pendingVerification.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Reserva</TableHead>
                  <TableHead>Rentador</TableHead>
                  <TableHead>Monto</TableHead>
                  <TableHead>Estado reserva</TableHead>
                  <TableHead>Comprobante</TableHead>
                  <TableHead>Vence pago</TableHead>
                  <TableHead className="text-right">Acción</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingVerification.map(({ reservation: r, payment: p }) => {
                  const renter = pMap[r.renter_id];
                  return (
                    <TableRow key={r.id}>
                      <TableCell>
                        <Link to={`/admin/reservas/${r.id}`} className="text-primary hover:underline text-xs font-mono">
                          {r.id.slice(0, 8)}
                        </Link>
                      </TableCell>
                      <TableCell className="text-sm">{renter?.full_name || "—"}</TableCell>
                      <TableCell className="font-semibold">{fmt(Number(r.total_price))}</TableCell>
                      <TableCell><Badge variant="outline" className="capitalize text-xs">{r.status}</Badge></TableCell>
                      <TableCell>
                        {p ? <PaymentStatusBadge status={p.status} /> : <span className="text-xs text-muted-foreground">Sin enviar</span>}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {(r as any).payment_deadline ? format(new Date((r as any).payment_deadline), "dd/MM HH:mm") : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button asChild size="sm" variant="outline">
                          <Link to={`/admin/reservas/${r.id}`}>Verificar</Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Buscar..." className="pl-8" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <Select value={statusF} onValueChange={setStatusF}>
              <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los estados</SelectItem>
                <SelectItem value="submitted">En revisión</SelectItem>
                <SelectItem value="completed">Pagado</SelectItem>
                <SelectItem value="pending">Pendiente</SelectItem>
                <SelectItem value="failed">Rechazado</SelectItem>
                <SelectItem value="refunded">Reembolsado</SelectItem>
              </SelectContent>
            </Select>
            <Select value={methodF} onValueChange={setMethodF}>
              <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los métodos</SelectItem>
                <SelectItem value="card">Tarjeta</SelectItem>
                <SelectItem value="transfer">Transferencia</SelectItem>
                <SelectItem value="cash">Efectivo</SelectItem>
              </SelectContent>
            </Select>
            <Input type="date" className="w-[150px]" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
            <Input type="date" className="w-[150px]" value={toDate} onChange={(e) => setToDate(e.target.value)} />
            <Input type="number" placeholder="Min $" className="w-[100px]" value={minAmt} onChange={(e) => setMinAmt(e.target.value)} />
            <Input type="number" placeholder="Max $" className="w-[100px]" value={maxAmt} onChange={(e) => setMaxAmt(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {loading ? <Skeleton className="h-64 m-4" /> : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Reserva</TableHead>
                  <TableHead>Rentador</TableHead>
                  <TableHead>Monto</TableHead>
                  <TableHead>Método</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 && (
                  <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">Sin transacciones</TableCell></TableRow>
                )}
                {filtered.map((p: Payment) => {
                  const r = rMap[p.reservation_id];
                  const renter = r ? pMap[r.renter_id] : null;
                  return (
                    <TableRow key={p.id}>
                      <TableCell className="font-mono text-xs">{txId(p.id)}</TableCell>
                      <TableCell>
                        {r ? <Link to={`/admin/reservas/${r.id}`} className="text-primary hover:underline text-xs">{r.id.slice(0, 8)}</Link> : "-"}
                      </TableCell>
                      <TableCell className="text-sm">{renter?.full_name || "-"}</TableCell>
                      <TableCell className="font-semibold">{fmt(Number(p.amount))}</TableCell>
                      <TableCell><Badge variant="outline" className="capitalize">{p.payment_method}</Badge></TableCell>
                      <TableCell><PaymentStatusBadge status={p.status} /></TableCell>
                      <TableCell className="text-xs text-muted-foreground">{format(new Date(p.created_at), "dd/MM/yy")}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          {p.status === "pending" && (
                            <>
                              <Button size="sm" variant="ghost" title="Marcar pagado" onClick={() => setMarkPaidOpen(p)}>
                                <CheckCircle2 className="h-4 w-4" />
                              </Button>
                              <Button size="sm" variant="ghost" title="Recordatorio" onClick={() => sendReminder(p)}>
                                <Bell className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                          {p.status === "completed" && (
                            <Button size="sm" variant="ghost" title="Reembolsar" onClick={() => setRefundOpen(p)}>
                              <RefreshCw className="h-4 w-4" />
                            </Button>
                          )}
                          <Button size="sm" variant="ghost" title="Descargar recibo" onClick={() => downloadReceipt(p)}>
                            <Download className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={!!markPaidOpen} onOpenChange={(o) => !o && setMarkPaidOpen(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Marcar como pagado?</AlertDialogTitle>
            <AlertDialogDescription>Esto registrará el pago manualmente (ej. efectivo recibido).</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={markPaid}>Confirmar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!refundOpen} onOpenChange={(o) => !o && setRefundOpen(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Procesar reembolso?</AlertDialogTitle>
            <AlertDialogDescription>
              Se reembolsará {refundOpen && fmt(Number(refundOpen.amount))} al rentador.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={refund}>Reembolsar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function PaymentStatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string; icon: any }> = {
    completed: { label: "Pagado", cls: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30", icon: CheckCircle2 },
    submitted: { label: "En revisión", cls: "bg-blue-500/15 text-blue-700 border-blue-500/30", icon: Clock },
    pending: { label: "Pendiente", cls: "bg-amber-500/15 text-amber-700 border-amber-500/30", icon: Clock },
    failed: { label: "Rechazado", cls: "bg-destructive/15 text-destructive border-destructive/30", icon: XCircle },
    refunded: { label: "Reembolsado", cls: "bg-blue-500/15 text-blue-700 border-blue-500/30", icon: RefreshCw },
  };
  const m = map[status] || { label: status, cls: "", icon: Clock };
  const Icon = m.icon;
  return <Badge variant="outline" className={m.cls}><Icon className="h-3 w-3 mr-1" />{m.label}</Badge>;
}

/* ---------------- Payouts a Dueños ---------------- */
function PayoutsTab({ loading, reservations, payments, vMap, pMap }: any) {
  const [period, setPeriod] = useState(format(startOfMonth(new Date()), "yyyy-MM"));
  const [statusF, setStatusF] = useState("all");
  const [minAmt, setMinAmt] = useState("");
  const [maxAmt, setMaxAmt] = useState("");
  const [contactOwner, setContactOwner] = useState<string | null>(null);
  const [proofPayout, setProofPayout] = useState<any | null>(null);
  const [savedPayouts, setSavedPayouts] = useState<any[]>([]);
  const [proofUrls, setProofUrls] = useState<Record<string, string>>({});

  const loadSaved = async () => {
    const { data } = await supabase.from("owner_payouts").select("*").eq("period", period);
    setSavedPayouts(data || []);
    // sign proof URLs
    const map: Record<string, string> = {};
    await Promise.all(
      (data || [])
        .filter((p: any) => p.proof_url)
        .map(async (p: any) => {
          const { data: signed } = await supabase.storage
            .from("payout-proofs")
            .createSignedUrl(p.proof_url, 60 * 60);
          if (signed?.signedUrl) map[p.id] = signed.signedUrl;
        })
    );
    setProofUrls(map);
  };

  useEffect(() => { loadSaved(); }, [period]);

  const periodOptions = useMemo(() => {
    return Array.from({ length: 6 }, (_, i) => {
      const d = subMonths(new Date(), i);
      return { value: format(d, "yyyy-MM"), label: format(d, "MMMM yyyy", { locale: es }) };
    });
  }, []);

  const savedByOwner = useMemo(
    () => Object.fromEntries(savedPayouts.map((p) => [p.owner_id, p])),
    [savedPayouts]
  );

  const payouts = useMemo(() => {
    const [y, m] = period.split("-").map(Number);
    const start = new Date(y, m - 1, 1);
    const end = endOfMonth(start);
    const inPeriod = (d: string) => { const x = new Date(d); return x >= start && x <= end; };

    const byOwner: Record<string, any> = {};
    reservations.forEach((r: Reservation) => {
      if (!inPeriod(r.created_at)) return;
      if (!["completed", "active"].includes(r.status)) return;
      const v = vMap[r.vehicle_id];
      if (!v?.owner_id) return;
      if (!byOwner[v.owner_id]) {
        byOwner[v.owner_id] = { owner_id: v.owner_id, count: 0, gross: 0, refunds: 0 };
      }
      byOwner[v.owner_id].count++;
      byOwner[v.owner_id].gross += Number(r.total_price || 0);
      const refunded = payments.filter((p: Payment) => p.reservation_id === r.id && p.status === "refunded")
        .reduce((s: number, p: Payment) => s + Number(p.amount), 0);
      byOwner[v.owner_id].refunds += refunded;
    });
    const rows: any[] = [];
    Object.values(byOwner).forEach((row: any) => {
      const commission = row.gross * getCommissionRate();
      const net = row.gross - commission - row.refunds;
      const owner = pMap[row.owner_id];
      const saved = savedByOwner[row.owner_id];
      const ownerBase = {
        owner_id: row.owner_id,
        owner_name: owner?.full_name || "—",
        owner_phone: owner?.phone || "",
      };

      if (saved && saved.status === "paid") {
        // Show the already-paid payout with its stored amounts
        rows.push({
          ...ownerBase,
          key: `${row.owner_id}-paid`,
          count: row.count,
          gross: Number(saved.gross || 0),
          commission: Number(saved.commission || 0),
          refunds: Number(saved.refunds || 0),
          net: Number(saved.net || 0),
          status: "paid",
          saved,
          pay_date: saved.paid_at ? format(new Date(saved.paid_at), "dd/MM/yyyy") : "—",
        });
        // If new reservations arrived after the payout, add a pending delta row
        const deltaGross = row.gross - Number(saved.gross || 0);
        const deltaRefunds = row.refunds - Number(saved.refunds || 0);
        if (deltaGross > 0.009 || deltaRefunds > 0.009) {
          const dCommission = Math.max(0, deltaGross) * getCommissionRate();
          const dNet = deltaGross - dCommission - Math.max(0, deltaRefunds);
          rows.push({
            ...ownerBase,
            key: `${row.owner_id}-pending`,
            count: row.count,
            gross: Math.max(0, deltaGross),
            commission: dCommission,
            refunds: Math.max(0, deltaRefunds),
            net: dNet,
            status: "pending",
            saved: null,
            pay_date: format(new Date(y, m, 5), "dd/MM/yyyy"),
          });
        }
      } else {
        rows.push({
          ...ownerBase,
          key: `${row.owner_id}-${saved?.status || "pending"}`,
          count: row.count,
          gross: row.gross,
          commission,
          refunds: row.refunds,
          net,
          status: saved?.status || "pending",
          saved,
          pay_date: saved?.paid_at
            ? format(new Date(saved.paid_at), "dd/MM/yyyy")
            : format(new Date(y, m, 5), "dd/MM/yyyy"),
        });
      }
    });
    return rows.filter((row: any) => {
      if (statusF !== "all" && row.status !== statusF) return false;
      if (minAmt && row.net < Number(minAmt)) return false;
      if (maxAmt && row.net > Number(maxAmt)) return false;
      return true;
    }).sort((a: any, b: any) => b.net - a.net);
  }, [period, reservations, payments, vMap, pMap, statusF, minAmt, maxAmt, savedByOwner]);

  const totalNet = payouts.reduce((s: number, r: any) => s + (r.status === "paid" ? 0 : r.net), 0);
  const totalPaid = payouts.reduce((s: number, r: any) => s + (r.status === "paid" ? r.net : 0), 0);

  const downloadReport = () => {
    const rows = [
      ["Dueño", "Período", "Alquileres", "Bruto", "Comisión", "Devoluciones", "Neto", "Estado"],
      ...payouts.map((r: any) => [r.owner_name, period, r.count, r.gross, r.commission, r.refunds, r.net, r.status]),
    ];
    const csv = toCSV(rows);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `payouts-${period}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const downloadProof = (r: any) => {
    const pct = (getCommissionRate() * 100).toFixed(0);
    const txt = `RUEDAVE - COMPROBANTE DE PAYOUT\n\nDueño: ${r.owner_name}\nPeríodo: ${period}\nAlquileres: ${r.count}\nIngresos brutos: ${fmt(r.gross)}\nComisión RUEDAVE (${pct}%): -${fmt(r.commission)}\nDevoluciones: -${fmt(r.refunds)}\nMonto neto: ${fmt(r.net)}\nFecha de pago: ${r.pay_date}\n`;
    const blob = new Blob([txt], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `payout-${r.owner_name}-${period}.txt`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-3 items-center">
            <Select value={period} onValueChange={setPeriod}>
              <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {periodOptions.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={statusF} onValueChange={setStatusF}>
              <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="paid">Pagado</SelectItem>
                <SelectItem value="pending">Pendiente</SelectItem>
              </SelectContent>
            </Select>
            <Input type="number" placeholder="Min $" className="w-[100px]" value={minAmt} onChange={(e) => setMinAmt(e.target.value)} />
            <Input type="number" placeholder="Max $" className="w-[100px]" value={maxAmt} onChange={(e) => setMaxAmt(e.target.value)} />
            <div className="ml-auto flex items-center gap-3">
              <span className="text-sm text-muted-foreground">Pagado: <span className="font-semibold text-emerald-700">{fmt(totalPaid)}</span></span>
              <span className="text-sm text-muted-foreground">Pendiente: <span className="font-bold text-foreground">{fmt(totalNet)}</span></span>
              <Button variant="outline" size="sm" onClick={downloadReport}>
                <FileText className="h-4 w-4 mr-2" /> Reporte contable
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {loading ? <Skeleton className="h-64 m-4" /> : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Dueño</TableHead>
                  <TableHead>Período</TableHead>
                  <TableHead className="text-right"># Alq.</TableHead>
                  <TableHead className="text-right">Bruto</TableHead>
                  <TableHead className="text-right">Comisión</TableHead>
                  <TableHead className="text-right">Devol.</TableHead>
                  <TableHead className="text-right">Neto</TableHead>
                  <TableHead>Método</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Comprobante</TableHead>
                  <TableHead>Fecha pago</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payouts.length === 0 && (
                  <TableRow><TableCell colSpan={12} className="text-center text-muted-foreground py-8">Sin payouts en este período</TableCell></TableRow>
                )}
                {payouts.map((r: any) => {
                  const proofUrl = r.saved?.id ? proofUrls[r.saved.id] : null;
                  return (
                    <TableRow key={r.key || r.owner_id}>
                      <TableCell>
                        <Link to={`/admin/usuarios/${r.owner_id}`} className="text-primary hover:underline text-sm font-medium">{r.owner_name}</Link>
                      </TableCell>
                      <TableCell className="text-xs">{period}</TableCell>
                      <TableCell className="text-right">{r.count}</TableCell>
                      <TableCell className="text-right">{fmt(r.gross)}</TableCell>
                      <TableCell className="text-right text-destructive">-{fmt(r.commission)}</TableCell>
                      <TableCell className="text-right text-destructive">-{fmt(r.refunds)}</TableCell>
                      <TableCell className="text-right font-semibold">{fmt(r.net)}</TableCell>
                      <TableCell><Badge variant="outline" className="text-xs">Transferencia</Badge></TableCell>
                      <TableCell><PayoutStatusBadge status={r.status} /></TableCell>
                      <TableCell>
                        {proofUrl ? (
                          <a href={proofUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                            <ImageIcon className="h-3 w-3" /> Ver
                          </a>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{r.pay_date}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button size="sm" variant={r.status === "paid" ? "ghost" : "default"} title={r.status === "paid" ? "Actualizar comprobante" : "Enviar comprobante y marcar pagado"} onClick={() => setProofPayout(r)}>
                            <Upload className="h-4 w-4" />
                          </Button>
                          <Button size="sm" variant="ghost" title="Recibo" onClick={() => downloadProof(r)}>
                            <Download className="h-4 w-4" />
                          </Button>
                          <Button size="sm" variant="ghost" title="Contactar" onClick={() => setContactOwner(r.owner_id)}>
                            <MessageSquare className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <ContactOwnerDialog ownerId={contactOwner} onClose={() => setContactOwner(null)} pMap={pMap} />
      <SendProofDialog
        payout={proofPayout}
        period={period}
        onClose={() => setProofPayout(null)}
        onSaved={() => { setProofPayout(null); loadSaved(); }}
      />
    </div>
  );
}

function SendProofDialog({ payout, period, onClose, onSaved }: { payout: any | null; period: string; onClose: () => void; onSaved: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (payout) { setFile(null); setNotes(payout.saved?.notes || ""); }
  }, [payout]);

  const submit = async () => {
    if (!payout) return;
    setBusy(true);
    try {
      let proofPath: string | null = payout.saved?.proof_url ?? null;
      if (file) {
        const ext = file.name.split(".").pop() || "bin";
        proofPath = `${payout.owner_id}/${period}-${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("payout-proofs")
          .upload(proofPath, file, { upsert: true, contentType: file.type });
        if (upErr) throw upErr;
      }
      if (!proofPath) {
        toast({ title: "Adjunta el comprobante", variant: "destructive" });
        setBusy(false);
        return;
      }

      const { data: userData } = await supabase.auth.getUser();
      const payload = {
        owner_id: payout.owner_id,
        period,
        gross: payout.gross,
        commission: payout.commission,
        refunds: payout.refunds,
        net: payout.net,
        status: "paid",
        proof_url: proofPath,
        paid_at: new Date().toISOString(),
        paid_by: userData.user?.id ?? null,
        notes: notes || null,
      };
      const { error: upsertErr } = await supabase
        .from("owner_payouts")
        .upsert(payload, { onConflict: "owner_id,period" });
      if (upsertErr) throw upsertErr;

      // Notify owner
      await supabase.from("notifications").insert({
        user_id: payout.owner_id,
        type: "payout_paid",
        title: `Payout ${period} realizado`,
        message: `Se realizó el pago de ${fmt(payout.net)} correspondiente al período ${period}. Revisa el comprobante en tu panel.`,
      });

      toast({ title: "Comprobante enviado", description: "El payout quedó marcado como pagado." });
      onSaved();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={!!payout} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Enviar comprobante de transferencia</DialogTitle>
          <DialogDescription>
            {payout ? `${payout.owner_name} · ${period} · Neto ${fmt(payout.net)}` : ""}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Comprobante (imagen o PDF)</Label>
            <Input
              type="file"
              accept="image/*,application/pdf"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
            />
            {payout?.saved?.proof_url && !file && (
              <p className="text-xs text-muted-foreground mt-1">Ya hay un comprobante cargado; sube uno nuevo para reemplazarlo.</p>
            )}
          </div>
          <div>
            <Label>Notas (opcional)</Label>
            <Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Ref. de la transferencia, banco, etc." />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>Cancelar</Button>
          <Button onClick={submit} disabled={busy}>
            {busy ? "Enviando..." : (<><CheckCircle2 className="h-4 w-4 mr-2" />Marcar pagado</>)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


function PayoutStatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    paid: { label: "Pagado", cls: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30" },
    processing: { label: "En proceso", cls: "bg-amber-500/15 text-amber-700 border-amber-500/30" },
    pending: { label: "Pendiente", cls: "bg-muted text-muted-foreground" },
  };
  const m = map[status] || map.pending;
  return <Badge variant="outline" className={m.cls}>{m.label}</Badge>;
}

function ContactOwnerDialog({ ownerId, onClose, pMap }: { ownerId: string | null; onClose: () => void; pMap: any }) {
  const [msg, setMsg] = useState("");
  const owner = ownerId ? pMap[ownerId] : null;
  const send = async () => {
    if (!ownerId || !msg.trim()) return;
    await supabase.from("notifications").insert({
      user_id: ownerId,
      type: "admin_message",
      title: "Mensaje del equipo RUEDAVE",
      message: msg,
    });
    toast({ title: "Mensaje enviado" });
    setMsg(""); onClose();
  };
  return (
    <Dialog open={!!ownerId} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Contactar a {owner?.full_name || "dueño"}</DialogTitle>
          <DialogDescription>Envía un mensaje interno al aliado sobre el payout.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <Label>Mensaje</Label>
          <Textarea rows={4} value={msg} onChange={(e) => setMsg(e.target.value)} placeholder="Escribe un mensaje sobre el payout..." />
          {owner?.phone && (
            <a href={`https://wa.me/${owner.phone.replace(/\D/g, "")}`} target="_blank" rel="noopener" className="text-sm text-primary hover:underline">
              Abrir WhatsApp →
            </a>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={send}><Send className="h-4 w-4 mr-2" />Enviar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
