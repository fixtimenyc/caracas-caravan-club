import { useEffect, useMemo, useState } from "react";
import { toCSV } from "@/lib/csv";
import { Link } from "react-router-dom";
import { format, subDays } from "date-fns";
import { es } from "date-fns/locale";
import {
  Car,
  Search,
  MoreHorizontal,
  Eye,
  Pencil,
  PauseCircle,
  PlayCircle,
  MessageSquare,
  Wrench,
  DollarSign,
  Filter,
  Download,
  AlertCircle,
} from "lucide-react";
import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { CARACAS_ZONES, matchZone } from "@/lib/locations";
import { VEHICLE_CATEGORIES, inferCategory, type VehicleCategory } from "@/lib/vehicleCategory";
import { resolveVehiclePhoto } from "@/lib/vehiclePhoto";

type FleetStatus = "active" | "maintenance" | "paused" | "inactive";

interface FleetRow {
  id: string;
  brand: string;
  model: string;
  year: number;
  photo: string | null;
  location: string;
  zone: string;
  category: VehicleCategory;
  price_per_day: number;
  active: boolean;
  available: boolean;
  owner_id: string;
  owner_name: string;
  status: FleetStatus;
  occupancy: number; // 0-100 last 30 days
  reserved_days_30d: number;
  last_revision: Date | null; // last completed maintenance
}

