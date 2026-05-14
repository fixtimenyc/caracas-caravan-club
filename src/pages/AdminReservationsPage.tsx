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
  isSameMonth,
  isSameDay,
  parseISO,
  differenceInCalendarDays,
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
} from "lucide-react";
import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
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
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

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
  renter_id: string;
  renter_name: string;
  owner_id: string;
  owner_name: string;
  start_date: string;
  end_date: string;
  total_price: number;
  status: Status;
  created_at: string;
}

const STATUS_META: Record<Status, { label: string; cls: string }> = {
  pending: { label: "Pendiente", cls: "bg-amber-100 text-amber-700 border-amber-200" },
  approved: { label: "Aprobada", cls: "bg-sky-100 text-sky-700 border-sky-200" },
  active: { label: "Activa", cls: "bg-emerald-100 text-emerald-700 border-emerald-200" },
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

export default function AdminReservationsPage() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<Row[]>([]);

  // filters
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | Status>("all");
  const [rangeKey, setRangeKey] = useState<"30d" | "90d" | "all" | "month">("30d");

  // calendar state
  const [cursor, setCursor] = useState<Date>(new Date());
  const [dayDialog, setDayDialog] = useState<Date | null>(null);

  const load = async () => {
    setLoading(true);
    const { data: reservations } = await supabase
      .from("reservations")
      .select("*")
      .order("created_at", { ascending: false });
    const list = reservations || [];
    const vehicleIds = Array.from(new Set(list.map((r: any) => r.vehicle_id)));
    const userIds = Array.from(new Set(list.map((r: any) => r.renter_id)));

    const [vehiclesRes, profilesRes] = await Promise.all([
      supabase
        .from("vehicles")
        .select("id,brand,model,owner_id")
        .in("id", vehicleIds.length ? vehicleIds : ["00000000-0000-0000-0000-000000000000"]),
      supabase
        .from("profiles")
        .select("user_id,full_name")
        .in(
          "user_id",
          [...userIds, ...(vehiclesRes => [])([])].length
            ? userIds
            : ["00000000-0000-0000-0000-000000000000"],
        ),
    ]);

    const vehicleMap = new Map<string, any>();
    (vehiclesRes.data || []).forEach((v: any) => vehicleMap.set(v.id, v));

    // also need owner names
    const ownerIds = Array.from(
      new Set((vehiclesRes.data || []).map((v: any) => v.owner_id)),
    );
    const allUserIds = Array.from(new Set([...userIds, ...ownerIds]));
    const profilesAllRes = await supabase
      .from("profiles")
      .select("user_id,full_name")
      .in(
        "user_id",
        allUserIds.length ? allUserIds : ["00000000-0000-0000-0000-000000000000"],
      );
    const profileMap = new Map<string, string>();
    (profilesAllRes.data || []).forEach((p: any) =>
      profileMap.set(p.user_id, p.full_name || "—"),
    );

    const next: Row[] = list.map((r: any) => {
      const v = vehicleMap.get(r.vehicle_id);
      return {
        id: r.id,
        vehicle_id: r.vehicle_id,
        vehicle_name: v ? `${v.brand} ${v.model}` : "Vehículo",
        renter_id: r.renter_id,
        renter_name: profileMap.get(r.renter_id) || "—",
        owner_id: v?.owner_id || "",
        owner_name: v?.owner_id ? profileMap.get(v.owner_id) || "—" : "—",
        start_date: r.start_date,
        end_date: r.end_date,
        total_price: Number(r.total_price) || 0,
        status: r.status as Status,
        created_at: r.created_at,
      };
    });
    setRows(next);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const today = new Date();
    return rows.filter((r) => {
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        if (
          !`${r.vehicle_name} ${r.renter_name} ${r.owner_name}`
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
      }
      return true;
    });
  }, [rows, statusFilter, search, rangeKey]);

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
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: `Reserva ${STATUS_META[status].label.toLowerCase()}` });
    load();
  };

  // Calendar helpers
  const monthStart = startOfMonth(cursor);
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const gridEnd = endOfWeek(endOfMonth(cursor), { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd });

  const reservationsByDay = useMemo(() => {
    const map = new Map<string, Row[]>();
    rows.forEach((r) => {
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
  }, [rows]);

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
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar vehículo, arrendatario o dueño"
                  className="pl-8"
                />
              </div>
              <Select value={statusFilter} onValueChange={(v: any) => setStatusFilter(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
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
                  <SelectItem value="30d">Últimos 30 días</SelectItem>
                  <SelectItem value="90d">Últimos 90 días</SelectItem>
                  <SelectItem value="month">Este mes</SelectItem>
                  <SelectItem value="all">Todo</SelectItem>
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          <TabsContent value="list" className="mt-4">
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Reserva</TableHead>
                      <TableHead>Vehículo</TableHead>
                      <TableHead>Arrendatario</TableHead>
                      <TableHead>Dueño</TableHead>
                      <TableHead>Fechas</TableHead>
                      <TableHead>Total</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead className="w-10"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      Array.from({ length: 6 }).map((_, i) => (
                        <TableRow key={i}>
                          <TableCell colSpan={8}><Skeleton className="h-10 w-full" /></TableCell>
                        </TableRow>
                      ))
                    ) : filtered.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
                          No hay reservas con los filtros aplicados.
                        </TableCell>
                      </TableRow>
                    ) : (
                      filtered.map((r) => {
                        const days = Math.max(
                          1,
                          differenceInCalendarDays(parseISO(r.end_date), parseISO(r.start_date)),
                        );
                        return (
                          <TableRow key={r.id}>
                            <TableCell>
                              <div className="font-mono text-xs">#{r.id.slice(0, 8)}</div>
                              <div className="text-xs text-muted-foreground">
                                {format(parseISO(r.created_at), "dd MMM", { locale: es })}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Link
                                to={`/vehiculo/${r.vehicle_id}`}
                                className="text-sm hover:underline font-medium"
                              >
                                {r.vehicle_name}
                              </Link>
                            </TableCell>
                            <TableCell>
                              <Link
                                to={`/admin/usuarios/${r.renter_id}`}
                                className="text-sm hover:underline"
                              >
                                {r.renter_name}
                              </Link>
                            </TableCell>
                            <TableCell>
                              <Link
                                to={`/admin/usuarios/${r.owner_id}`}
                                className="text-sm hover:underline"
                              >
                                {r.owner_name}
                              </Link>
                            </TableCell>
                            <TableCell>
                              <div className="text-sm">
                                {format(parseISO(r.start_date), "dd MMM", { locale: es })}
                                {" → "}
                                {format(parseISO(r.end_date), "dd MMM", { locale: es })}
                              </div>
                              <div className="text-xs text-muted-foreground">{days} días</div>
                            </TableCell>
                            <TableCell className="font-medium">
                              ${r.total_price.toLocaleString()}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className={STATUS_META[r.status].cls}>
                                {STATUS_META[r.status].label}
                              </Badge>
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
                                  <DropdownMenuItem asChild>
                                    <Link to={`/vehiculo/${r.vehicle_id}`}>
                                      <Eye className="h-4 w-4" /> Ver vehículo
                                    </Link>
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  {r.status === "pending" && (
                                    <>
                                      <DropdownMenuItem onClick={() => updateStatus(r.id, "approved")}>
                                        <Check className="h-4 w-4" /> Aprobar
                                      </DropdownMenuItem>
                                      <DropdownMenuItem onClick={() => updateStatus(r.id, "rejected")}>
                                        <X className="h-4 w-4" /> Rechazar
                                      </DropdownMenuItem>
                                    </>
                                  )}
                                  {r.status === "approved" && (
                                    <DropdownMenuItem onClick={() => updateStatus(r.id, "active")}>
                                      <PlayCircle className="h-4 w-4" /> Marcar activa
                                    </DropdownMenuItem>
                                  )}
                                  {r.status === "active" && (
                                    <DropdownMenuItem onClick={() => updateStatus(r.id, "completed")}>
                                      <CheckCircle2 className="h-4 w-4" /> Marcar completada
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
              <CardHeader className="flex flex-row items-center justify-between space-y-0">
                <CardTitle className="text-base flex items-center gap-2">
                  <CalendarDays className="h-4 w-4" />
                  {format(cursor, "MMMM yyyy", { locale: es })}
                </CardTitle>
                <div className="flex items-center gap-1">
                  <Button size="icon" variant="ghost" onClick={() => setCursor(subMonths(cursor, 1))}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setCursor(new Date())}>
                    Hoy
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => setCursor(addMonths(cursor, 1))}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-7 gap-1 text-xs text-muted-foreground mb-1">
                  {["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"].map((d) => (
                    <div key={d} className="px-2 py-1 font-medium">{d}</div>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-1">
                  {days.map((d) => {
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
                              className={`flex items-center gap-1 text-[10px] truncate`}
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
                  <div key={r.id} className="rounded border p-3 space-y-1">
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
                  </div>
                ))}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
