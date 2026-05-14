import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import Navbar from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";
import { Search, Users, Eye, MessageSquare, Mail, Star, PauseCircle } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

type AppRole = "renter" | "owner" | "admin";
type AccountStatus = "active" | "suspended" | "banned";
type VerificationFilter = "all" | "verified" | "pending";

interface UserRow {
  user_id: string;
  full_name: string | null;
  cedula: string | null;
  phone: string | null;
  avatar_url: string | null;
  verified: boolean;
  account_status: AccountStatus;
  created_at: string;
  roles: AppRole[];
  bookings_count: number;
  // Owner-specific aggregates
  vehicles_count: number;
  total_revenue: number;
  avg_rating: number | null;
  review_count: number;
  last_payment_at: string | null;
  // Renter-specific aggregates
  total_spent: number;
  rating_given: number | null;
  rating_given_count: number;
  last_reservation_at: string | null;
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
  const filterStatus = (searchParams.get("status") || "all") as "all" | AccountStatus;

  const ownerView = filterRole === "owner";

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
      const [profilesRes, rolesRes, vehiclesRes, reservationsRes, reviewsRes, paymentsRes] =
        await Promise.all([
          supabase.from("profiles").select("*").order("created_at", { ascending: false }),
          supabase.from("user_roles").select("user_id, role"),
          supabase.from("vehicles").select("id, owner_id, active"),
          supabase.from("reservations").select("renter_id, vehicle_id, total_price, status, created_at"),
          supabase.from("reviews").select("subject_user_id, rating"),
          supabase.from("payments").select("reservation_id, amount, status, created_at"),
        ]);

      if (profilesRes.error) throw profilesRes.error;

      const rolesByUser = new Map<string, AppRole[]>();
      (rolesRes.data || []).forEach((r: any) => {
        const arr = rolesByUser.get(r.user_id) || [];
        arr.push(r.role);
        rolesByUser.set(r.user_id, arr);
      });

      const vehicleOwner = new Map<string, string>();
      const vehiclesByOwner = new Map<string, number>();
      (vehiclesRes.data || []).forEach((v: any) => {
        vehicleOwner.set(v.id, v.owner_id);
        if (v.active) vehiclesByOwner.set(v.owner_id, (vehiclesByOwner.get(v.owner_id) || 0) + 1);
      });

      const bookingsByUser = new Map<string, number>();
      const revenueByOwner = new Map<string, number>();
      const reservationOwner = new Map<string, string>();
      (reservationsRes.data || []).forEach((r: any) => {
        bookingsByUser.set(r.renter_id, (bookingsByUser.get(r.renter_id) || 0) + 1);
        const owner = vehicleOwner.get(r.vehicle_id);
        if (owner) {
          bookingsByUser.set(owner, (bookingsByUser.get(owner) || 0) + 1);
          if (["completed", "active"].includes(r.status)) {
            revenueByOwner.set(owner, (revenueByOwner.get(owner) || 0) + Number(r.total_price || 0));
          }
        }
      });

      const ratingByUser = new Map<string, { sum: number; n: number }>();
      (reviewsRes.data || []).forEach((rv: any) => {
        if (!rv.subject_user_id) return;
        const cur = ratingByUser.get(rv.subject_user_id) || { sum: 0, n: 0 };
        cur.sum += rv.rating || 0;
        cur.n += 1;
        ratingByUser.set(rv.subject_user_id, cur);
      });

      // Last payment per owner (via reservation -> vehicle owner)
      const lastPaymentByOwner = new Map<string, string>();
      // Build reservation->owner map
      const allReservations = reservationsRes.data || [];
      const resOwner = new Map<string, string>();
      allReservations.forEach((r: any) => {
        const o = vehicleOwner.get(r.vehicle_id);
        if (o) resOwner.set((r as any).id || `${r.renter_id}-${r.vehicle_id}`, o);
      });
      // Use vehicle_id->owner via reservation_id mapping is missing; fallback: derive owner from payment via reservation lookup map keyed by id
      const resById = new Map<string, any>();
      (allReservations as any[]).forEach((r: any) => { if (r.id) resById.set(r.id, r); });
      (paymentsRes.data || []).forEach((p: any) => {
        const r = resById.get(p.reservation_id);
        if (!r) return;
        const o = vehicleOwner.get(r.vehicle_id);
        if (!o) return;
        const cur = lastPaymentByOwner.get(o);
        if (!cur || new Date(p.created_at) > new Date(cur)) {
          lastPaymentByOwner.set(o, p.created_at);
        }
      });

