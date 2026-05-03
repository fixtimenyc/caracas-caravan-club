import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
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
import { Search, Users, Eye } from "lucide-react";

type AppRole = "renter" | "owner" | "admin";
type AccountStatus = "active" | "suspended" | "banned";
type VerificationFilter = "all" | "verified" | "pending";

interface UserRow {
  user_id: string;
  full_name: string | null;
  cedula: string | null;
  verified: boolean;
  account_status: AccountStatus;
  created_at: string;
  roles: AppRole[];
  bookings_count: number;
}

const AdminUsersPage = () => {
  const { user, roles, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<UserRow[]>([]);

  const search = searchParams.get("q") || "";
  const filterRole = (searchParams.get("role") || "all") as "all" | AppRole;
  const filterVerif = (searchParams.get("verif") || "all") as VerificationFilter;
  const filterStatus = (searchParams.get("status") || "all") as
    | "all"
    | AccountStatus;

  const updateParam = (key: string, val: string) => {
    const next = new URLSearchParams(searchParams);
    if (!val || val === "all" || val === "") next.delete(key);
    else next.set(key, val);
    setSearchParams(next, { replace: true });
  };

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
      const [profilesRes, rolesRes, vehiclesRes, reservationsRes] =
        await Promise.all([
          supabase
            .from("profiles")
            .select("*")
            .order("created_at", { ascending: false }),
          supabase.from("user_roles").select("user_id, role"),
          supabase.from("vehicles").select("id, owner_id"),
          supabase.from("reservations").select("renter_id, vehicle_id"),
        ]);

      if (profilesRes.error) throw profilesRes.error;
      if (rolesRes.error) throw rolesRes.error;

      const rolesByUser = new Map<string, AppRole[]>();
      (rolesRes.data || []).forEach((r: any) => {
        const arr = rolesByUser.get(r.user_id) || [];
        arr.push(r.role);
        rolesByUser.set(r.user_id, arr);
      });

      const vehicleOwner = new Map<string, string>();
      (vehiclesRes.data || []).forEach((v: any) =>
        vehicleOwner.set(v.id, v.owner_id)
      );

      const bookingsByUser = new Map<string, number>();
      (reservationsRes.data || []).forEach((r: any) => {
        bookingsByUser.set(
          r.renter_id,
          (bookingsByUser.get(r.renter_id) || 0) + 1
        );
        const owner = vehicleOwner.get(r.vehicle_id);
        if (owner)
          bookingsByUser.set(owner, (bookingsByUser.get(owner) || 0) + 1);
      });

      const rows: UserRow[] = (profilesRes.data || []).map((p: any) => ({
        user_id: p.user_id,
        full_name: p.full_name,
        cedula: p.cedula,
        verified: p.verified,
        account_status: (p.account_status || "active") as AccountStatus,
        created_at: p.created_at,
        roles: rolesByUser.get(p.user_id) || [],
        bookings_count: bookingsByUser.get(p.user_id) || 0,
      }));

      setUsers(rows);
    } catch (e: any) {
      toast.error("Error cargando usuarios: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  const roleLabel = (r: AppRole[]) => {
    const isOwner = r.includes("owner");
    const isRenter = !r.includes("owner") && !r.includes("admin");
    if (r.includes("admin")) return <Badge variant="destructive">Admin</Badge>;
    if (isOwner && r.includes("renter"))
      return <Badge className="bg-accent text-accent-foreground">Ambos</Badge>;
    if (isOwner)
      return <Badge className="bg-accent text-accent-foreground">Aliado</Badge>;
    if (isRenter) return <Badge variant="secondary">Arrendatario</Badge>;
    return <Badge variant="outline">—</Badge>;
  };

  const accountStatusBadge = (s: AccountStatus) => {
    if (s === "active")
      return <Badge className="bg-primary text-primary-foreground">Activo</Badge>;
    if (s === "suspended") return <Badge variant="secondary">Suspendido</Badge>;
    return <Badge variant="destructive">Baneado</Badge>;
  };

  const filtered = useMemo(() => {
    return users.filter((u) => {
      const q = search.toLowerCase().trim();
      const matchesSearch =
        !q ||
        (u.full_name || "").toLowerCase().includes(q) ||
        (u.cedula || "").toLowerCase().includes(q);
      const matchesRole =
        filterRole === "all" ||
        (filterRole === "renter"
          ? !u.roles.includes("owner") && !u.roles.includes("admin")
          : u.roles.includes(filterRole));
      const matchesVerif =
        filterVerif === "all" ||
        (filterVerif === "verified" ? u.verified : !u.verified);
      const matchesStatus =
        filterStatus === "all" || u.account_status === filterStatus;
      return matchesSearch && matchesRole && matchesVerif && matchesStatus;
    });
  }, [users, search, filterRole, filterVerif, filterStatus]);

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
          CRM de aliados, arrendatarios y administradores de RuedaVe.
        </p>

        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4">
          <div className="relative md:col-span-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Nombre o cédula..."
              value={search}
              onChange={(e) => updateParam("q", e.target.value)}
              className="pl-9"
            />
          </div>
          <Select
            value={filterRole}
            onValueChange={(v) => updateParam("role", v)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Rol" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los roles</SelectItem>
              <SelectItem value="renter">Arrendatarios</SelectItem>
              <SelectItem value="owner">Aliados</SelectItem>
              <SelectItem value="admin">Admins</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={filterVerif}
            onValueChange={(v) => updateParam("verif", v)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Verificación" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toda verificación</SelectItem>
              <SelectItem value="verified">Verificados</SelectItem>
              <SelectItem value="pending">Pendientes</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={filterStatus}
            onValueChange={(v) => updateParam("status", v)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Estado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todo estado</SelectItem>
              <SelectItem value="active">Activos</SelectItem>
              <SelectItem value="suspended">Suspendidos</SelectItem>
              <SelectItem value="banned">Baneados</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        <div className="rounded-xl border bg-card overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Rol</TableHead>
                <TableHead>Verificación</TableHead>
                <TableHead>Registro</TableHead>
                <TableHead>Reservas</TableHead>
                <TableHead>Cuenta</TableHead>
                <TableHead className="text-right">Acción</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    Cargando...
                  </TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    No se encontraron usuarios.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((u) => (
                  <TableRow key={u.user_id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{u.full_name || "Sin nombre"}</p>
                        <p className="text-xs text-muted-foreground">
                          {u.cedula ? `CI: ${u.cedula}` : "Sin cédula"}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>{roleLabel(u.roles)}</TableCell>
                    <TableCell>
                      {u.verified ? (
                        <Badge variant="outline" className="text-primary border-primary">
                          Verificado
                        </Badge>
                      ) : (
                        <Badge variant="outline">Pendiente</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(u.created_at).toLocaleDateString("es-VE")}
                    </TableCell>
                    <TableCell className="text-sm">{u.bookings_count}</TableCell>
                    <TableCell>{accountStatusBadge(u.account_status)}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          navigate(
                            `/admin/usuarios/${u.user_id}?${searchParams.toString()}`
                          )
                        }
                      >
                        <Eye className="w-3 h-3 mr-1" /> Ver perfil
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </main>
    </div>
  );
};

export default AdminUsersPage;
