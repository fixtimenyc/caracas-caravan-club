import { useEffect, useMemo, useState } from "react";
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  addMonths,
  subMonths,
  addWeeks,
  subWeeks,
  addDays,
  subDays,
  isSameMonth,
  isSameDay,
  parseISO,
  differenceInCalendarDays,
  startOfDay,
  endOfDay,
} from "date-fns";
import { es } from "date-fns/locale";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Search,
  MoreHorizontal,
  Check,
  X,
  PlayCircle,
  CheckCircle2,
  Eye,
  Filter,
  List,
  CalendarRange,
  Bell,
  Download,
  MessageSquare,
} from "lucide-react";
import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Status =
  | "pending"
  | "approved"
  | "active"
  | "completed"
  | "cancelled"
  | "rejected";

interface Row {
  id: string;
  vehicle_id: string;
  vehicle_name: string;
  vehicle_zone: string;
  renter_id: string;
  renter_name: string;
  renter_phone: string;
  owner_id: string;
  owner_name: string;
  start_date: string;
  end_date: string;
  total_price: number;
  status: Status;
  created_at: string;
  updated_at: string;
  start_mileage: number | null;
  end_mileage: number | null;
}

const STATUS_META: Record<Status, { label: string; cls: string }> = {
  pending: { label: "Pendiente", cls: "bg-amber-100 text-amber-700 border-amber-200" },
  approved: { label: "Aprobada", cls: "bg-sky-100 text-sky-700 border-sky-200" },
  active: { label: "En curso", cls: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  completed: { label: "Completada", cls: "bg-slate-100 text-slate-700 border-slate-200" },
  cancelled: { label: "Cancelada", cls: "bg-rose-100 text-rose-700 border-rose-200" },
  rejected: { label: "Rechazada", cls: "bg-rose-100 text-rose-700 border-rose-200" },
};

const STATUS_DOT: Record<Status, string> = {
  pending: "bg-amber-500",
  approved: "bg-sky-500",
  active: "bg-emerald-500",
  completed: "bg-slate-400",
  cancelled: "bg-rose-500",
  rejected: "bg-rose-500",
};

type CalView = "month" | "week" | "day";

export default function AdminReservationsPage() {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<Row[]>([]);

  // filters
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | Status>("all");
  const [rangeKey, setRangeKey] = useState<"30d" | "90d" | "all" | "month" | "week">("30d");
  const [vehicleFilter, setVehicleFilter] = useState<string>("all");
  const [zoneFilter, setZoneFilter] = useState<string>("all");
  const [priceMin, setPriceMin] = useState<string>("");
  const [priceMax, setPriceMax] = useState<string>("");

  // calendar state
  const [calView, setCalView] = useState<CalView>("month");
  const [cursor, setCursor] = useState<Date>(new Date());
  const [dayDialog, setDayDialog] = useState<Date | null>(null);

  // selection
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const load = async () => {
    setLoading(true);
    const { data: reservations } = await supabase
      .from("reservations")
      .select("*")
      .order("created_at", { ascending: false });
    const list = reservations || [];
    const vehicleIds = Array.from(new Set(list.map((r: any) => r.vehicle_id)));
    const userIds = Array.from(new Set(list.map((r: any) => r.renter_id)));

    const vehiclesRes = await supabase
      .from("vehicles")
      .select("id,brand,model,owner_id,location,zone")
      .in("id", vehicleIds.length ? vehicleIds : ["00000000-0000-0000-0000-000000000000"]);

    const vehicleMap = new Map<string, any>();
    (vehiclesRes.data || []).forEach((v: any) => vehicleMap.set(v.id, v));

    const ownerIds = Array.from(
      new Set((vehiclesRes.data || []).map((v: any) => v.owner_id)),
    );
    const allUserIds = Array.from(new Set([...userIds, ...ownerIds]));
    const profilesAllRes = await supabase
      .from("profiles")
      .select("user_id,full_name,phone")
      .in(
        "user_id",
        allUserIds.length ? allUserIds : ["00000000-0000-0000-0000-000000000000"],
      );
    const profileMap = new Map<string, { name: string; phone: string }>();
    (profilesAllRes.data || []).forEach((p: any) =>
      profileMap.set(p.user_id, { name: p.full_name || "—", phone: p.phone || "" }),
    );

    const next: Row[] = list.map((r: any) => {
      const v = vehicleMap.get(r.vehicle_id);
      const renter = profileMap.get(r.renter_id);
      const owner = v?.owner_id ? profileMap.get(v.owner_id) : undefined;
      const zone = v?.zone || (v?.location ? String(v.location).split(",")[0].trim() : "—");
      return {
        id: r.id,
        vehicle_id: r.vehicle_id,
        vehicle_name: v ? `${v.brand} ${v.model}` : "Vehículo",
        vehicle_zone: zone,
        renter_id: r.renter_id,
        renter_name: renter?.name || "—",
        renter_phone: renter?.phone || "",
        owner_id: v?.owner_id || "",
        owner_name: owner?.name || "—",
        start_date: r.start_date,
        end_date: r.end_date,
        total_price: Number(r.total_price) || 0,
        status: r.status as Status,
        created_at: r.created_at,
        updated_at: r.updated_at,
        start_mileage: r.start_mileage ?? null,
        end_mileage: r.end_mileage ?? null,
      };
    });
    setRows(next);
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, []);

  const vehicles = useMemo(() => {
    const m = new Map<string, string>();
    rows.forEach((r) => m.set(r.vehicle_id, r.vehicle_name));
    return Array.from(m, ([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [rows]);

  const zones = useMemo(() => {
    return Array.from(new Set(rows.map((r) => r.vehicle_zone).filter(Boolean))).sort();
  }, [rows]);

  const filtered = useMemo(() => {
    const today = new Date();
    return rows.filter((r) => {
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (vehicleFilter !== "all" && r.vehicle_id !== vehicleFilter) return false;
      if (zoneFilter !== "all" && r.vehicle_zone !== zoneFilter) return false;
      if (priceMin && r.total_price < Number(priceMin)) return false;
      if (priceMax && r.total_price > Number(priceMax)) return false;
      if (search) {
        const q = search.toLowerCase();
        const idMatch = r.id.toLowerCase().includes(q);
        if (
          !idMatch &&
          !`${r.vehicle_name} ${r.renter_name} ${r.owner_name} ${r.renter_phone}`
            .toLowerCase()
            .includes(q)
        )
          return false;
      }
      if (rangeKey !== "all") {
        const created = parseISO(r.created_at);
        const days = differenceInCalendarDays(today, created);
        if (rangeKey === "30d" && days > 30) return false;
        if (rangeKey === "90d" && days > 90) return false;
        if (rangeKey === "month" && !isSameMonth(created, today)) return false;
        if (rangeKey === "week" && days > 7) return false;
      }
      return true;
    });
  }, [rows, statusFilter, vehicleFilter, zoneFilter, priceMin, priceMax, search, rangeKey]);

  const counts = useMemo(() => {
    const c: Record<Status, number> = {
      pending: 0,
      approved: 0,
      active: 0,
      completed: 0,
      cancelled: 0,
      rejected: 0,
    };
    rows.forEach((r) => (c[r.status] = (c[r.status] || 0) + 1));
    return c;
  }, [rows]);

  // Actions
  const updateStatus = async (id: string, status: Status) => {
    const { error } = await supabase
      .from("reservations")
      .update({ status })
      .eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`Reserva ${STATUS_META[status].label.toLowerCase()}`);
    void load();
  };

  // Bulk actions
  const toggleAll = (checked: boolean) => {
    if (checked) setSelected(new Set(filtered.map((r) => r.id)));
    else setSelected(new Set());
  };
  const toggleOne = (id: string, checked: boolean) => {
    setSelected((prev) => {
      const n = new Set(prev);
      if (checked) n.add(id);
      else n.delete(id);
      return n;
    });
  };

  const bulkConfirm = async () => {
    const ids = Array.from(selected);
    const targets = filtered.filter((r) => ids.includes(r.id) && r.status === "pending");
    if (!targets.length) {
      toast.info("No hay reservas pendientes seleccionadas");
      return;
    }
    const { error } = await supabase
      .from("reservations")
      .update({ status: "approved" })
      .in("id", targets.map((t) => t.id));
    if (error) return toast.error(error.message);
    toast.success(`${targets.length} reservas confirmadas`);
    setSelected(new Set());
    void load();
  };

  const bulkReminder = async () => {
    const ids = Array.from(selected);
    const targets = filtered.filter((r) => ids.includes(r.id));
    if (!targets.length) return;
    const inserts = targets.map((r) => ({
      user_id: r.renter_id,
      type: "reminder",
      title: "Recordatorio de tu reserva",
      message: `Tu reserva del ${format(parseISO(r.start_date), "dd MMM", { locale: es })} para ${r.vehicle_name} se acerca.`,
      action_url: `/mis-reservas`,
      reservation_id: r.id,
    }));
    const { error } = await supabase.from("notifications").insert(inserts);
    if (error) return toast.error(error.message);
    toast.success(`${targets.length} recordatorios enviados`);
    setSelected(new Set());
  };

  const exportCsv = () => {
    const targets = selected.size ? filtered.filter((r) => selected.has(r.id)) : filtered;
    const header = [
      "id",
      "vehiculo",
      "rentador",
      "telefono",
      "dueño",
      "inicio",
      "fin",
      "dias",
      "km_inicio",
      "km_fin",
      "km_recorridos",
      "total",
      "estado",
      "creada",
    ];
    const rowsCsv = targets.map((r) => {
      const days = Math.max(1, differenceInCalendarDays(parseISO(r.end_date), parseISO(r.start_date)));
      const kmDriven =
        r.start_mileage != null && r.end_mileage != null ? r.end_mileage - r.start_mileage : "";
      return [
        r.id,
        r.vehicle_name,
        r.renter_name,
        r.renter_phone,
        r.owner_name,
        r.start_date,
        r.end_date,
        days,
        r.start_mileage ?? "",
        r.end_mileage ?? "",
        kmDriven,
        r.total_price,
        STATUS_META[r.status].label,
        r.created_at,
      ];
    });
    const csv = [header, ...rowsCsv]
      .map((row) => row.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `reservas-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Calendar helpers
  const reservationsByDay = useMemo(() => {
    const map = new Map<string, Row[]>();
    filtered.forEach((r) => {
      const s = parseISO(r.start_date);
      const e = parseISO(r.end_date);
      const span = eachDayOfInterval({ start: s, end: e });
      span.forEach((d) => {
        const k = format(d, "yyyy-MM-dd");
        if (!map.has(k)) map.set(k, []);
        map.get(k)!.push(r);
      });
    });
    return map;
  }, [filtered]);

  const monthDays = useMemo(() => {
    const start = startOfWeek(startOfMonth(cursor), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(cursor), { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
  }, [cursor]);

  const weekDays = useMemo(() => {
    const start = startOfWeek(cursor, { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end: addDays(start, 6) });
  }, [cursor]);

  const dayItems = useMemo(() => {
    const k = format(cursor, "yyyy-MM-dd");
    return reservationsByDay.get(k) || [];
  }, [cursor, reservationsByDay]);

  const goPrev = () => {
    if (calView === "month") setCursor(subMonths(cursor, 1));
    else if (calView === "week") setCursor(subWeeks(cursor, 1));
    else setCursor(subDays(cursor, 1));
  };
  const goNext = () => {
    if (calView === "month") setCursor(addMonths(cursor, 1));
    else if (calView === "week") setCursor(addWeeks(cursor, 1));
    else setCursor(addDays(cursor, 1));
  };

  const headerLabel = useMemo(() => {
    if (calView === "month") return format(cursor, "MMMM yyyy", { locale: es });
    if (calView === "week") {
      const start = startOfWeek(cursor, { weekStartsOn: 1 });
      const end = addDays(start, 6);
      return `${format(start, "d MMM", { locale: es })} – ${format(end, "d MMM yyyy", { locale: es })}`;
    }
    return format(cursor, "EEEE d 'de' MMMM yyyy", { locale: es });
  }, [calView, cursor]);

  const allSelected = filtered.length > 0 && filtered.every((r) => selected.has(r.id));

  return (
    <AdminLayout title="Reservas & Calendario">
      <div className="space-y-4">
        {/* KPI strip */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {(Object.keys(STATUS_META) as Status[]).map((s) => (
            <Card key={s}>
              <CardContent className="p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs text-muted-foreground">{STATUS_META[s].label}</div>
                    <div className="text-xl font-semibold mt-1">{counts[s] || 0}</div>
                  </div>
                  <span className={`h-2.5 w-2.5 rounded-full ${STATUS_DOT[s]}`} />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Tabs defaultValue="list">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <TabsList>
              <TabsTrigger value="list">
                <List className="h-4 w-4" /> Lista
              </TabsTrigger>
              <TabsTrigger value="calendar">
                <CalendarRange className="h-4 w-4" /> Calendario
              </TabsTrigger>
            </TabsList>
          </div>

          {/* Filters */}
          <Card className="mt-3">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Filter className="h-4 w-4" /> Filtros
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-3">
              <div className="relative md:col-span-2 lg:col-span-2">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar por ID, vehículo, rentador o teléfono"
                  className="pl-8"
                />
              </div>
              <Select value={statusFilter} onValueChange={(v: any) => setStatusFilter(v)}>
                <SelectTrigger><SelectValue placeholder="Estado" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los estados</SelectItem>
                  {(Object.keys(STATUS_META) as Status[]).map((s) => (
                    <SelectItem key={s} value={s}>{STATUS_META[s].label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={rangeKey} onValueChange={(v: any) => setRangeKey(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="week">Esta semana</SelectItem>
                  <SelectItem value="month">Este mes</SelectItem>
                  <SelectItem value="30d">Próximos / últimos 30 días</SelectItem>
                  <SelectItem value="90d">Últimos 90 días</SelectItem>
                  <SelectItem value="all">Todo</SelectItem>
                </SelectContent>
              </Select>
              <Select value={vehicleFilter} onValueChange={setVehicleFilter}>
                <SelectTrigger><SelectValue placeholder="Auto" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los autos</SelectItem>
                  {vehicles.map((v) => (
                    <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={zoneFilter} onValueChange={setZoneFilter}>
                <SelectTrigger><SelectValue placeholder="Zona" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas las zonas</SelectItem>
                  {zones.map((z) => (
                    <SelectItem key={z} value={z}>{z}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  placeholder="Min $"
                  value={priceMin}
                  onChange={(e) => setPriceMin(e.target.value)}
                />
                <Input
                  type="number"
                  placeholder="Max $"
                  value={priceMax}
                  onChange={(e) => setPriceMax(e.target.value)}
                />
              </div>
            </CardContent>
          </Card>

          <TabsContent value="list" className="mt-4">
            {/* Bulk actions bar */}
            <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
              <p className="text-sm text-muted-foreground">
                {filtered.length} reservas{selected.size > 0 ? ` · ${selected.size} seleccionadas` : ""}
              </p>
              <div className="flex gap-2 flex-wrap">
                {selected.size > 0 && (
                  <>
                    <Button size="sm" variant="outline" onClick={bulkConfirm}>
                      <Check className="h-4 w-4" /> Confirmar lote
                    </Button>
                    <Button size="sm" variant="outline" onClick={bulkReminder}>
                      <Bell className="h-4 w-4" /> Enviar recordatorio
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
                      Limpiar selección
                    </Button>
                  </>
                )}
                <Button size="sm" variant="outline" onClick={exportCsv}>
                  <Download className="h-4 w-4" /> Exportar CSV
                </Button>
              </div>
            </div>

            <Card>
              <CardContent className="p-0 overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">
                        <Checkbox
                          checked={allSelected}
                          onCheckedChange={(c) => toggleAll(Boolean(c))}
                        />
                      </TableHead>
                      <TableHead>Reserva</TableHead>
                      <TableHead>Rentador</TableHead>
                      <TableHead>Auto</TableHead>
                      <TableHead>Fechas</TableHead>
                      <TableHead>Total</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead>Actualizada</TableHead>
                      <TableHead className="w-10"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      Array.from({ length: 6 }).map((_, i) => (
                        <TableRow key={i}>
                          <TableCell colSpan={9}><Skeleton className="h-10 w-full" /></TableCell>
                        </TableRow>
                      ))
                    ) : filtered.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={9} className="text-center py-12 text-muted-foreground">
                          No hay reservas con los filtros aplicados.
                        </TableCell>
                      </TableRow>
                    ) : (
                      filtered.map((r) => {
                        const days = Math.max(
                          1,
                          differenceInCalendarDays(parseISO(r.end_date), parseISO(r.start_date)),
                        );
                        const daily = r.total_price > 0 ? r.total_price / days : 0;
                        return (
                          <TableRow key={r.id} className="hover:bg-accent/30">
                            <TableCell onClick={(e) => e.stopPropagation()}>
                              <Checkbox
                                checked={selected.has(r.id)}
                                onCheckedChange={(c) => toggleOne(r.id, Boolean(c))}
                              />
                            </TableCell>
                            <TableCell
                              className="cursor-pointer"
                              onClick={() => navigate(`/admin/reservas/${r.id}`)}
                            >
                              <div className="font-mono text-xs">#{r.id.slice(0, 8).toUpperCase()}</div>
                              <div className="text-xs text-muted-foreground">
                                Creada {format(parseISO(r.created_at), "dd MMM HH:mm", { locale: es })}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Link
                                to={`/admin/usuarios/${r.renter_id}`}
                                className="text-sm hover:underline font-medium"
                              >
                                {r.renter_name}
                              </Link>
                              {r.renter_phone && (
                                <div className="text-xs text-muted-foreground">{r.renter_phone}</div>
                              )}
                            </TableCell>
                            <TableCell>
                              <Link
                                to={`/admin/flota/${r.vehicle_id}`}
                                className="text-sm hover:underline"
                              >
                                {r.vehicle_name}
                              </Link>
                              {r.vehicle_zone && (
                                <div className="text-xs text-muted-foreground">{r.vehicle_zone}</div>
                              )}
                            </TableCell>
                            <TableCell>
                              <div className="text-sm">
                                {format(parseISO(r.start_date), "dd MMM", { locale: es })}
                                {" → "}
                                {format(parseISO(r.end_date), "dd MMM", { locale: es })}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {days} días · ${Math.round(daily)}/día
                              </div>
                            </TableCell>
                            <TableCell className="font-medium">
                              ${r.total_price.toLocaleString()}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className={STATUS_META[r.status].cls}>
                                {STATUS_META[r.status].label}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {format(parseISO(r.updated_at), "dd MMM HH:mm", { locale: es })}
                            </TableCell>
                            <TableCell>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button size="icon" variant="ghost" className="h-8 w-8">
                                    <MoreHorizontal className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuLabel>Acciones</DropdownMenuLabel>
                                  <DropdownMenuItem onClick={() => navigate(`/admin/reservas/${r.id}`)}>
                                    <Eye className="h-4 w-4" /> Ver detalle
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  {r.status === "pending" && (
                                    <>
                                      <DropdownMenuItem onClick={() => updateStatus(r.id, "approved")}>
                                        <Check className="h-4 w-4" /> Confirmar
                                      </DropdownMenuItem>
                                      <DropdownMenuItem onClick={() => updateStatus(r.id, "rejected")}>
                                        <X className="h-4 w-4" /> Rechazar
                                      </DropdownMenuItem>
                                    </>
                                  )}
                                  {r.status === "approved" && (
                                    <DropdownMenuItem onClick={() => updateStatus(r.id, "active")}>
                                      <PlayCircle className="h-4 w-4" /> Marcar en curso
                                    </DropdownMenuItem>
                                  )}
                                  {r.status === "active" && (
                                    <DropdownMenuItem onClick={() => updateStatus(r.id, "completed")}>
                                      <CheckCircle2 className="h-4 w-4" /> Marcar completada
                                    </DropdownMenuItem>
                                  )}
                                  {r.renter_phone && (
                                    <DropdownMenuItem
                                      onClick={() =>
                                        window.open(
                                          `https://wa.me/${r.renter_phone.replace(/\D/g, "")}`,
                                          "_blank",
                                        )
                                      }
                                    >
                                      <MessageSquare className="h-4 w-4" /> Contactar rentador
                                    </DropdownMenuItem>
                                  )}
                                  {(r.status === "pending" ||
                                    r.status === "approved" ||
                                    r.status === "active") && (
                                    <DropdownMenuItem
                                      onClick={() => updateStatus(r.id, "cancelled")}
                                      className="text-destructive"
                                    >
                                      <X className="h-4 w-4" /> Cancelar
                                    </DropdownMenuItem>
                                  )}
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="calendar" className="mt-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 gap-2 flex-wrap">
                <CardTitle className="text-base flex items-center gap-2 capitalize">
                  <CalendarDays className="h-4 w-4" />
                  {headerLabel}
                </CardTitle>
                <div className="flex items-center gap-2 flex-wrap">
                  <Tabs value={calView} onValueChange={(v: any) => setCalView(v)}>
                    <TabsList>
                      <TabsTrigger value="month">Mes</TabsTrigger>
                      <TabsTrigger value="week">Semana</TabsTrigger>
                      <TabsTrigger value="day">Día</TabsTrigger>
                    </TabsList>
                  </Tabs>
                  <div className="flex items-center gap-1">
                    <Button size="icon" variant="ghost" onClick={goPrev}>
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setCursor(new Date())}>
                      Hoy
                    </Button>
                    <Button size="icon" variant="ghost" onClick={goNext}>
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {calView === "month" && (
                  <>
                    <div className="grid grid-cols-7 gap-1 text-xs text-muted-foreground mb-1">
                      {["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"].map((d) => (
                        <div key={d} className="px-2 py-1 font-medium">{d}</div>
                      ))}
                    </div>
                    <div className="grid grid-cols-7 gap-1">
                      {monthDays.map((d) => {
                        const k = format(d, "yyyy-MM-dd");
                        const items = reservationsByDay.get(k) || [];
                        const inMonth = isSameMonth(d, cursor);
                        const isToday = isSameDay(d, new Date());
                        return (
                          <button
                            key={k}
                            onClick={() => items.length && setDayDialog(d)}
                            className={[
                              "min-h-[84px] rounded-md border p-1.5 text-left flex flex-col gap-1 transition-colors",
                              inMonth ? "bg-background" : "bg-muted/30 text-muted-foreground",
                              isToday ? "ring-1 ring-primary" : "",
                              items.length ? "hover:bg-accent/40 cursor-pointer" : "cursor-default",
                            ].join(" ")}
                          >
                            <div className="text-xs font-medium">{format(d, "d")}</div>
                            <div className="space-y-0.5">
                              {items.slice(0, 3).map((it) => (
                                <div
                                  key={it.id}
                                  title={`${it.vehicle_name} · ${it.renter_name} · $${it.total_price}`}
                                  className="flex items-center gap-1 text-[10px] truncate"
                                >
                                  <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${STATUS_DOT[it.status]}`} />
                                  <span className="truncate">{it.vehicle_name}</span>
                                </div>
                              ))}
                              {items.length > 3 && (
                                <div className="text-[10px] text-muted-foreground">
                                  +{items.length - 3} más
                                </div>
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </>
                )}

                {calView === "week" && (
                  <div className="space-y-1">
                    {weekDays.map((d) => {
                      const k = format(d, "yyyy-MM-dd");
                      const items = reservationsByDay.get(k) || [];
                      const isToday = isSameDay(d, new Date());
                      return (
                        <div
                          key={k}
                          className={`flex gap-2 border rounded-md p-2 ${isToday ? "ring-1 ring-primary" : ""}`}
                        >
                          <div className="w-20 shrink-0">
                            <div className="text-xs uppercase text-muted-foreground">
                              {format(d, "EEE", { locale: es })}
                            </div>
                            <div className="text-lg font-semibold">{format(d, "d")}</div>
                          </div>
                          <div className="flex-1 flex flex-wrap gap-1">
                            {items.length === 0 ? (
                              <span className="text-xs text-muted-foreground self-center">Sin reservas</span>
                            ) : (
                              items.map((it) => (
                                <button
                                  key={it.id}
                                  onClick={() => navigate(`/admin/reservas/${it.id}`)}
                                  className={`px-2 py-1 rounded text-[11px] flex items-center gap-1 border ${STATUS_META[it.status].cls} hover:opacity-80`}
                                >
                                  <span className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT[it.status]}`} />
                                  {it.vehicle_name} · {it.renter_name}
                                </button>
                              ))
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {calView === "day" && (
                  <div className="space-y-2">
                    {dayItems.length === 0 ? (
                      <p className="text-sm text-muted-foreground py-8 text-center">
                        Sin reservas para este día.
                      </p>
                    ) : (
                      dayItems.map((it) => (
                        <button
                          key={it.id}
                          onClick={() => navigate(`/admin/reservas/${it.id}`)}
                          className="w-full text-left border rounded-md p-3 hover:bg-accent/40 flex items-center justify-between gap-3"
                        >
                          <div>
                            <div className="font-medium text-sm">
                              {it.vehicle_name} · {it.renter_name}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {format(parseISO(it.start_date), "dd MMM", { locale: es })} →{" "}
                              {format(parseISO(it.end_date), "dd MMM", { locale: es })} · $
                              {it.total_price.toLocaleString()}
                            </div>
                          </div>
                          <Badge variant="outline" className={STATUS_META[it.status].cls}>
                            {STATUS_META[it.status].label}
                          </Badge>
                        </button>
                      ))
                    )}
                  </div>
                )}

                <div className="mt-3 flex flex-wrap gap-3 text-xs text-muted-foreground">
                  {(Object.keys(STATUS_META) as Status[]).map((s) => (
                    <div key={s} className="flex items-center gap-1.5">
                      <span className={`h-2 w-2 rounded-full ${STATUS_DOT[s]}`} />
                      {STATUS_META[s].label}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Day dialog */}
      <Dialog open={!!dayDialog} onOpenChange={(o) => !o && setDayDialog(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              Reservas del {dayDialog && format(dayDialog, "PPP", { locale: es })}
            </DialogTitle>
            <DialogDescription>
              {dayDialog &&
                `${reservationsByDay.get(format(dayDialog, "yyyy-MM-dd"))?.length || 0} reservas`}
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh]">
            <div className="space-y-2">
              {dayDialog &&
                (reservationsByDay.get(format(dayDialog, "yyyy-MM-dd")) || []).map((r) => (
                  <button
                    key={r.id}
                    onClick={() => {
                      setDayDialog(null);
                      navigate(`/admin/reservas/${r.id}`);
                    }}
                    className="w-full text-left rounded border p-3 space-y-1 hover:bg-accent/30"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="font-medium text-sm">{r.vehicle_name}</div>
                      <Badge variant="outline" className={STATUS_META[r.status].cls}>
                        {STATUS_META[r.status].label}
                      </Badge>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {r.renter_name} • {format(parseISO(r.start_date), "dd MMM", { locale: es })}{" → "}
                      {format(parseISO(r.end_date), "dd MMM", { locale: es })} • $
                      {r.total_price.toLocaleString()}
                    </div>
                  </button>
                ))}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
