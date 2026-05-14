import { useEffect, useMemo, useState } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { format, differenceInDays, parseISO } from "date-fns";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Plus,
  Wrench,
  ClipboardCheck,
  RefreshCw,
} from "lucide-react";

type Vehicle = { id: string; brand: string; model: string; year: number };

type MaintenanceRow = {
  id: string;
  vehicle_id: string;
  type: string;
  category: string;
  inspection_type: string | null;
  inspector_name: string | null;
  workshop: string | null;
  cost: number | null;
  scheduled_date: string;
  next_date: string | null;
  status: string;
  severity: string | null;
  problems: string | null;
  notes: string | null;
  result: string | null;
  checklist: Record<string, boolean>;
  photos: string[];
  signature: string | null;
  completed_at: string | null;
  created_at: string;
  mileage: number | null;
};

const CHECKLIST_ITEMS = [
  "Estado general",
  "Llantas",
  "Luces",
  "Frenos",
  "Interior",
  "Motor",
  "Niveles de fluidos",
  "Documentación",
];

const INSPECTION_TYPES = ["Rutinaria", "Pre-alquiler", "Post-alquiler", "Por daño"];
const CATEGORIES = [
  { value: "inspection", label: "Inspección" },
  { value: "repair", label: "Reparación" },
  { value: "maintenance", label: "Mantenimiento" },
];