const STATUS_META: Record<FleetStatus, { label: string; cls: string }> = {
  active: { label: "Activo", cls: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  maintenance: { label: "Mantenimiento", cls: "bg-amber-100 text-amber-700 border-amber-200" },
  paused: { label: "Pausado", cls: "bg-slate-100 text-slate-700 border-slate-200" },
  inactive: { label: "Inactivo", cls: "bg-rose-100 text-rose-700 border-rose-200" },
};

const OCCUPANCY_BUCKETS = [
  { id: "all", label: "Todas" },
  { id: "0-25", label: "0-25%", min: 0, max: 25 },
  { id: "25-50", label: "25-50%", min: 25, max: 50 },
  { id: "50-75", label: "50-75%", min: 50, max: 75 },
  { id: "75-100", label: "75-100%", min: 75, max: 100 },
] as const;

const PRICE_BUCKETS = [
  { id: "all", label: "Todas" },
  { id: "<100", label: "< $100", max: 100 },
  { id: "100-150", label: "$100-150", min: 100, max: 150 },
  { id: "150-200", label: "$150-200", min: 150, max: 200 },
  { id: ">200", label: "> $200", min: 200 },
] as const;

const REVISION_BUCKETS = [
  { id: "all", label: "Todas" },
  { id: "<1m", label: "< 1 mes" },
  { id: "<3m", label: "< 3 meses" },
  { id: ">3m", label: "> 3 meses o sin registro" },
] as const;

function deriveStatus(v: {
  active: boolean;
  available: boolean;
  inMaintenance: boolean;
}): FleetStatus {
  if (!v.active) return "inactive";
  if (v.inMaintenance) return "maintenance";
  if (!v.available) return "paused";
  return "active";
}

export default function AdminFleetPage() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<FleetRow[]>([]);
  const [selected, setSelected] = useState<Record<string, boolean>>({});

  // Filters
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | FleetStatus>("all");
  const [occBucket, setOccBucket] = useState<string>("all");
  const [zoneFilter, setZoneFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [priceBucket, setPriceBucket] = useState<string>("all");
  const [revBucket, setRevBucket] = useState<string>("all");

  // Bulk dialog
  const [bulkOpen, setBulkOpen] = useState<null | "status" | "price" | "maintenance">(null);
  const [bulkStatus, setBulkStatus] = useState<FleetStatus>("active");
  const [priceMode, setPriceMode] = useState<"set" | "delta_pct">("delta_pct");
  const [priceValue, setPriceValue] = useState<string>("0");
  const [maintDate, setMaintDate] = useState<Date | undefined>(new Date());
  const [maintType, setMaintType] = useState<string>("Inspección general");
  const [maintNotes, setMaintNotes] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);

  const load = async () => {
    setLoading(true);
    const since = subDays(new Date(), 30).toISOString().slice(0, 10);

    const [vehiclesRes, reservationsRes, maintenanceRes] = await Promise.all([
      supabase.from("vehicles").select("*").order("created_at", { ascending: false }),
      supabase
        .from("reservations")
        .select("vehicle_id,start_date,end_date,status")
        .in("status", ["active", "completed", "approved"]),
      supabase
        .from("vehicle_maintenance")
        .select("vehicle_id,scheduled_date,completed_at,status,type"),
    ]);

    const vehicles = vehiclesRes.data || [];
    const ownerIds = Array.from(new Set(vehicles.map((v: any) => v.owner_id)));
    const profilesRes = await supabase
      .from("profiles")
      .select("user_id,full_name")
      .in("user_id", ownerIds.length ? ownerIds : ["00000000-0000-0000-0000-000000000000"]);
    const ownerMap = new Map<string, string>();
    (profilesRes.data || []).forEach((p: any) =>
      ownerMap.set(p.user_id, p.full_name || "—"),
    );

    const reservedByVehicle = new Map<string, number>();
    const sinceDate = new Date(since);
    const today = new Date();
    (reservationsRes.data || []).forEach((r: any) => {
      const s = new Date(r.start_date);
      const e = new Date(r.end_date);
      const start = s < sinceDate ? sinceDate : s;
      const end = e > today ? today : e;
      const days = Math.max(0, Math.ceil((end.getTime() - start.getTime()) / 86400000));
      if (days > 0)
        reservedByVehicle.set(r.vehicle_id, (reservedByVehicle.get(r.vehicle_id) || 0) + days);
    });

    const maintMap = new Map<
      string,
      { last: Date | null; inMaintenance: boolean }
    >();
    (maintenanceRes.data || []).forEach((m: any) => {
      const cur = maintMap.get(m.vehicle_id) || { last: null, inMaintenance: false };
      if (m.status === "in_progress") cur.inMaintenance = true;
      const completed = m.completed_at ? new Date(m.completed_at) : null;
      if (completed && (!cur.last || completed > cur.last)) cur.last = completed;
      maintMap.set(m.vehicle_id, cur);
    });

    const next: FleetRow[] = await Promise.all(vehicles.map(async (v: any) => {
      const reserved = reservedByVehicle.get(v.id) || 0;
      const occupancy = Math.min(100, Math.round((reserved / 30) * 100));
      const m = maintMap.get(v.id) || { last: null, inMaintenance: false };
      const zone = matchZone(v.location) || v.location?.split(",")[0]?.trim() || "—";
      return {
        id: v.id,
        brand: v.brand,
        model: v.model,
        year: v.year,
        photo: Array.isArray(v.photos) && v.photos.length ? await resolveVehiclePhoto(v.photos[0]) : null,
        location: v.location,
        zone,
        category: inferCategory(v.brand, v.model),
        price_per_day: Number(v.price_per_day) || 0,
        active: !!v.active,
        available: !!v.available,
        owner_id: v.owner_id,
        owner_name: ownerMap.get(v.owner_id) || "—",
        status: deriveStatus({
          active: !!v.active,
          available: !!v.available,
          inMaintenance: m.inMaintenance,
        }),
        occupancy,
        reserved_days_30d: reserved,
        last_revision: m.last,
      };
    }));

    setRows(next);
    setSelected({});
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (search) {
        const q = search.toLowerCase();
        if (
          !`${r.brand} ${r.model} ${r.owner_name} ${r.zone}`
            .toLowerCase()
            .includes(q)
        )
          return false;
      }
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (zoneFilter !== "all" && r.zone !== zoneFilter) return false;
      if (typeFilter !== "all" && r.category !== typeFilter) return false;

      if (occBucket !== "all") {
        const b = OCCUPANCY_BUCKETS.find((x) => x.id === occBucket) as any;
        if (b && (r.occupancy < b.min || r.occupancy > b.max)) return false;
      }
      if (priceBucket !== "all") {
        const b = PRICE_BUCKETS.find((x) => x.id === priceBucket) as any;
        if (b) {
          if (b.min !== undefined && r.price_per_day < b.min) return false;
          if (b.max !== undefined && r.price_per_day >= b.max) return false;
        }
      }
      if (revBucket !== "all") {
        const days = r.last_revision
          ? Math.floor((Date.now() - r.last_revision.getTime()) / 86400000)
          : Infinity;
        if (revBucket === "<1m" && days >= 30) return false;
        if (revBucket === "<3m" && days >= 90) return false;
        if (revBucket === ">3m" && days < 90) return false;
      }
      return true;
    });
  }, [rows, search, statusFilter, zoneFilter, typeFilter, occBucket, priceBucket, revBucket]);

  const selectedIds = useMemo(
    () => Object.entries(selected).filter(([, v]) => v).map(([k]) => k),
    [selected],
  );
  const allVisibleSelected =
    filtered.length > 0 && filtered.every((r) => selected[r.id]);

  const toggleAll = (checked: boolean) => {
    const next: Record<string, boolean> = { ...selected };
    filtered.forEach((r) => (next[r.id] = checked));
    setSelected(next);
  };

  // ===== Row actions =====
  const togglePause = async (row: FleetRow) => {
    const newAvailable = !row.available;
    const { error } = await supabase
      .from("vehicles")
      .update({ available: newAvailable })
      .eq("id", row.id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    toast({
      title: newAvailable ? "Vehículo reanudado" : "Vehículo pausado",
    });
    load();
  };

  const setActive = async (row: FleetRow, active: boolean) => {
    const { error } = await supabase.from("vehicles").update({ active }).eq("id", row.id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: active ? "Vehículo reactivado" : "Vehículo desactivado" });
    load();
  };

  const contactOwner = async (row: FleetRow) => {
    // Try existing conversation, else open messages page filtered by user
    window.location.href = `/admin/usuarios/${row.owner_id}`;
  };

  // ===== Bulk actions =====
  const applyBulkStatus = async () => {
    if (!selectedIds.length) return;
    setSubmitting(true);
    let patch: any = {};
    if (bulkStatus === "active") patch = { active: true, available: true };
    else if (bulkStatus === "paused") patch = { active: true, available: false };
    else if (bulkStatus === "inactive") patch = { active: false };
    else if (bulkStatus === "maintenance") {
      // No DB column for maintenance; create a maintenance record per vehicle.
      const today = new Date().toISOString().slice(0, 10);
      const records = selectedIds.map((id) => ({
        vehicle_id: id,
        scheduled_date: today,
        type: "Mantenimiento programado",
        status: "in_progress",
      }));
      const { error } = await supabase.from("vehicle_maintenance").insert(records);
      if (error) {
        toast({ title: "Error", description: error.message, variant: "destructive" });
        setSubmitting(false);
        return;
      }
      toast({ title: `Marcados ${selectedIds.length} en mantenimiento` });
      setBulkOpen(null);
      setSubmitting(false);
      load();
      return;
    }
    const { error } = await supabase.from("vehicles").update(patch).in("id", selectedIds);
    setSubmitting(false);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: `Estado actualizado en ${selectedIds.length} vehículos` });
    setBulkOpen(null);
    load();
  };

  const applyBulkPrice = async () => {
    if (!selectedIds.length) return;
    const value = Number(priceValue);
    if (!isFinite(value)) return;
    setSubmitting(true);
    if (priceMode === "set") {
      const { error } = await supabase
        .from("vehicles")
        .update({ price_per_day: value })
        .in("id", selectedIds);
      if (error) {
        toast({ title: "Error", description: error.message, variant: "destructive" });
        setSubmitting(false);
        return;
      }
    } else {
      // delta_pct: update each individually
      const targets = rows.filter((r) => selectedIds.includes(r.id));
      const factor = 1 + value / 100;
      for (const t of targets) {
        const newPrice = Math.max(1, Math.round(t.price_per_day * factor));
        await supabase.from("vehicles").update({ price_per_day: newPrice }).eq("id", t.id);
      }
    }
    setSubmitting(false);
    toast({ title: `Tarifa ajustada en ${selectedIds.length} vehículos` });
    setBulkOpen(null);
    load();
  };

  const applyBulkMaintenance = async () => {
    if (!selectedIds.length || !maintDate) return;
    setSubmitting(true);
    const records = selectedIds.map((id) => ({
      vehicle_id: id,
      scheduled_date: maintDate.toISOString().slice(0, 10),
      type: maintType,
      notes: maintNotes || null,
      status: "scheduled",
    }));
    const { error } = await supabase.from("vehicle_maintenance").insert(records);
    setSubmitting(false);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: `Inspección programada para ${selectedIds.length} vehículos` });
    setBulkOpen(null);
    load();
  };

  // ===== Export CSV =====
  const exportCsv = () => {
    const header = [
      "Marca",
      "Modelo",
      "Año",
      "Dueño",
      "Zona",
      "Tipo",
      "Tarifa/día",
      "Estado",
      "Ocupación 30d (%)",
      "Última revisión",
    ];
    const rows: unknown[][] = [header];
    filtered.forEach((r) => {
      rows.push([
        r.brand,
        r.model,
        r.year,
        r.owner_name,
        r.zone,
        VEHICLE_CATEGORIES.find((c) => c.id === r.category)?.name || r.category,
        r.price_per_day,
        STATUS_META[r.status].label,
        r.occupancy,
        r.last_revision ? format(r.last_revision, "yyyy-MM-dd") : "",
      ]);
    });
    const blob = new Blob([toCSV(rows)], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `flota-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <AdminLayout title="Gestión de Flota">
      <div className="space-y-4">
        {/* Summary KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {(["active", "maintenance", "paused", "inactive"] as FleetStatus[]).map((s) => {
            const count = rows.filter((r) => r.status === s).length;
            return (
              <Card key={s}>
                <CardContent className="p-4 flex items-center justify-between">
                  <div>
                    <div className="text-xs text-muted-foreground">{STATUS_META[s].label}</div>
                    <div className="text-2xl font-semibold mt-1">{count}</div>
                  </div>
                  <Badge variant="outline" className={STATUS_META[s].cls}>
                    {s === "active" && <Car className="h-3.5 w-3.5" />}
                    {s === "maintenance" && <Wrench className="h-3.5 w-3.5" />}
                    {s === "paused" && <PauseCircle className="h-3.5 w-3.5" />}
                    {s === "inactive" && <AlertCircle className="h-3.5 w-3.5" />}
                  </Badge>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Filters */}
        <Card>
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
                placeholder="Buscar marca, modelo o dueño"
                className="pl-8"
              />
            </div>
            <Select value={statusFilter} onValueChange={(v: any) => setStatusFilter(v)}>
              <SelectTrigger><SelectValue placeholder="Estado" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los estados</SelectItem>
                {(Object.keys(STATUS_META) as FleetStatus[]).map((s) => (
                  <SelectItem key={s} value={s}>{STATUS_META[s].label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={occBucket} onValueChange={setOccBucket}>
              <SelectTrigger><SelectValue placeholder="Ocupación" /></SelectTrigger>
              <SelectContent>
                {OCCUPANCY_BUCKETS.map((b) => (
                  <SelectItem key={b.id} value={b.id}>Ocupación: {b.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={zoneFilter} onValueChange={setZoneFilter}>
              <SelectTrigger><SelectValue placeholder="Zona" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las zonas</SelectItem>
                {CARACAS_ZONES.map((z) => (
                  <SelectItem key={z} value={z}>{z}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger><SelectValue placeholder="Tipo" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los tipos</SelectItem>
                {VEHICLE_CATEGORIES.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={priceBucket} onValueChange={setPriceBucket}>
              <SelectTrigger><SelectValue placeholder="Tarifa" /></SelectTrigger>
              <SelectContent>
                {PRICE_BUCKETS.map((b) => (
                  <SelectItem key={b.id} value={b.id}>Tarifa: {b.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={revBucket} onValueChange={setRevBucket}>
              <SelectTrigger><SelectValue placeholder="Última revisión" /></SelectTrigger>
              <SelectContent>
                {REVISION_BUCKETS.map((b) => (
                  <SelectItem key={b.id} value={b.id}>Revisión: {b.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex items-center gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={exportCsv}>
                <Download className="h-4 w-4" /> Exportar CSV
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Bulk action bar */}
        {selectedIds.length > 0 && (
          <div className="flex items-center gap-3 rounded-md border bg-accent/30 px-4 py-2">
            <span className="text-sm font-medium">{selectedIds.length} seleccionados</span>
            <div className="flex-1" />
            <Button size="sm" variant="outline" onClick={() => setBulkOpen("status")}>
              Cambiar estado
            </Button>
            <Button size="sm" variant="outline" onClick={() => setBulkOpen("price")}>
              <DollarSign className="h-4 w-4" /> Ajustar tarifa
            </Button>
            <Button size="sm" variant="outline" onClick={() => setBulkOpen("maintenance")}>
              <Wrench className="h-4 w-4" /> Solicitar inspección
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setSelected({})}>
              Limpiar
            </Button>
          </div>
        )}

        {/* Table */}
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox
                      checked={allVisibleSelected}
                      onCheckedChange={(c) => toggleAll(!!c)}
                    />
                  </TableHead>
                  <TableHead>Vehículo</TableHead>
                  <TableHead>Dueño</TableHead>
                  <TableHead>Zona</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Tarifa</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Ocupación 30d</TableHead>
                  <TableHead>Última revisión</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array.from({ length: 6 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell colSpan={10}><Skeleton className="h-10 w-full" /></TableCell>
                    </TableRow>
                  ))
                ) : filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center py-12 text-muted-foreground">
                      No se encontraron vehículos con los filtros aplicados.
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell>
                        <Checkbox
                          checked={!!selected[r.id]}
                          onCheckedChange={(c) =>
                            setSelected((s) => ({ ...s, [r.id]: !!c }))
                          }
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-14 rounded bg-muted overflow-hidden flex items-center justify-center shrink-0">
                            {r.photo ? (
                              <img src={r.photo} alt="" className="h-full w-full object-cover" />
                            ) : (
                              <Car className="h-4 w-4 text-muted-foreground" />
                            )}
                          </div>
                          <div>
                            <div className="font-medium">{r.brand} {r.model}</div>
                            <div className="text-xs text-muted-foreground">{r.year}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Link
                          to={`/admin/usuarios/${r.owner_id}`}
                          className="text-sm hover:underline"
                        >
                          {r.owner_name}
                        </Link>
                      </TableCell>
                      <TableCell><span className="text-sm">{r.zone}</span></TableCell>
                      <TableCell>
                        <span className="text-sm">
                          {VEHICLE_CATEGORIES.find((c) => c.id === r.category)?.name}
                        </span>
                      </TableCell>
                      <TableCell className="font-medium">${r.price_per_day}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={STATUS_META[r.status].cls}>
                          {STATUS_META[r.status].label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 min-w-[110px]">
                          <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                            <div
                              className="h-full bg-primary"
                              style={{ width: `${r.occupancy}%` }}
                            />
                          </div>
                          <span className="text-xs tabular-nums">{r.occupancy}%</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-muted-foreground">
                          {r.last_revision
                            ? format(r.last_revision, "dd MMM yyyy", { locale: es })
                            : "—"}
                        </span>
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
                              <Link to={`/admin/flota/${r.id}`}>
                                <Eye className="h-4 w-4" /> Ver detalle
                              </Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem asChild>
                              <Link to={`/vehiculo/${r.id}`}>
                                <Eye className="h-4 w-4" /> Vista pública
                              </Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem asChild>
                              <Link to={`/my-vehicles/${r.id}/editar`}>
                                <Pencil className="h-4 w-4" /> Editar
                              </Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => togglePause(r)}>
                              {r.available ? (
                                <><PauseCircle className="h-4 w-4" /> Pausar</>
                              ) : (
                                <><PlayCircle className="h-4 w-4" /> Reanudar</>
                              )}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            {r.active ? (
                              <DropdownMenuItem onClick={() => setActive(r, false)}>
                                <AlertCircle className="h-4 w-4" /> Desactivar
                              </DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem onClick={() => setActive(r, true)}>
                                <PlayCircle className="h-4 w-4" /> Reactivar
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem onClick={() => contactOwner(r)}>
                              <MessageSquare className="h-4 w-4" /> Contactar dueño
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Bulk: status */}
      <Dialog open={bulkOpen === "status"} onOpenChange={(o) => !o && setBulkOpen(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cambiar estado de {selectedIds.length} vehículos</DialogTitle>
            <DialogDescription>
              Esta acción se aplicará a todos los vehículos seleccionados.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Nuevo estado</Label>
            <Select value={bulkStatus} onValueChange={(v: FleetStatus) => setBulkStatus(v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Activo</SelectItem>
                <SelectItem value="paused">Pausado</SelectItem>
                <SelectItem value="maintenance">En mantenimiento</SelectItem>
                <SelectItem value="inactive">Inactivo</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkOpen(null)}>Cancelar</Button>
            <Button onClick={applyBulkStatus} disabled={submitting}>Aplicar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk: price */}
      <Dialog open={bulkOpen === "price"} onOpenChange={(o) => !o && setBulkOpen(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ajustar tarifa de {selectedIds.length} vehículos</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>Modo</Label>
              <Select value={priceMode} onValueChange={(v: any) => setPriceMode(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="delta_pct">Variación porcentual (%)</SelectItem>
                  <SelectItem value="set">Establecer tarifa fija ($)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{priceMode === "delta_pct" ? "Porcentaje (ej. 10 o -5)" : "Nuevo precio diario ($)"}</Label>
              <Input
                type="number"
                value={priceValue}
                onChange={(e) => setPriceValue(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkOpen(null)}>Cancelar</Button>
            <Button onClick={applyBulkPrice} disabled={submitting}>Aplicar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk: maintenance */}
      <Dialog open={bulkOpen === "maintenance"} onOpenChange={(o) => !o && setBulkOpen(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Programar inspección para {selectedIds.length} vehículos</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Input value={maintType} onChange={(e) => setMaintType(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Fecha</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start">
                    {maintDate ? format(maintDate, "PPP", { locale: es }) : "Seleccionar fecha"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="start" className="p-0">
                  <Calendar mode="single" selected={maintDate} onSelect={setMaintDate} />
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-2">
              <Label>Notas (opcional)</Label>
              <Input value={maintNotes} onChange={(e) => setMaintNotes(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkOpen(null)}>Cancelar</Button>
            <Button onClick={applyBulkMaintenance} disabled={submitting}>Programar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
