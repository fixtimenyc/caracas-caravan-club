import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { Plus, Pencil, Trash2, Search, Star, Building2, Smartphone, CreditCard, DollarSign, Wallet } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type Method = {
  id: string;
  owner_id: string;
  method_type: string;
  bank_name: string | null;
  account_holder: string | null;
  holder_document: string | null;
  account_number: string | null;
  account_type: string | null;
  currency: string;
  email: string | null;
  phone: string | null;
  notes: string | null;
  is_primary: boolean;
  created_at: string;
  updated_at: string;
};

type OwnerLite = { user_id: string; full_name: string | null; phone: string | null };

const METHOD_TYPES = [
  { value: "bank_transfer", label: "Transferencia bancaria", icon: Building2 },
  { value: "pago_movil", label: "Pago Móvil", icon: Smartphone },
  { value: "zelle", label: "Zelle", icon: DollarSign },
  { value: "paypal", label: "PayPal", icon: Wallet },
  { value: "binance", label: "Binance Pay", icon: CreditCard },
  { value: "cash", label: "Efectivo", icon: DollarSign },
  { value: "other", label: "Otro", icon: Wallet },
];

const CURRENCIES = ["VES", "USD", "USDT", "EUR"];
const ACCOUNT_TYPES = ["Corriente", "Ahorro"];

const methodLabel = (v: string) => METHOD_TYPES.find((m) => m.value === v)?.label || v;
const methodIcon = (v: string) => METHOD_TYPES.find((m) => m.value === v)?.icon || Wallet;