export default function AdminMaintenancePage() {
  const [rows, setRows] = useState<MaintenanceRow[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [resultRow, setResultRow] = useState<MaintenanceRow | null>(null);

  async function load() {
    setLoading(true);
    const [{ data: m }, { data: v }] = await Promise.all([
      supabase
        .from("vehicle_maintenance")
        .select("*")
        .order("scheduled_date", { ascending: false }),
      supabase.from("vehicles").select("id,brand,model,year").eq("active", true),
    ]);
    setRows((m || []) as any);
    setVehicles((v || []) as any);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  const vehicleName = (id: string) => {
    const v = vehicles.find((x) => x.id === id);
    return v ? `${v.brand} ${v.model} ${v.year}` : "—";
  };

  const pending = rows.filter((r) => r.status === "scheduled");
  const inProgress = rows.filter((r) => r.status === "in_progress");
  const completedThisWeek = rows.filter(
    (r) =>
      r.status === "completed" &&
      r.completed_at &&
      differenceInDays(new Date(), new Date(r.completed_at)) <= 7,
  );

  const alerts = useMemo(() => {
    const today = new Date();
    return rows
      .map((r) => {
        const due = parseISO(r.scheduled_date);
        const days = differenceInDays(due, today);
        if (r.status === "scheduled" && days <= 5 && days >= 0)
          return { row: r, kind: "soon" as const, days };
        if (r.status === "scheduled" && days < 0)
          return { row: r, kind: "late" as const, days };
        if (r.category === "repair" && r.status !== "completed")
          return { row: r, kind: "repair" as const, days };
        return null;
      })
      .filter(Boolean) as { row: MaintenanceRow; kind: "soon" | "late" | "repair"; days: number }[];
  }, [rows]);

  async function updateStatus(id: string, status: string, extra: Partial<MaintenanceRow> = {}) {
    const patch: any = { status, ...extra };
    if (status === "completed") patch.completed_at = new Date().toISOString();
    const { error } = await supabase.from("vehicle_maintenance").update(patch).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Actualizado");
    load();
  }

  return (
    <AdminLayout title="Inspecciones & Mantenimiento">
      <div className="space-y-6">
        {/* Alerts */}
        {alerts.length > 0 && (
          <Card className="border-warning/40">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-warning" />
                Alertas ({alerts.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {alerts.slice(0, 6).map((a, i) => (
                <div key={i} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    {a.kind === "late" && <Badge variant="destructive">Atrasado</Badge>}
                    {a.kind === "soon" && <Badge>Vence en {a.days}d</Badge>}
                    {a.kind === "repair" && <Badge variant="secondary">Reparación pend.</Badge>}
                    <span>{vehicleName(a.row.vehicle_id)}</span>
                    <span className="text-muted-foreground">— {a.row.type}</span>
                  </div>
                  <span className="text-muted-foreground">{a.row.scheduled_date}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        <div className="flex items-center justify-between">
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={load} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
              Actualizar
            </Button>
          </div>
          <CreateDialog
            open={createOpen}
            onOpenChange={setCreateOpen}
            vehicles={vehicles}
            onCreated={load}
          />
        </div>

        <Tabs defaultValue="kanban">
          <TabsList>
            <TabsTrigger value="kanban">
              <ClipboardCheck className="h-4 w-4 mr-2" />
              Calendario
            </TabsTrigger>
            <TabsTrigger value="history">
              <Wrench className="h-4 w-4 mr-2" />
              Historial
            </TabsTrigger>
          </TabsList>

          {/* Kanban */}
          <TabsContent value="kanban">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <KanbanColumn
                title="Pendientes"
                icon={<Clock className="h-4 w-4" />}
                items={pending}
                vehicleName={vehicleName}
                onAction={(r) => updateStatus(r.id, "in_progress")}
                actionLabel="Iniciar"
              />
              <KanbanColumn
                title="En proceso"
                icon={<Wrench className="h-4 w-4" />}
                items={inProgress}
                vehicleName={vehicleName}
                onAction={(r) => setResultRow(r)}
                actionLabel="Completar"
              />
              <KanbanColumn
                title="Completadas (esta semana)"
                icon={<CheckCircle2 className="h-4 w-4 text-success" />}
                items={completedThisWeek}
                vehicleName={vehicleName}
              />
            </div>
          </TabsContent>

          {/* History */}
          <TabsContent value="history">
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Auto</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Descripción</TableHead>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Taller</TableHead>
                      <TableHead>Costo</TableHead>
                      <TableHead>Km</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Próximo</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell className="font-medium">{vehicleName(r.vehicle_id)}</TableCell>
                        <TableCell className="capitalize">
                          {CATEGORIES.find((c) => c.value === r.category)?.label || r.category}
                        </TableCell>
                        <TableCell className="max-w-xs truncate">
                          {r.type}
                          {r.notes ? ` — ${r.notes}` : ""}
                        </TableCell>
                        <TableCell>{r.scheduled_date}</TableCell>
                        <TableCell>{r.workshop || "—"}</TableCell>
                        <TableCell>{r.cost ? `$${r.cost}` : "—"}</TableCell>
                        <TableCell>{r.mileage != null ? `${r.mileage.toLocaleString()} km` : "—"}</TableCell>
                        <TableCell>
                          <StatusBadge status={r.status} />
                        </TableCell>
                        <TableCell>{r.next_date || "—"}</TableCell>
                      </TableRow>
                    ))}
                    {rows.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                          Sin registros
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {resultRow && (
          <ResultDialog
            row={resultRow}
            onClose={() => setResultRow(null)}
            onSave={async (patch) => {
              await updateStatus(resultRow.id, "completed", patch);
              setResultRow(null);
            }}
          />
        )}
      </div>
    </AdminLayout>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; variant: any }> = {
    scheduled: { label: "Pendiente", variant: "secondary" },
    in_progress: { label: "En proceso", variant: "default" },
    completed: { label: "Completado", variant: "outline" },
  };
  const s = map[status] || { label: status, variant: "secondary" };
  return <Badge variant={s.variant}>{s.label}</Badge>;
}

function KanbanColumn({
  title,
  icon,
  items,
  vehicleName,
  onAction,
  actionLabel,
}: {
  title: string;
  icon: React.ReactNode;
  items: MaintenanceRow[];
  vehicleName: (id: string) => string;
  onAction?: (r: MaintenanceRow) => void;
  actionLabel?: string;
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          {icon}
          {title} ({items.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {items.length === 0 && (
          <p className="text-xs text-muted-foreground">Vacío</p>
        )}
        {items.map((r) => (
          <div key={r.id} className="border rounded-md p-3 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="font-medium text-sm">{vehicleName(r.vehicle_id)}</span>
              {r.severity && (
                <Badge
                  variant={
                    r.severity === "Mayor"
                      ? "destructive"
                      : r.severity === "Medio"
                      ? "default"
                      : "secondary"
                  }
                >
                  {r.severity}
                </Badge>
              )}
            </div>
            <div className="text-xs text-muted-foreground">{r.type}</div>
            <div className="text-xs">
              {r.status === "completed" && r.result ? (
                <span>Resultado: {r.result}</span>
              ) : r.inspector_name ? (
                <span>Inspector: {r.inspector_name}</span>
              ) : (
                <span>Vence: {r.scheduled_date}</span>
              )}
            </div>
            {onAction && actionLabel && (
              <Button size="sm" variant="outline" className="w-full mt-1" onClick={() => onAction(r)}>
                {actionLabel}
              </Button>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function CreateDialog({
  open,
  onOpenChange,
  vehicles,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (b: boolean) => void;
  vehicles: Vehicle[];
  onCreated: () => void;
}) {
  const [form, setForm] = useState({
    vehicle_id: "",
    category: "inspection",
    inspection_type: "Rutinaria",
    type: "",
    inspector_name: "",
    workshop: "",
    scheduled_date: format(new Date(), "yyyy-MM-dd"),
    next_date: "",
    cost: "",
    mileage: "",
    notes: "",
  });
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (!form.vehicle_id || !form.scheduled_date) {
      return toast.error("Auto y fecha son requeridos");
    }
    setSaving(true);
    const { error } = await supabase.from("vehicle_maintenance").insert({
      vehicle_id: form.vehicle_id,
      category: form.category,
      inspection_type: form.category === "inspection" ? form.inspection_type : null,
      type: form.type || form.inspection_type || "Mantenimiento",
      inspector_name: form.inspector_name || null,
      workshop: form.workshop || null,
      scheduled_date: form.scheduled_date,
      next_date: form.next_date || null,
      cost: form.cost ? Number(form.cost) : null,
      mileage: form.mileage ? Number(form.mileage) : null,
      notes: form.notes || null,
      status: "scheduled",
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Programado");
    onOpenChange(false);
    onCreated();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="h-4 w-4 mr-2" />
          Nueva inspección / mantenimiento
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Programar</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Auto</Label>
            <Select value={form.vehicle_id} onValueChange={(v) => setForm({ ...form, vehicle_id: v })}>
              <SelectTrigger><SelectValue placeholder="Selecciona vehículo" /></SelectTrigger>
              <SelectContent>
                {vehicles.map((v) => (
                  <SelectItem key={v.id} value={v.id}>{v.brand} {v.model} {v.year}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Categoría</Label>
              <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {form.category === "inspection" ? (
              <div>
                <Label>Tipo de inspección</Label>
                <Select value={form.inspection_type} onValueChange={(v) => setForm({ ...form, inspection_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {INSPECTION_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div>
                <Label>Descripción</Label>
                <Input value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} placeholder="Ej: Cambio de aceite" />
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Inspector / Responsable</Label>
              <Input value={form.inspector_name} onChange={(e) => setForm({ ...form, inspector_name: e.target.value })} />
            </div>
            <div>
              <Label>Taller</Label>
              <Input value={form.workshop} onChange={(e) => setForm({ ...form, workshop: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Fecha</Label>
              <Input type="date" value={form.scheduled_date} onChange={(e) => setForm({ ...form, scheduled_date: e.target.value })} />
            </div>
            <div>
              <Label>Próxima</Label>
              <Input type="date" value={form.next_date} onChange={(e) => setForm({ ...form, next_date: e.target.value })} />
            </div>
            <div>
              <Label>Costo (USD)</Label>
              <Input type="number" value={form.cost} onChange={(e) => setForm({ ...form, cost: e.target.value })} />
            </div>
            <div>
              <Label>Kilometraje (km)</Label>
              <Input type="number" inputMode="numeric" value={form.mileage} onChange={(e) => setForm({ ...form, mileage: e.target.value })} placeholder="0" />
            </div>
          </div>
          <div>
            <Label>Notas</Label>
            <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={submit} disabled={saving}>Programar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ResultDialog({
  row,
  onClose,
  onSave,
}: {
  row: MaintenanceRow;
  onClose: () => void;
  onSave: (patch: Partial<MaintenanceRow>) => Promise<void>;
}) {
  const [checklist, setChecklist] = useState<Record<string, boolean>>(row.checklist || {});
  const [problems, setProblems] = useState(row.problems || "");
  const [severity, setSeverity] = useState(row.severity || "Menor");
  const [result, setResult] = useState(row.result || "Sin problemas");
  const [signature, setSignature] = useState(row.signature || "");
  const [cost, setCost] = useState(row.cost?.toString() || "");
  const [mileage, setMileage] = useState(row.mileage?.toString() || "");
  const [saving, setSaving] = useState(false);

  async function submit() {
    setSaving(true);
    await onSave({
      checklist,
      problems: problems || null,
      severity: problems ? severity : null,
      result,
      signature: signature || null,
      cost: cost ? Number(cost) : null,
      mileage: mileage ? Number(mileage) : null,
    } as any);
    setSaving(false);
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Resultado de inspección</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="mb-2 block">Checklist</Label>
            <div className="grid grid-cols-2 gap-2">
              {CHECKLIST_ITEMS.map((item) => (
                <label key={item} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={!!checklist[item]}
                    onCheckedChange={(v) => setChecklist({ ...checklist, [item]: !!v })}
                  />
                  {item}
                </label>
              ))}
            </div>
          </div>
          <div>
            <Label>Problemas encontrados</Label>
            <Textarea value={problems} onChange={(e) => setProblems(e.target.value)} rows={2} placeholder="Ej: Llanta delantera baja, luz trasera..." />
          </div>
          {problems && (
            <div>
              <Label>Severidad</Label>
              <Select value={severity} onValueChange={setSeverity}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Menor">Menor</SelectItem>
                  <SelectItem value="Medio">Medio</SelectItem>
                  <SelectItem value="Mayor">Mayor</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label>Resultado</Label>
              <Input value={result} onChange={(e) => setResult(e.target.value)} />
            </div>
            <div>
              <Label>Costo (USD)</Label>
              <Input type="number" value={cost} onChange={(e) => setCost(e.target.value)} />
            </div>
            <div>
              <Label>Kilometraje (km)</Label>
              <Input type="number" inputMode="numeric" value={mileage} onChange={(e) => setMileage(e.target.value)} placeholder="0" />
            </div>
          </div>
          <div>
            <Label>Firma del inspector</Label>
            <Input value={signature} onChange={(e) => setSignature(e.target.value)} placeholder="Nombre del inspector" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={submit} disabled={saving}>Marcar completada</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
