import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  LifeBuoy,
  Loader2,
  Mail,
  Search,
  AlertCircle,
  CheckCircle2,
  Clock,
  MessageSquare,
} from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
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
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Ticket = {
  id: string;
  user_id: string | null;
  name: string;
  email: string;
  subject: string;
  category: "reservas" | "pagos" | "aliados" | "cuenta" | "seguridad" | "otro";
  message: string;
  status: "open" | "in_progress" | "resolved" | "closed";
  admin_response: string | null;
  responded_at: string | null;
  created_at: string;
};

const statusMeta: Record<
  Ticket["status"],
  { label: string; className: string; icon: typeof Clock }
> = {
  open: {
    label: "Abierto",
    className: "bg-accent/20 text-accent-foreground",
    icon: AlertCircle,
  },
  in_progress: {
    label: "En progreso",
    className: "bg-primary/20 text-primary",
    icon: Clock,
  },
  resolved: {
    label: "Resuelto",
    className: "bg-primary text-primary-foreground",
    icon: CheckCircle2,
  },
  closed: {
    label: "Cerrado",
    className: "bg-muted text-muted-foreground",
    icon: CheckCircle2,
  },
};

const AdminSupportPage = () => {
  const { user, roles, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selected, setSelected] = useState<Ticket | null>(null);
  const [response, setResponse] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!authLoading && (!user || !roles.includes("admin"))) {
      navigate("/");
    }
  }, [authLoading, user, roles, navigate]);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("support_tickets")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) toast.error("Error cargando tickets");
    setTickets((data || []) as Ticket[]);
    setLoading(false);
  };

  useEffect(() => {
    if (user && roles.includes("admin")) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, roles]);

  const stats = useMemo(() => {
    return {
      total: tickets.length,
      open: tickets.filter((t) => t.status === "open").length,
      inProgress: tickets.filter((t) => t.status === "in_progress").length,
      resolved: tickets.filter((t) => t.status === "resolved").length,
    };
  }, [tickets]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return tickets.filter((t) => {
      if (statusFilter !== "all" && t.status !== statusFilter) return false;
      if (!term) return true;
      return (
        t.name.toLowerCase().includes(term) ||
        t.email.toLowerCase().includes(term) ||
        t.subject.toLowerCase().includes(term)
      );
    });
  }, [tickets, search, statusFilter]);

  const openTicket = (t: Ticket) => {
    setSelected(t);
    setResponse(t.admin_response || "");
  };

  const updateStatus = async (status: Ticket["status"]) => {
    if (!selected) return;
    const { error } = await supabase
      .from("support_tickets")
      .update({ status })
      .eq("id", selected.id);
    if (error) {
      toast.error("No se pudo actualizar");
      return;
    }
    toast.success("Estado actualizado");
    setTickets((prev) =>
      prev.map((t) => (t.id === selected.id ? { ...t, status } : t))
    );
    setSelected({ ...selected, status });
  };

  const saveResponse = async () => {
    if (!selected || !user) return;
    if (response.trim().length < 5) {
      toast.error("La respuesta es muy corta");
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from("support_tickets")
      .update({
        admin_response: response.trim(),
        responded_by: user.id,
        responded_at: new Date().toISOString(),
        status: "resolved",
      })
      .eq("id", selected.id);
    setSaving(false);
    if (error) {
      toast.error("No se pudo guardar la respuesta");
      return;
    }
    toast.success("Respuesta guardada");
    const updated: Ticket = {
      ...selected,
      admin_response: response.trim(),
      responded_at: new Date().toISOString(),
      status: "resolved",
    };
    setTickets((prev) => prev.map((t) => (t.id === selected.id ? updated : t)));
    setSelected(updated);
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container mx-auto px-4 pt-24 pb-12">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
            <LifeBuoy className="w-5 h-5 text-primary" />
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-foreground">
            Tickets de soporte
          </h1>
        </div>
        <p className="text-muted-foreground mb-8">
          Gestiona los mensajes que envían los usuarios desde el centro de ayuda.
        </p>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <Card className="p-5">
            <p className="text-sm text-muted-foreground">Total</p>
            <p className="text-2xl font-bold text-foreground">{stats.total}</p>
          </Card>
          <Card className="p-5">
            <p className="text-sm text-muted-foreground">Abiertos</p>
            <p className="text-2xl font-bold text-foreground">{stats.open}</p>
          </Card>
          <Card className="p-5">
            <p className="text-sm text-muted-foreground">En progreso</p>
            <p className="text-2xl font-bold text-foreground">
              {stats.inProgress}
            </p>
          </Card>
          <Card className="p-5">
            <p className="text-sm text-muted-foreground">Resueltos</p>
            <p className="text-2xl font-bold text-foreground">
              {stats.resolved}
            </p>
          </Card>
        </div>

        {/* Filtros */}
        <Card className="p-4 mb-6 flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nombre, correo o asunto…"
              className="pl-9"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="md:w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los estados</SelectItem>
              <SelectItem value="open">Abierto</SelectItem>
              <SelectItem value="in_progress">En progreso</SelectItem>
              <SelectItem value="resolved">Resuelto</SelectItem>
              <SelectItem value="closed">Cerrado</SelectItem>
            </SelectContent>
          </Select>
        </Card>

        {/* Tabla */}
        <Card className="overflow-hidden">
          {loading ? (
            <div className="py-16 flex justify-center">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-16 text-center text-muted-foreground">
              <MessageSquare className="w-10 h-10 mx-auto mb-3 opacity-40" />
              No hay tickets que coincidan.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Solicitante</TableHead>
                  <TableHead>Asunto</TableHead>
                  <TableHead>Categoría</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead className="text-right">Acción</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((t) => {
                  const meta = statusMeta[t.status];
                  const Icon = meta.icon;
                  return (
                    <TableRow key={t.id}>
                      <TableCell>
                        <p className="font-medium text-foreground">{t.name}</p>
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <Mail className="w-3 h-3" /> {t.email}
                        </p>
                      </TableCell>
                      <TableCell className="max-w-xs truncate">
                        {t.subject}
                      </TableCell>
                      <TableCell className="capitalize">{t.category}</TableCell>
                      <TableCell>
                        <Badge
                          className={`${meta.className} gap-1`}
                          variant="secondary"
                        >
                          <Icon className="w-3 h-3" />
                          {meta.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {format(new Date(t.created_at), "d MMM yyyy", {
                          locale: es,
                        })}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openTicket(t)}
                        >
                          Ver
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </Card>
      </main>

      {/* Detalle */}
      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-2xl">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle>{selected.subject}</DialogTitle>
                <DialogDescription>
                  De {selected.name} · {selected.email} ·{" "}
                  {format(new Date(selected.created_at), "PPP", { locale: es })}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <div>
                  <p className="text-sm font-semibold mb-1 text-foreground">
                    Mensaje
                  </p>
                  <Card className="p-4 bg-muted/30">
                    <p className="text-sm whitespace-pre-wrap leading-relaxed">
                      {selected.message}
                    </p>
                  </Card>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-sm font-semibold text-foreground">
                      Respuesta interna
                    </p>
                    <Select
                      value={selected.status}
                      onValueChange={(v) =>
                        updateStatus(v as Ticket["status"])
                      }
                    >
                      <SelectTrigger className="w-40 h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="open">Abierto</SelectItem>
                        <SelectItem value="in_progress">
                          En progreso
                        </SelectItem>
                        <SelectItem value="resolved">Resuelto</SelectItem>
                        <SelectItem value="closed">Cerrado</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Textarea
                    rows={5}
                    value={response}
                    onChange={(e) => setResponse(e.target.value)}
                    placeholder="Escribe tu respuesta…"
                    maxLength={2000}
                  />
                  {selected.responded_at && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Última respuesta:{" "}
                      {format(new Date(selected.responded_at), "PPpp", {
                        locale: es,
                      })}
                    </p>
                  )}
                </div>
              </div>

              <DialogFooter className="flex-col sm:flex-row gap-2">
                <Button
                  variant="outline"
                  className="gap-2"
                  onClick={() =>
                    window.open(
                      `mailto:${selected.email}?subject=Re: ${encodeURIComponent(
                        selected.subject
                      )}`,
                      "_blank"
                    )
                  }
                >
                  <Mail className="w-4 h-4" />
                  Responder por correo
                </Button>
                <Button onClick={saveResponse} disabled={saving}>
                  {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Guardar como resuelto
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Footer />
    </div>
  );
};

export default AdminSupportPage;
