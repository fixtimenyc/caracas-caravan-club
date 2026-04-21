import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import Navbar from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { ShieldCheck, ShieldOff, Search, Users } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type AppRole = "renter" | "owner" | "admin";

interface UserRow {
  user_id: string;
  full_name: string | null;
  phone: string | null;
  cedula: string | null;
  verified: boolean;
  created_at: string;
  roles: AppRole[];
  vehicle_count: number;
}

const roleLabel: Record<AppRole, string> = {
  renter: "Arrendatario",
  owner: "Aliado",
  admin: "Admin",
};

const AdminUsersPage = () => {
  const { user, roles, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [search, setSearch] = useState("");
  const [filterRole, setFilterRole] = useState<"all" | AppRole>("all");
  const [pendingAction, setPendingAction] = useState<{
    user: UserRow;
    role: AppRole;
    action: "add" | "remove";
  } | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user || !roles.includes("admin")) {
      navigate("/");
      return;
    }
    loadUsers();
  }, [user, roles, authLoading]);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const [profilesRes, rolesRes, vehiclesRes] = await Promise.all([
        supabase.from("profiles").select("*").order("created_at", { ascending: false }),
        supabase.from("user_roles").select("user_id, role"),
        supabase.from("vehicles").select("owner_id"),
      ]);

      if (profilesRes.error) throw profilesRes.error;
      if (rolesRes.error) throw rolesRes.error;
      if (vehiclesRes.error) throw vehiclesRes.error;

      const rolesByUser = new Map<string, AppRole[]>();
      (rolesRes.data || []).forEach((r: any) => {
        const arr = rolesByUser.get(r.user_id) || [];
        arr.push(r.role);
        rolesByUser.set(r.user_id, arr);
      });

      const vehiclesByOwner = new Map<string, number>();
      (vehiclesRes.data || []).forEach((v: any) => {
        vehiclesByOwner.set(v.owner_id, (vehiclesByOwner.get(v.owner_id) || 0) + 1);
      });

      const rows: UserRow[] = (profilesRes.data || []).map((p: any) => ({
        user_id: p.user_id,
        full_name: p.full_name,
        phone: p.phone,
        cedula: p.cedula,
        verified: p.verified,
        created_at: p.created_at,
        roles: rolesByUser.get(p.user_id) || [],
        vehicle_count: vehiclesByOwner.get(p.user_id) || 0,
      }));

      setUsers(rows);
    } catch (e: any) {
      toast.error("Error cargando usuarios: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  const confirmAction = async () => {
    if (!pendingAction) return;
    const { user: u, role, action } = pendingAction;
    try {
      if (action === "add") {
        const { error } = await supabase
          .from("user_roles")
          .insert({ user_id: u.user_id, role });
        if (error) throw error;
        toast.success(`Rol ${roleLabel[role]} asignado`);
      } else {
        const { error } = await supabase
          .from("user_roles")
          .delete()
          .eq("user_id", u.user_id)
          .eq("role", role);
        if (error) throw error;
        toast.success(`Rol ${roleLabel[role]} removido`);
      }
      await loadUsers();
    } catch (e: any) {
      toast.error("Error: " + e.message);
    } finally {
      setPendingAction(null);
    }
  };

  const toggleVerified = async (u: UserRow) => {
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ verified: !u.verified })
        .eq("user_id", u.user_id);
      if (error) throw error;
      toast.success(u.verified ? "Verificación removida" : "Usuario verificado");
      await loadUsers();
    } catch (e: any) {
      toast.error("Error: " + e.message);
    }
  };

  const filtered = users.filter((u) => {
    const q = search.toLowerCase().trim();
    const matchesSearch =
      !q ||
      (u.full_name || "").toLowerCase().includes(q) ||
      (u.cedula || "").toLowerCase().includes(q) ||
      (u.phone || "").toLowerCase().includes(q);
    const matchesRole =
      filterRole === "all" ||
      (filterRole === "renter"
        ? u.roles.length === 0 || u.roles.includes("renter")
        : u.roles.includes(filterRole));
    return matchesSearch && matchesRole;
  });

  const stats = {
    total: users.length,
    owners: users.filter((u) => u.roles.includes("owner")).length,
    admins: users.filter((u) => u.roles.includes("admin")).length,
    renters: users.filter((u) => !u.roles.includes("owner") && !u.roles.includes("admin")).length,
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container mx-auto px-4 pt-24 pb-12">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-gradient-hero flex items-center justify-center">
            <Users className="w-5 h-5 text-primary-foreground" />
          </div>
          <h1 className="text-3xl font-bold">Administrar usuarios</h1>
        </div>
        <p className="text-muted-foreground mb-6">
          Gestiona aliados, arrendatarios y administradores de RuedaVe.
        </p>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="p-4 rounded-xl border bg-card">
            <p className="text-xs text-muted-foreground">Total</p>
            <p className="text-2xl font-bold">{stats.total}</p>
          </div>
          <div className="p-4 rounded-xl border bg-card">
            <p className="text-xs text-muted-foreground">Aliados</p>
            <p className="text-2xl font-bold text-accent-foreground">{stats.owners}</p>
          </div>
          <div className="p-4 rounded-xl border bg-card">
            <p className="text-xs text-muted-foreground">Arrendatarios</p>
            <p className="text-2xl font-bold text-primary">{stats.renters}</p>
          </div>
          <div className="p-4 rounded-xl border bg-card">
            <p className="text-xs text-muted-foreground">Admins</p>
            <p className="text-2xl font-bold text-destructive">{stats.admins}</p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col md:flex-row gap-3 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nombre, cédula o teléfono..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={filterRole} onValueChange={(v: any) => setFilterRole(v)}>
            <SelectTrigger className="md:w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los roles</SelectItem>
              <SelectItem value="renter">Arrendatarios</SelectItem>
              <SelectItem value="owner">Aliados</SelectItem>
              <SelectItem value="admin">Admins</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        <div className="rounded-xl border bg-card overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Usuario</TableHead>
                <TableHead>Contacto</TableHead>
                <TableHead>Roles</TableHead>
                <TableHead>Vehículos</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    Cargando...
                  </TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    No se encontraron usuarios.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((u) => {
                  const isOwner = u.roles.includes("owner");
                  const isAdmin = u.roles.includes("admin");
                  return (
                    <TableRow key={u.user_id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{u.full_name || "Sin nombre"}</p>
                          <p className="text-xs text-muted-foreground">
                            {u.cedula ? `CI: ${u.cedula}` : "Sin cédula"}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {u.phone || "—"}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {isAdmin && <Badge variant="destructive">Admin</Badge>}
                          {isOwner && <Badge className="bg-accent text-accent-foreground">Aliado</Badge>}
                          {!isAdmin && !isOwner && <Badge variant="secondary">Arrendatario</Badge>}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">{u.vehicle_count}</TableCell>
                      <TableCell>
                        {u.verified ? (
                          <Badge variant="outline" className="text-primary border-primary">
                            Verificado
                          </Badge>
                        ) : (
                          <Badge variant="outline">Sin verificar</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2 flex-wrap">
                          <Button size="sm" variant="outline" onClick={() => toggleVerified(u)}>
                            {u.verified ? "Desverificar" : "Verificar"}
                          </Button>
                          {isOwner ? (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                setPendingAction({ user: u, role: "owner", action: "remove" })
                              }
                            >
                              <ShieldOff className="w-3 h-3 mr-1" />
                              Quitar aliado
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                setPendingAction({ user: u, role: "owner", action: "add" })
                              }
                            >
                              <ShieldCheck className="w-3 h-3 mr-1" />
                              Hacer aliado
                            </Button>
                          )}
                          {u.user_id !== user?.id && (
                            isAdmin ? (
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() =>
                                  setPendingAction({ user: u, role: "admin", action: "remove" })
                                }
                              >
                                Quitar admin
                              </Button>
                            ) : (
                              <Button
                                size="sm"
                                variant="default"
                                onClick={() =>
                                  setPendingAction({ user: u, role: "admin", action: "add" })
                                }
                              >
                                Hacer admin
                              </Button>
                            )
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </main>

      <AlertDialog open={!!pendingAction} onOpenChange={(o) => !o && setPendingAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar cambio de rol</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingAction && (
                <>
                  ¿Seguro que deseas{" "}
                  <strong>
                    {pendingAction.action === "add" ? "asignar" : "remover"} el rol{" "}
                    {roleLabel[pendingAction.role]}
                  </strong>{" "}
                  {pendingAction.action === "add" ? "a" : "de"}{" "}
                  <strong>{pendingAction.user.full_name || "este usuario"}</strong>?
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmAction}>Confirmar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AdminUsersPage;