export default function PayoutMethodsTab() {
  const [loading, setLoading] = useState(true);
  const [methods, setMethods] = useState<Method[]>([]);
  const [owners, setOwners] = useState<OwnerLite[]>([]);
  const [search, setSearch] = useState("");
  const [typeF, setTypeF] = useState("all");
  const [editing, setEditing] = useState<Partial<Method> | null>(null);
  const [deleting, setDeleting] = useState<Method | null>(null);

  const load = async () => {
    setLoading(true);
    const [mRes, oRes] = await Promise.all([
      (supabase as any).from("owner_payout_methods").select("*").order("created_at", { ascending: false }),
      supabase.from("user_roles").select("user_id").eq("role", "owner"),
    ]);
    const ownerIds = (oRes.data || []).map((r: any) => r.user_id);
    let profs: OwnerLite[] = [];
    if (ownerIds.length) {
      const { data } = await supabase.from("profiles").select("user_id, full_name, phone").in("user_id", ownerIds);
      profs = (data as any) || [];
    }
    setMethods((mRes.data as any) || []);
    setOwners(profs);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const ownerMap = useMemo(() => Object.fromEntries(owners.map((o) => [o.user_id, o])), [owners]);

  const grouped = useMemo(() => {
    const map: Record<string, Method[]> = {};
    methods.forEach((m) => {
      if (typeF !== "all" && m.method_type !== typeF) return;
      const owner = ownerMap[m.owner_id];
      const hay = `${owner?.full_name || ""} ${m.bank_name || ""} ${m.account_holder || ""} ${m.account_number || ""} ${m.email || ""} ${m.phone || ""}`.toLowerCase();
      if (search && !hay.includes(search.toLowerCase())) return;
      (map[m.owner_id] = map[m.owner_id] || []).push(m);
    });
    return Object.entries(map).map(([owner_id, items]) => ({
      owner_id,
      owner: ownerMap[owner_id],
      items,
    }));
  }, [methods, ownerMap, search, typeF]);

  const ownersWithoutMethod = useMemo(() => {
    const has = new Set(methods.map((m) => m.owner_id));
    return owners.filter((o) => !has.has(o.user_id));
  }, [owners, methods]);

  const save = async () => {
    if (!editing?.owner_id || !editing.method_type) {
      toast({ title: "Faltan datos", description: "Selecciona dueño y método", variant: "destructive" });
      return;
    }
    const payload: any = {
      owner_id: editing.owner_id,
      method_type: editing.method_type,
      bank_name: editing.bank_name || null,
      account_holder: editing.account_holder || null,
      holder_document: editing.holder_document || null,
      account_number: editing.account_number || null,
      account_type: editing.account_type || null,
      currency: editing.currency || "VES",
      email: editing.email || null,
      phone: editing.phone || null,
      notes: editing.notes || null,
      is_primary: !!editing.is_primary,
    };
    let error;
    if (editing.id) {
      ({ error } = await (supabase as any).from("owner_payout_methods").update(payload).eq("id", editing.id));
    } else {
      ({ error } = await (supabase as any).from("owner_payout_methods").insert(payload));
    }
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    if (editing.is_primary) {
      // Demote other primary methods of this owner
      await (supabase as any)
        .from("owner_payout_methods")
        .update({ is_primary: false })
        .eq("owner_id", editing.owner_id)
        .neq("id", editing.id || "00000000-0000-0000-0000-000000000000");
    }
    toast({ title: editing.id ? "Método actualizado" : "Método agregado" });
    setEditing(null);
    load();
  };

  const remove = async () => {
    if (!deleting) return;
    const { error } = await (supabase as any).from("owner_payout_methods").delete().eq("id", deleting.id);
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else {
      toast({ title: "Método eliminado" });
      load();
    }
    setDeleting(null);
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar dueño, banco, cuenta..." className="pl-8" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <Select value={typeF} onValueChange={setTypeF}>
            <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los métodos</SelectItem>
              {METHOD_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button onClick={() => setEditing({ currency: "VES", method_type: "bank_transfer", is_primary: true })}>
            <Plus className="h-4 w-4 mr-2" /> Agregar método
          </Button>
        </CardContent>
      </Card>

      {ownersWithoutMethod.length > 0 && (
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardContent className="p-4">
            <p className="text-sm font-semibold text-amber-700 mb-2">
              {ownersWithoutMethod.length} {ownersWithoutMethod.length === 1 ? "dueño sin método de pago registrado" : "dueños sin método de pago registrado"}
            </p>
            <div className="flex flex-wrap gap-2">
              {ownersWithoutMethod.slice(0, 12).map((o) => (
                <Button key={o.user_id} size="sm" variant="outline" className="h-7 text-xs"
                  onClick={() => setEditing({ owner_id: o.user_id, currency: "VES", method_type: "bank_transfer", is_primary: true })}>
                  <Plus className="h-3 w-3 mr-1" />{o.full_name || o.user_id.slice(0, 8)}
                </Button>
              ))}
              {ownersWithoutMethod.length > 12 && (
                <span className="text-xs text-muted-foreground self-center">y {ownersWithoutMethod.length - 12} más…</span>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-0">
          {loading ? <Skeleton className="h-64 m-4" /> : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Dueño</TableHead>
                  <TableHead>Método</TableHead>
                  <TableHead>Detalles</TableHead>
                  <TableHead>Titular</TableHead>
                  <TableHead>Moneda</TableHead>
                  <TableHead>Actualizado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {grouped.length === 0 && (
                  <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Sin métodos registrados</TableCell></TableRow>
                )}
                {grouped.flatMap(({ owner_id, owner, items }) =>
                  items.map((m, idx) => {
                    const Icon = methodIcon(m.method_type);
                    const detail = m.method_type === "bank_transfer"
                      ? `${m.bank_name || "—"} · ${m.account_type || ""} · ${m.account_number ? "•••• " + m.account_number.slice(-4) : "—"}`
                      : m.method_type === "pago_movil"
                      ? `${m.bank_name || "—"} · ${m.phone || "—"} · CI ${m.holder_document || "—"}`
                      : m.method_type === "zelle" || m.method_type === "paypal"
                      ? m.email || "—"
                      : m.method_type === "binance"
                      ? m.email || m.phone || "—"
                      : m.notes || "—";
                    return (
                      <TableRow key={m.id}>
                        <TableCell>
                          {idx === 0 && (
                            <div className="text-sm font-medium">{owner?.full_name || owner_id.slice(0, 8)}</div>
                          )}
                          {idx === 0 && owner?.phone && (
                            <div className="text-xs text-muted-foreground">{owner.phone}</div>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="gap-1">
                            <Icon className="h-3 w-3" />{methodLabel(m.method_type)}
                            {m.is_primary && <Star className="h-3 w-3 fill-amber-500 text-amber-500 ml-1" />}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs">{detail}</TableCell>
                        <TableCell className="text-xs">{m.account_holder || "—"}{m.holder_document ? ` (${m.holder_document})` : ""}</TableCell>
                        <TableCell className="text-xs">{m.currency}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{format(new Date(m.updated_at), "dd/MM/yy")}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button size="sm" variant="ghost" onClick={() => setEditing(m)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => setDeleting(m)}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing?.id ? "Editar método de pago" : "Agregar método de pago"}</DialogTitle>
            <DialogDescription>Información usada para enviar payouts al dueño.</DialogDescription>
          </DialogHeader>
          {editing && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <Label>Dueño</Label>
                <Select value={editing.owner_id || ""} onValueChange={(v) => setEditing({ ...editing, owner_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecciona un dueño" /></SelectTrigger>
                  <SelectContent>
                    {owners.map((o) => (
                      <SelectItem key={o.user_id} value={o.user_id}>{o.full_name || o.user_id.slice(0, 8)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Tipo de método</Label>
                <Select value={editing.method_type || "bank_transfer"} onValueChange={(v) => setEditing({ ...editing, method_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {METHOD_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Moneda</Label>
                <Select value={editing.currency || "VES"} onValueChange={(v) => setEditing({ ...editing, currency: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CURRENCIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              {(editing.method_type === "bank_transfer" || editing.method_type === "pago_movil") && (
                <div className="md:col-span-2">
                  <Label>Banco</Label>
                  <Input value={editing.bank_name || ""} onChange={(e) => setEditing({ ...editing, bank_name: e.target.value })} placeholder="Banesco, Mercantil, BNC..." />
                </div>
              )}

              {editing.method_type === "bank_transfer" && (
                <>
                  <div>
                    <Label>Tipo de cuenta</Label>
                    <Select value={editing.account_type || ""} onValueChange={(v) => setEditing({ ...editing, account_type: v })}>
                      <SelectTrigger><SelectValue placeholder="Selecciona" /></SelectTrigger>
                      <SelectContent>
                        {ACCOUNT_TYPES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Número de cuenta</Label>
                    <Input value={editing.account_number || ""} onChange={(e) => setEditing({ ...editing, account_number: e.target.value })} />
                  </div>
                </>
              )}

              {editing.method_type === "pago_movil" && (
                <div>
                  <Label>Teléfono</Label>
                  <Input value={editing.phone || ""} onChange={(e) => setEditing({ ...editing, phone: e.target.value })} placeholder="0414-1234567" />
                </div>
              )}

              {(editing.method_type === "zelle" || editing.method_type === "paypal" || editing.method_type === "binance") && (
                <div className="md:col-span-2">
                  <Label>Email</Label>
                  <Input type="email" value={editing.email || ""} onChange={(e) => setEditing({ ...editing, email: e.target.value })} />
                </div>
              )}

              <div>
                <Label>Titular</Label>
                <Input value={editing.account_holder || ""} onChange={(e) => setEditing({ ...editing, account_holder: e.target.value })} />
              </div>
              <div>
                <Label>Cédula / RIF del titular</Label>
                <Input value={editing.holder_document || ""} onChange={(e) => setEditing({ ...editing, holder_document: e.target.value })} placeholder="V-12345678" />
              </div>

              <div className="md:col-span-2">
                <Label>Notas</Label>
                <Textarea rows={2} value={editing.notes || ""} onChange={(e) => setEditing({ ...editing, notes: e.target.value })} />
              </div>

              <div className="md:col-span-2 flex items-center gap-2">
                <input
                  id="is_primary"
                  type="checkbox"
                  checked={!!editing.is_primary}
                  onChange={(e) => setEditing({ ...editing, is_primary: e.target.checked })}
                />
                <Label htmlFor="is_primary" className="cursor-pointer">Marcar como método principal</Label>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancelar</Button>
            <Button onClick={save}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar método de pago?</AlertDialogTitle>
            <AlertDialogDescription>Esta acción no se puede deshacer.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={remove}>Eliminar</AlertDialogAction>
          </AlertDialogFooter>
      </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