      const rows: UserRow[] = (profilesRes.data || []).map((p: any) => {
        const r = ratingByUser.get(p.user_id);
        return {
          user_id: p.user_id,
          full_name: p.full_name,
          cedula: p.cedula,
          phone: p.phone,
          avatar_url: p.avatar_url,
          verified: p.verified,
          account_status: (p.account_status || "active") as AccountStatus,
          created_at: p.created_at,
          roles: rolesByUser.get(p.user_id) || [],
          bookings_count: bookingsByUser.get(p.user_id) || 0,
          vehicles_count: vehiclesByOwner.get(p.user_id) || 0,
          total_revenue: revenueByOwner.get(p.user_id) || 0,
          avg_rating: r ? Math.round((r.sum / r.n) * 10) / 10 : null,
          review_count: r?.n || 0,
          last_payment_at: lastPaymentByOwner.get(p.user_id) || null,
        };
      });

      setUsers(rows);
    } catch (e: any) {
      toast.error("Error cargando usuarios: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  const roleLabel = (r: AppRole[]) => {
    if (r.includes("admin")) return <Badge variant="destructive">Admin</Badge>;
    const isOwner = r.includes("owner");
    if (isOwner && r.includes("renter")) return <Badge className="bg-accent text-accent-foreground">Ambos</Badge>;
    if (isOwner) return <Badge className="bg-accent text-accent-foreground">Aliado</Badge>;
    return <Badge variant="secondary">Arrendatario</Badge>;
  };

  const accountStatusBadge = (s: AccountStatus) => {
    if (s === "active") return <Badge className="bg-primary text-primary-foreground">Activo</Badge>;
    if (s === "suspended") return <Badge variant="secondary">Suspendido</Badge>;
    return <Badge variant="destructive">Baneado</Badge>;
  };

  const verificationBadge = (v: boolean) =>
    v ? (
      <Badge variant="outline" className="text-primary border-primary">Verificado ✓</Badge>
    ) : (
      <Badge variant="outline">Pendiente ⏳</Badge>
    );

  const filtered = useMemo(() => {
    return users.filter((u) => {
      const q = search.toLowerCase().trim();
      const matchesSearch =
        !q ||
        (u.full_name || "").toLowerCase().includes(q) ||
        (u.cedula || "").toLowerCase().includes(q) ||
        (u.phone || "").toLowerCase().includes(q);
      const matchesRole =
        filterRole === "all" ||
        (filterRole === "renter"
          ? !u.roles.includes("owner") && !u.roles.includes("admin")
          : u.roles.includes(filterRole));
      const matchesVerif =
        filterVerif === "all" || (filterVerif === "verified" ? u.verified : !u.verified);
      const matchesStatus = filterStatus === "all" || u.account_status === filterStatus;
      return matchesSearch && matchesRole && matchesVerif && matchesStatus;
    });
  }, [users, search, filterRole, filterVerif, filterStatus]);

  const fmtMoney = (n: number) =>
    `$${n.toLocaleString("es-VE", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

  const waLink = (phone: string | null) =>
    phone ? `https://wa.me/${phone.replace(/\D/g, "")}` : null;

  const suspendUser = async (uid: string, status: AccountStatus) => {
    const newStatus: AccountStatus = status === "active" ? "suspended" : "active";
    const { error } = await supabase
      .from("profiles")
      .update({ account_status: newStatus })
      .eq("user_id", uid);
    if (error) return toast.error(error.message);
    toast.success(newStatus === "active" ? "Cuenta reactivada" : "Cuenta suspendida");
    loadUsers();
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
          CRM de aliados, arrendatarios y administradores de RuedaVe.
        </p>

        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4">
          <div className="relative md:col-span-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Nombre, cédula o teléfono..."
              value={search}
              onChange={(e) => updateParam("q", e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={filterRole} onValueChange={(v) => updateParam("role", v)}>
            <SelectTrigger><SelectValue placeholder="Rol" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los roles</SelectItem>
              <SelectItem value="renter">Arrendatarios</SelectItem>
              <SelectItem value="owner">Aliados (Dueños)</SelectItem>
              <SelectItem value="admin">Admins</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterVerif} onValueChange={(v) => updateParam("verif", v)}>
            <SelectTrigger><SelectValue placeholder="Verificación" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toda verificación</SelectItem>
              <SelectItem value="verified">Verificados</SelectItem>
              <SelectItem value="pending">Pendientes</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterStatus} onValueChange={(v) => updateParam("status", v)}>
            <SelectTrigger><SelectValue placeholder="Estado" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todo estado</SelectItem>
              <SelectItem value="active">Activos</SelectItem>
              <SelectItem value="suspended">Suspendidos</SelectItem>
              <SelectItem value="banned">Baneados</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {ownerView && (
          <p className="text-xs text-muted-foreground mb-2">
            Vista de dueños: muestra autos activos, ingresos acumulados, rating y último pago.
          </p>
        )}

        {/* Table */}
        <div className="rounded-xl border bg-card overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Contacto</TableHead>
                {ownerView ? (
                  <>
                    <TableHead className="text-right"># Autos</TableHead>
                    <TableHead className="text-right">Revenue</TableHead>
                    <TableHead>Rating</TableHead>
                    <TableHead>Último pago</TableHead>
                  </>
                ) : (
                  <>
                    <TableHead>Rol</TableHead>
                    <TableHead>Registro</TableHead>
                    <TableHead className="text-right">Reservas</TableHead>
                  </>
                )}
                <TableHead>Verificación</TableHead>
                <TableHead>Cuenta</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={ownerView ? 9 : 8} className="text-center py-8 text-muted-foreground">
                    Cargando...
                  </TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={ownerView ? 9 : 8} className="text-center py-8 text-muted-foreground">
                    No se encontraron usuarios.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((u) => {
                  const wa = waLink(u.phone);
                  return (
                    <TableRow key={u.user_id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-9 w-9">
                            <AvatarImage src={u.avatar_url || undefined} />
                            <AvatarFallback>
                              {(u.full_name || "?").slice(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium">{u.full_name || "Sin nombre"}</p>
                            <p className="text-xs text-muted-foreground">
                              {u.cedula ? `CI: ${u.cedula}` : "Sin cédula"}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {wa ? (
                            <a
                              href={wa}
                              target="_blank"
                              rel="noreferrer"
                              className="text-xs text-primary hover:underline flex items-center gap-1"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <MessageSquare className="w-3 h-3" />
                              {u.phone}
                            </a>
                          ) : (
                            <span className="text-xs text-muted-foreground">Sin teléfono</span>
                          )}
                        </div>
                      </TableCell>

                      {ownerView ? (
                        <>
                          <TableCell className="text-right text-sm">
                            {u.vehicles_count > 0 ? `${u.vehicles_count} ${u.vehicles_count === 1 ? "auto" : "autos"}` : "—"}
                          </TableCell>
                          <TableCell className="text-right text-sm font-medium">
                            {u.total_revenue > 0 ? fmtMoney(u.total_revenue) : "—"}
                          </TableCell>
                          <TableCell>
                            {u.avg_rating != null ? (
                              <span className="inline-flex items-center gap-1 text-sm">
                                <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                                {u.avg_rating}
                                <span className="text-xs text-muted-foreground">({u.review_count})</span>
                              </span>
                            ) : (
                              <span className="text-xs text-muted-foreground">Sin reseñas</span>
                            )}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {u.last_payment_at
                              ? format(new Date(u.last_payment_at), "dd MMM yyyy", { locale: es })
                              : "—"}
                          </TableCell>
                        </>
                      ) : (
                        <>
                          <TableCell>{roleLabel(u.roles)}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {new Date(u.created_at).toLocaleDateString("es-VE")}
                          </TableCell>
                          <TableCell className="text-right text-sm">{u.bookings_count}</TableCell>
                        </>
                      )}

                      <TableCell>{verificationBadge(u.verified)}</TableCell>
                      <TableCell>{accountStatusBadge(u.account_status)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              navigate(`/admin/usuarios/${u.user_id}?${searchParams.toString()}`)
                            }
                          >
                            <Eye className="w-3 h-3 mr-1" /> Ver
                          </Button>
                          {u.account_status !== "banned" && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => suspendUser(u.user_id, u.account_status)}
                              title={u.account_status === "active" ? "Suspender" : "Reactivar"}
                            >
                              <PauseCircle className="w-3 h-3" />
                            </Button>
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
    </div>
  );
};

export default AdminUsersPage;
