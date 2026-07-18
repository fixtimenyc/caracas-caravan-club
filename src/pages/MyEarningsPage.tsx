import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { format, subMonths, startOfMonth, endOfMonth, differenceInDays, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend,
} from "recharts";
import { DollarSign, TrendingUp, Car, CalendarCheck, Download, RefreshCw } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { loadSystemSettings, computeOwnerBreakdown, describeCommission } from "@/lib/systemSettings";
import { toCSV } from "@/lib/csv";

const fmt = (n: number) =>
  `$${Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

type Reservation = {
  id: string; vehicle_id: string; renter_id: string; total_price: number;
  start_date: string; end_date: string; status: string; created_at: string;
};
type Vehicle = { id: string; brand: string; model: string; year: number | null; price_per_day: number | null; house_rules?: any };
type Profile = { user_id: string; full_name: string | null };
type Payment = { id: string; reservation_id: string; status: string };
type Payout = { period: string; status: string; proof_url: string | null };

const statusLabel: Record<string, { text: string; variant: "default" | "secondary" | "outline" }> = {
  completed: { text: "Completada", variant: "default" },
  active: { text: "En curso", variant: "secondary" },
  approved: { text: "Aprobada", variant: "outline" },
};

const MyEarningsPage = () => {
  const { user, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [period, setPeriod] = useState<"3m" | "6m" | "12m" | "all">("6m");
  const [vehicleFilter, setVehicleFilter] = useState<string>("all");

  const settings = loadSystemSettings();
  const ownerRule = settings.policies.owner_commission;
  const ownerCommissionLabel = describeCommission(ownerRule);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const { data: myVehicles } = await supabase
      .from("vehicles")
      .select("id,brand,model,year,price_per_day,house_rules")
      .eq("owner_id", user.id);
    const vids = (myVehicles || []).map((v) => v.id);
    setVehicles((myVehicles as any) || []);
    if (vids.length === 0) {
      setReservations([]); setProfiles([]); setPayments([]); setPayouts([]); setLoading(false); return;
    }
    const { data: res } = await supabase
      .from("reservations")
      .select("id,vehicle_id,renter_id,total_price,start_date,end_date,status,created_at")
      .in("vehicle_id", vids)
      .order("start_date", { ascending: false });
    const list = (res as any as Reservation[]) || [];
    setReservations(list);
    const renterIds = Array.from(new Set(list.map((r) => r.renter_id)));
    const resIds = list.map((r) => r.id);
    const [pr, pay, po] = await Promise.all([
      renterIds.length
        ? supabase.from("profiles").select("user_id,full_name").in("user_id", renterIds)
        : Promise.resolve({ data: [] as any }),
      resIds.length
        ? supabase.from("payments").select("id,reservation_id,status").in("reservation_id", resIds)
        : Promise.resolve({ data: [] as any }),
      supabase.from("owner_payouts").select("period,status,proof_url").eq("owner_id", user.id),
    ]);
    setProfiles((pr.data as any) || []);
    setPayments((pay.data as any) || []);
    setPayouts((po.data as any) || []);
    setLoading(false);
  };

  useEffect(() => { if (user) load(); }, [user]);

  const vMap = useMemo(() => Object.fromEntries(vehicles.map((v) => [v.id, v])), [vehicles]);
  const pMap = useMemo(() => Object.fromEntries(profiles.map((p) => [p.user_id, p])), [profiles]);

  const paidResIds = useMemo(
    () => new Set(payments.filter((p) => p.status === "completed").map((p) => p.reservation_id)),
    [payments],
  );

  const earnable = useMemo(() => {
    const cutoff =
      period === "all" ? null
      : period === "3m" ? subMonths(new Date(), 3)
      : period === "6m" ? subMonths(new Date(), 6)
      : subMonths(new Date(), 12);
    return reservations.filter((r) => {
      if (!["completed", "active"].includes(r.status)) return false;
      if (vehicleFilter !== "all" && r.vehicle_id !== vehicleFilter) return false;
      if (cutoff && new Date(r.start_date) < cutoff) return false;
      return true;
    });
  }, [reservations, period, vehicleFilter]);

  const enriched = useMemo(() => {
    return earnable.map((r) => {
      const v = vehicles.find((x) => x.id === r.vehicle_id);
      const b = computeOwnerBreakdown(settings, v ?? { price_per_day: 0 }, r.start_date, r.end_date);
      const total = Number(r.total_price || 0);
      return {
        r,
        days: b.days,
        total,
        subtotal: b.subtotal,
        commission: b.ownerCommission,
        insurance: b.insurance,
        ownerNet: b.netEarnings,
      };
    });
  }, [earnable, vehicles, settings]);

  const totals = useMemo(() => {
    const gross = enriched.reduce((s, x) => s + x.subtotal, 0);
    const commission = enriched.reduce((s, x) => s + x.commission, 0);
    const completed = enriched.filter((x) => x.r.status === "completed");
    const paid = completed.filter((x) => paidResIds.has(x.r.id)).reduce((s, x) => s + x.ownerNet, 0);
    const pending = completed.filter((x) => !paidResIds.has(x.r.id)).reduce((s, x) => s + x.ownerNet, 0);
    const totalDays = enriched.reduce((s, x) => s + x.days, 0);
    return { gross, commission, paid, pending, count: enriched.length, totalDays };
  }, [enriched, paidResIds]);

  const series = useMemo(() => {
    const months = Array.from({ length: 6 }, (_, i) => startOfMonth(subMonths(new Date(), 5 - i)));
    return months.map((m) => {
      const end = endOfMonth(m);
      const inMonth = enriched.filter((x) => {
        const d = parseISO(x.r.start_date);
        return d >= m && d <= end;
      });
      const bruto = inMonth.reduce((s, x) => s + x.subtotal, 0);
      const comision = inMonth.reduce((s, x) => s + x.commission, 0);
      return {
        mes: format(m, "MMM yy", { locale: es }),
        neto: Math.round((bruto) * 100) / 100,
        comision: Math.round(comision * 100) / 100,
      };
    });
  }, [enriched]);

  const exportCsv = () => {
    const header = [
      "reserva", "vehiculo", "arrendatario", "inicio", "fin", "dias",
      "total_cobrado", "comision", "seguro", "neto_dueno", "estado", "pagado",
    ];
    const rows: unknown[][] = [
      header,
      ...enriched.map((x) => [
        x.r.id.slice(0, 8),
        `${vMap[x.r.vehicle_id]?.brand ?? ""} ${vMap[x.r.vehicle_id]?.model ?? ""}`.trim(),
        pMap[x.r.renter_id]?.full_name ?? "—",
        x.r.start_date,
        x.r.end_date,
        x.days,
        x.total.toFixed(2),
        x.commission.toFixed(2),
        x.insurance.toFixed(2),
        x.ownerNet.toFixed(2),
        x.r.status,
        paidResIds.has(x.r.id) ? "sí" : "no",
      ]),
    ];
    const blob = new Blob([toCSV(rows)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `mis-ganancias-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click(); URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1 container mx-auto px-4 pt-24 pb-16">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <div className="flex items-center gap-3">
            <DollarSign className="w-7 h-7 text-primary" />
            <div>
              <h1 className="text-3xl font-bold">Mis ganancias</h1>
              <p className="text-sm text-muted-foreground">
                Resumen de tus ingresos como aliado. Comisión para el aliado: {ownerCommissionLabel}.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Select value={period} onValueChange={(v: any) => setPeriod(v)}>
              <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="3m">Últimos 3 meses</SelectItem>
                <SelectItem value="6m">Últimos 6 meses</SelectItem>
                <SelectItem value="12m">Últimos 12 meses</SelectItem>
                <SelectItem value="all">Todo</SelectItem>
              </SelectContent>
            </Select>
            <Select value={vehicleFilter} onValueChange={setVehicleFilter}>
              <SelectTrigger className="w-[180px]"><SelectValue placeholder="Vehículo" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los vehículos</SelectItem>
                {vehicles.map((v) => (
                  <SelectItem key={v.id} value={v.id}>{v.brand} {v.model}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" size="icon" onClick={load} title="Actualizar">
              <RefreshCw className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={exportCsv} disabled={!enriched.length}>
              <Download className="h-4 w-4 mr-2" /> CSV
            </Button>
          </div>
        </div>

        {authLoading || loading ? (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28" />)}
          </div>
        ) : !user ? (
          <div className="rounded-xl border border-border bg-card p-10 text-center">
            <p className="text-muted-foreground">Inicia sesión para ver tus ganancias.</p>
            <Link to="/auth"><Button className="mt-4">Iniciar sesión</Button></Link>
          </div>
        ) : vehicles.length === 0 ? (
          <div className="rounded-xl border border-border bg-card p-10 text-center">
            <p className="text-muted-foreground">Aún no tienes vehículos publicados.</p>
            <Link to="/conviertete-en-anfitrion">
              <Button className="mt-4">Publicar mi vehículo</Button>
            </Link>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Kpi label="Ganancias brutas" value={fmt(totals.gross)} icon={DollarSign} accent="text-primary" />
              <Kpi label="Pagado a mí" value={fmt(totals.paid)} icon={TrendingUp} accent="text-emerald-600" />
              <Kpi label="Pendiente por cobrar" value={fmt(totals.pending)} icon={CalendarCheck} accent="text-amber-600" />
              <Kpi label="Reservas / días" value={`${totals.count} / ${totals.totalDays}`} icon={Car} accent="text-accent" />
            </div>

            <Card className="mt-6">
              <CardHeader><CardTitle className="text-base">Evolución mensual (últimos 6 meses)</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={series}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                    <XAxis dataKey="mes" />
                    <YAxis />
                    <Tooltip formatter={(v: any) => fmt(Number(v))} />
                    <Legend />
                    <Bar dataKey="neto" fill="hsl(var(--primary))" name="Ganancia neta" radius={[6, 6, 0, 0]} />
                    <Bar dataKey="comision" fill="hsl(var(--accent))" name="Comisión plataforma" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className="mt-6">
              <CardHeader><CardTitle className="text-base">Detalle de reservas</CardTitle></CardHeader>
              <CardContent className="p-0">
                {enriched.length === 0 ? (
                  <div className="p-10 text-center text-muted-foreground text-sm">
                    Sin reservas en este período.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Vehículo</TableHead>
                          <TableHead>Arrendatario</TableHead>
                          <TableHead>Fechas</TableHead>
                          <TableHead className="text-right">Días</TableHead>
                          <TableHead className="text-right">Comisión</TableHead>
                          <TableHead className="text-right">Ganancia</TableHead>
                          <TableHead>Estado</TableHead>
                          <TableHead>Pago</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {enriched.map((x) => {
                          const v = vMap[x.r.vehicle_id];
                          const s = statusLabel[x.r.status] ?? { text: x.r.status, variant: "outline" as const };
                          const paid = paidResIds.has(x.r.id);
                          return (
                            <TableRow key={x.r.id}>
                              <TableCell className="font-medium">
                                <Link to={`/reservas/${x.r.id}`} className="hover:underline">
                                  {v ? `${v.brand} ${v.model}` : "—"}
                                </Link>
                              </TableCell>
                              <TableCell>{pMap[x.r.renter_id]?.full_name ?? "—"}</TableCell>
                              <TableCell className="text-xs whitespace-nowrap">
                                {format(parseISO(x.r.start_date), "dd MMM yy", { locale: es })} →{" "}
                                {format(parseISO(x.r.end_date), "dd MMM yy", { locale: es })}
                              </TableCell>
                              <TableCell className="text-right">{x.days}</TableCell>
                              <TableCell className="text-right text-muted-foreground">
                                −{fmt(x.commission)}
                              </TableCell>
                              <TableCell className="text-right font-semibold text-primary">
                                {fmt(x.ownerNet)}
                              </TableCell>
                              <TableCell><Badge variant={s.variant}>{s.text}</Badge></TableCell>
                              <TableCell>
                                {x.r.status === "completed" ? (
                                  paid
                                    ? <Badge className="bg-emerald-600 hover:bg-emerald-600">Pagado</Badge>
                                    : <Badge variant="outline">Pendiente</Badge>
                                ) : <span className="text-xs text-muted-foreground">—</span>}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>

            <p className="text-xs text-muted-foreground mt-4">
              La ganancia mostrada descuenta la comisión del aliado ({ownerCommissionLabel}) sobre el
              subtotal (días × tarifa/día) del vehículo, según la configuración del sistema.
            </p>
          </>
        )}
      </main>
      <Footer />
    </div>
  );
};

const Kpi = ({ label, value, icon: Icon, accent }: { label: string; value: string; icon: any; accent: string }) => (
  <Card>
    <CardContent className="p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className={`text-2xl font-bold ${accent}`}>{value}</p>
        </div>
        <Icon className={`h-8 w-8 ${accent} opacity-30`} />
      </div>
    </CardContent>
  </Card>
);

export default MyEarningsPage;
