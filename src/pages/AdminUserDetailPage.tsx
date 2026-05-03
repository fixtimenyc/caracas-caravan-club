import { useEffect, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import Navbar from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Textarea } from "@/components/ui/textarea";
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
import { toast } from "sonner";
import {
  ArrowLeft,
  ShieldCheck,
  Ban,
  PauseCircle,
  AlertTriangle,
  Trash2,
  Star,
} from "lucide-react";
import { resolveVehiclePhoto } from "@/lib/vehiclePhoto";
import StarRating from "@/components/StarRating";

type AppRole = "renter" | "owner" | "admin";
type AccountStatus = "active" | "suspended" | "banned";
type ActionType =
  | "warning_sent"
  | "suspended"
  | "banned"
  | "unsuspended"
  | "unbanned"
  | "verified"
  | "unverified"
  | "role_added"
  | "role_removed"
  | "deleted"
  | "note";

interface ProfileData {
  user_id: string;
  full_name: string | null;
  phone: string | null;
  cedula: string | null;
  address: string | null;
  avatar_url: string | null;
  verified: boolean;
  account_status: AccountStatus;
  birth_date: string | null;
  last_login_at: string | null;
  created_at: string;
}

interface Application {
  cedula_doc_url: string | null;
  title_doc_url: string | null;
  insurance_doc_url: string | null;
  vehicle_photos: string[] | null;
  birth_date: string | null;
  address: string | null;
}

type ConfirmAction = {
  title: string;
  description: string;
  run: () => Promise<void>;
} | null;

const statusBadge = (s: AccountStatus) => {
  if (s === "active")
    return <Badge className="bg-primary text-primary-foreground">Activo</Badge>;
  if (s === "suspended") return <Badge variant="secondary">Suspendido</Badge>;
  return <Badge variant="destructive">Baneado</Badge>;
};

const AdminUserDetailPage = () => {
  const { userId } = useParams<{ userId: string }>();
  const { user, roles, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [userRoles, setUserRoles] = useState<AppRole[]>([]);
  const [application, setApplication] = useState<Application | null>(null);
  const [reservations, setReservations] = useState<any[]>([]);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [vehiclePhotos, setVehiclePhotos] = useState<Record<string, string>>({});
  const [reviews, setReviews] = useState<any[]>([]);
  const [notes, setNotes] = useState<any[]>([]);
  const [actions, setActions] = useState<any[]>([]);
  const [docUrls, setDocUrls] = useState<Record<string, string>>({});

  const [newNote, setNewNote] = useState("");
  const [warningText, setWarningText] = useState("");
  const [confirm, setConfirm] = useState<ConfirmAction>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user || !roles.includes("admin")) {
      navigate("/");
      return;
    }
    if (userId) loadAll(userId);
  }, [user, roles, authLoading, userId]);

  const signDoc = async (path: string | null) => {
    if (!path) return null;
    const { data } = await supabase.storage
      .from("owner-documents")
      .createSignedUrl(path, 3600);
    return data?.signedUrl || null;
  };

  const loadAll = async (uid: string) => {
    setLoading(true);
    try {
      const [
        profileRes,
        rolesRes,
        appRes,
        reservAsRenter,
        vehiclesRes,
        reviewsRes,
        notesRes,
        actionsRes,
      ] = await Promise.all([
        supabase.from("profiles").select("*").eq("user_id", uid).maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", uid),
        supabase
          .from("owner_applications")
          .select(
            "cedula_doc_url, title_doc_url, insurance_doc_url, vehicle_photos, birth_date, address"
          )
          .eq("user_id", uid)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from("reservations")
          .select("*, vehicles(brand, model, year, owner_id), payments(status)")
          .eq("renter_id", uid)
          .order("created_at", { ascending: false }),
        supabase.from("vehicles").select("*").eq("owner_id", uid),
        supabase
          .from("reviews")
          .select("*")
          .eq("subject_user_id", uid)
          .order("created_at", { ascending: false }),
        supabase
          .from("admin_user_notes")
          .select("*")
          .eq("target_user_id", uid)
          .order("created_at", { ascending: false }),
        supabase
          .from("admin_user_actions")
          .select("*")
          .eq("target_user_id", uid)
          .order("created_at", { ascending: false }),
      ]);

      if (profileRes.error) throw profileRes.error;
      const prof = profileRes.data as ProfileData | null;
      setProfile(prof);
      const rolesList = (rolesRes.data || []).map((r: any) => r.role as AppRole);
      setUserRoles(rolesList);
      setApplication((appRes.data as Application) || null);

      // Reservations as owner
      let allReservations: any[] = reservAsRenter.data || [];
      if (rolesList.includes("owner")) {
        const ownerVehicleIds = (vehiclesRes.data || []).map((v: any) => v.id);
        if (ownerVehicleIds.length) {
          const { data: ownerRes } = await supabase
            .from("reservations")
            .select("*, vehicles(brand, model, year, owner_id), payments(status)")
            .in("vehicle_id", ownerVehicleIds)
            .order("created_at", { ascending: false });
          // Tag and merge, avoiding duplicates
          const existingIds = new Set(allReservations.map((r) => r.id));
          (ownerRes || []).forEach((r) => {
            if (!existingIds.has(r.id)) allReservations.push(r);
          });
        }
      }
      setReservations(allReservations);
      setVehicles(vehiclesRes.data || []);
      setReviews(reviewsRes.data || []);
      setNotes(notesRes.data || []);
      setActions(actionsRes.data || []);

      // Resolve vehicle cover photos
      const photos: Record<string, string> = {};
      await Promise.all(
        (vehiclesRes.data || []).map(async (v: any) => {
          if (v.photos?.[0]) {
            photos[v.id] = await resolveVehiclePhoto(v.photos[0]);
          }
        })
      );
      setVehiclePhotos(photos);

      // Sign documents
      if (appRes.data) {
        const a = appRes.data as Application;
        const [cedula, title, insurance] = await Promise.all([
          signDoc(a.cedula_doc_url),
          signDoc(a.title_doc_url),
          signDoc(a.insurance_doc_url),
        ]);
        const docs: Record<string, string> = {};
        if (cedula) docs.cedula = cedula;
        if (title) docs.title = title;
        if (insurance) docs.insurance = insurance;
        setDocUrls(docs);
      }
    } catch (e: any) {
      toast.error("Error cargando perfil: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  const logAction = async (
    action_type: ActionType,
    details?: string
  ) => {
    if (!user || !userId) return;
    await supabase.from("admin_user_actions").insert({
      target_user_id: userId,
      admin_id: user.id,
      action_type,
      details,
    });
  };

  const setVerified = async (val: boolean) => {
    if (!profile) return;
    const { error } = await supabase
      .from("profiles")
      .update({ verified: val })
      .eq("user_id", profile.user_id);
    if (error) return toast.error(error.message);
    await logAction(val ? "verified" : "unverified");
    toast.success(val ? "Identidad verificada" : "Verificación removida");
    loadAll(profile.user_id);
  };

  const setStatus = async (status: AccountStatus, action: ActionType) => {
    if (!profile) return;
    const { error } = await supabase
      .from("profiles")
      .update({ account_status: status })
      .eq("user_id", profile.user_id);
    if (error) return toast.error(error.message);
    await logAction(action);
    toast.success("Estado actualizado");
    loadAll(profile.user_id);
  };

  const sendWarning = async () => {
    if (!warningText.trim() || !profile || !user) return;
    const { error: nErr } = await supabase.from("notifications").insert({
      user_id: profile.user_id,
      type: "warning",
      title: "Advertencia del equipo RuedaVe",
      message: warningText.trim(),
    });
    if (nErr) return toast.error(nErr.message);
    await logAction("warning_sent", warningText.trim());
    setWarningText("");
    toast.success("Advertencia enviada");
    loadAll(profile.user_id);
  };

  const addNote = async () => {
    if (!newNote.trim() || !user || !userId) return;
    const { error } = await supabase.from("admin_user_notes").insert({
      target_user_id: userId,
      admin_id: user.id,
      note: newNote.trim(),
    });
    if (error) return toast.error(error.message);
    setNewNote("");
    toast.success("Nota agregada");
    loadAll(userId);
  };

  const deleteReview = async (id: string) => {
    const { error } = await supabase.from("reviews").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Reseña eliminada");
    if (userId) loadAll(userId);
  };

  const deleteAccount = async () => {
    if (!profile) return;
    // Soft delete: ban + log
    await setStatus("banned", "deleted");
    toast.success("Cuenta marcada como eliminada (baneada).");
  };

  if (loading || !profile) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <main className="container mx-auto px-4 pt-24 pb-12">
          <p className="text-muted-foreground">Cargando perfil...</p>
        </main>
      </div>
    );
  }

  const isOwner = userRoles.includes("owner");
  const isAdmin = userRoles.includes("admin");

  // Activity stats
  const renterRes = reservations.filter((r) => r.renter_id === profile.user_id);
  const ownerRes = reservations.filter(
    (r) => r.vehicles?.owner_id === profile.user_id
  );
  const stat = (arr: any[], s: string) =>
    arr.filter((r) => r.status === s).length;
  const earnings = ownerRes
    .filter((r) => r.status === "completed")
    .reduce((sum, r) => sum + Number(r.total_price || 0), 0);

  const renterReviews = reviews.filter((r) => r.reviewer_type === "owner");
  const ownerReviews = reviews.filter((r) => r.reviewer_type === "renter");
  const avg = (arr: any[]) =>
    arr.length
      ? (arr.reduce((s, r) => s + r.rating, 0) / arr.length).toFixed(2)
      : "—";

  const daysActive = Math.floor(
    (Date.now() - new Date(profile.created_at).getTime()) / 86400000
  );

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container mx-auto px-4 pt-24 pb-12 max-w-6xl">
        {/* Breadcrumb + back */}
        <div className="flex items-center justify-between gap-4 mb-4 flex-wrap">
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink asChild>
                  <Link to="/admin/usuarios">Panel Admin</Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbLink asChild>
                  <Link to="/admin/usuarios">Usuarios</Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>{profile.full_name || "Usuario"}</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
          <Button variant="outline" size="sm" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-4 h-4 mr-1" /> Volver
          </Button>
        </div>

        {/* Header card */}
        <div className="rounded-2xl border bg-card p-6 mb-6">
          <div className="flex flex-col md:flex-row gap-6">
            <Avatar className="w-24 h-24">
              <AvatarImage src={profile.avatar_url || undefined} />
              <AvatarFallback className="text-2xl">
                {(profile.full_name || "U").charAt(0)}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <h1 className="text-2xl font-bold">
                {profile.full_name || "Sin nombre"}
              </h1>
              <div className="flex flex-wrap gap-2 mt-2">
                {isAdmin && <Badge variant="destructive">Admin</Badge>}
                {isOwner && (
                  <Badge className="bg-accent text-accent-foreground">Aliado</Badge>
                )}
                {!isAdmin && !isOwner && (
                  <Badge variant="secondary">Arrendatario</Badge>
                )}
                {profile.verified ? (
                  <Badge variant="outline" className="text-primary border-primary">
                    Verificado
                  </Badge>
                ) : (
                  <Badge variant="outline">Sin verificar</Badge>
                )}
                {statusBadge(profile.account_status)}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-4 text-sm text-muted-foreground">
                <p>CI: {profile.cedula || "—"}</p>
                <p>Tel: {profile.phone || "—"}</p>
                <p>
                  Registrado:{" "}
                  {new Date(profile.created_at).toLocaleDateString("es-VE")}
                </p>
                <p>
                  Último ingreso:{" "}
                  {profile.last_login_at
                    ? new Date(profile.last_login_at).toLocaleDateString("es-VE")
                    : "—"}
                </p>
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap gap-2 mt-6 pt-6 border-t">
            <Button
              size="sm"
              variant={profile.verified ? "outline" : "default"}
              onClick={() =>
                setConfirm({
                  title: profile.verified
                    ? "¿Quitar verificación?"
                    : "¿Verificar identidad?",
                  description: "Esta acción quedará registrada en el log.",
                  run: async () => setVerified(!profile.verified),
                })
              }
            >
              <ShieldCheck className="w-4 h-4 mr-1" />
              {profile.verified ? "Quitar verificación" : "Verificar identidad"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                setConfirm({
                  title:
                    profile.account_status === "suspended"
                      ? "¿Reactivar cuenta?"
                      : "¿Suspender cuenta?",
                  description:
                    "Una cuenta suspendida no puede operar hasta ser reactivada.",
                  run: async () =>
                    setStatus(
                      profile.account_status === "suspended" ? "active" : "suspended",
                      profile.account_status === "suspended"
                        ? "unsuspended"
                        : "suspended"
                    ),
                })
              }
            >
              <PauseCircle className="w-4 h-4 mr-1" />
              {profile.account_status === "suspended" ? "Reactivar" : "Suspender"}
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={() =>
                setConfirm({
                  title:
                    profile.account_status === "banned"
                      ? "¿Quitar baneo?"
                      : "¿Banear cuenta?",
                  description: "El baneo bloquea permanentemente al usuario.",
                  run: async () =>
                    setStatus(
                      profile.account_status === "banned" ? "active" : "banned",
                      profile.account_status === "banned" ? "unbanned" : "banned"
                    ),
                })
              }
            >
              <Ban className="w-4 h-4 mr-1" />
              {profile.account_status === "banned" ? "Quitar baneo" : "Banear"}
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={() =>
                setConfirm({
                  title: "¿Eliminar cuenta?",
                  description:
                    "Marcará la cuenta como baneada y la dejará registrada en el log.",
                  run: deleteAccount,
                })
              }
            >
              <Trash2 className="w-4 h-4 mr-1" />
              Eliminar
            </Button>
          </div>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="info">
          <TabsList className="flex flex-wrap h-auto">
            <TabsTrigger value="info">Personal</TabsTrigger>
            <TabsTrigger value="activity">Actividad</TabsTrigger>
            <TabsTrigger value="bookings">Reservas</TabsTrigger>
            {isOwner && <TabsTrigger value="vehicles">Vehículos</TabsTrigger>}
            <TabsTrigger value="reviews">Reseñas</TabsTrigger>
            <TabsTrigger value="notes">Notas internas</TabsTrigger>
            <TabsTrigger value="log">Sanciones</TabsTrigger>
          </TabsList>

          {/* Personal */}
          <TabsContent value="info" className="space-y-4">
            <div className="rounded-xl border bg-card p-6 grid sm:grid-cols-2 gap-4 text-sm">
              <Info label="Nombre completo" value={profile.full_name} />
              <Info label="Cédula" value={profile.cedula} />
              <Info
                label="Fecha de nacimiento"
                value={
                  (profile.birth_date || application?.birth_date) &&
                  new Date(
                    profile.birth_date || application!.birth_date!
                  ).toLocaleDateString("es-VE")
                }
              />
              <Info label="Teléfono" value={profile.phone} />
              <Info
                label="Dirección"
                value={profile.address || application?.address}
              />
              <Info
                label="Registrado"
                value={new Date(profile.created_at).toLocaleString("es-VE")}
              />
              <Info
                label="Último ingreso"
                value={
                  profile.last_login_at
                    ? new Date(profile.last_login_at).toLocaleString("es-VE")
                    : null
                }
              />
            </div>

            {(docUrls.cedula || docUrls.title || docUrls.insurance) && (
              <div className="rounded-xl border bg-card p-6">
                <h3 className="font-semibold mb-4">Documentos cargados</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {docUrls.cedula && (
                    <DocPreview label="Cédula" url={docUrls.cedula} />
                  )}
                  {docUrls.title && (
                    <DocPreview label="Título de propiedad" url={docUrls.title} />
                  )}
                  {docUrls.insurance && (
                    <DocPreview label="Seguro" url={docUrls.insurance} />
                  )}
                </div>
              </div>
            )}
          </TabsContent>

          {/* Activity */}
          <TabsContent value="activity">
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="rounded-xl border bg-card p-6">
                <h3 className="font-semibold mb-3">Como Arrendatario</h3>
                <p className="text-sm">Completados: {stat(renterRes, "completed")}</p>
                <p className="text-sm">Cancelados: {stat(renterRes, "cancelled")}</p>
                <p className="text-sm">Pendientes: {stat(renterRes, "pending")}</p>
                <p className="text-sm mt-2">
                  Calificación promedio:{" "}
                  <span className="font-semibold">{avg(renterReviews)}</span>{" "}
                  ({renterReviews.length})
                </p>
              </div>
              <div className="rounded-xl border bg-card p-6">
                <h3 className="font-semibold mb-3">Como Aliado</h3>
                <p className="text-sm">Completados: {stat(ownerRes, "completed")}</p>
                <p className="text-sm">Cancelados: {stat(ownerRes, "cancelled")}</p>
                <p className="text-sm">Pendientes: {stat(ownerRes, "pending")}</p>
                <p className="text-sm mt-2">
                  Ingresos totales:{" "}
                  <span className="font-semibold">${earnings.toFixed(2)} USD</span>
                </p>
                <p className="text-sm">
                  Calificación promedio:{" "}
                  <span className="font-semibold">{avg(ownerReviews)}</span>{" "}
                  ({ownerReviews.length})
                </p>
              </div>
              <div className="rounded-xl border bg-card p-6 sm:col-span-2">
                <p className="text-sm">
                  Miembro desde{" "}
                  <strong>
                    {new Date(profile.created_at).toLocaleDateString("es-VE")}
                  </strong>{" "}
                  · <strong>{daysActive}</strong> días activo en la plataforma.
                </p>
              </div>
            </div>
          </TabsContent>

          {/* Bookings */}
          <TabsContent value="bookings">
            <div className="rounded-xl border bg-card overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>Rol</TableHead>
                    <TableHead>Vehículo</TableHead>
                    <TableHead>Fechas</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Pago</TableHead>
                    <TableHead>Estado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reservations.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground py-6">
                        Sin reservas.
                      </TableCell>
                    </TableRow>
                  ) : (
                    reservations.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell className="font-mono text-xs">
                          <Link
                            to={`/vehiculo/${r.vehicle_id}`}
                            className="text-primary hover:underline"
                          >
                            {r.id.slice(0, 8)}
                          </Link>
                        </TableCell>
                        <TableCell>
                          {r.renter_id === profile.user_id ? "Arrendatario" : "Aliado"}
                        </TableCell>
                        <TableCell>
                          {r.vehicles
                            ? `${r.vehicles.brand} ${r.vehicles.model} ${r.vehicles.year}`
                            : "—"}
                        </TableCell>
                        <TableCell className="text-xs">
                          {new Date(r.start_date).toLocaleDateString("es-VE")} →{" "}
                          {new Date(r.end_date).toLocaleDateString("es-VE")}
                        </TableCell>
                        <TableCell>${Number(r.total_price).toFixed(2)}</TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {r.payments?.[0]?.status || "—"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">{r.status}</Badge>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          {/* Vehicles */}
          {isOwner && (
            <TabsContent value="vehicles">
              <div className="rounded-xl border bg-card overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead></TableHead>
                      <TableHead>Vehículo</TableHead>
                      <TableHead>Zona</TableHead>
                      <TableHead>Tarifa/día</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead>Reservas</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {vehicles.map((v) => {
                      const count = reservations.filter(
                        (r) => r.vehicle_id === v.id
                      ).length;
                      return (
                        <TableRow key={v.id}>
                          <TableCell>
                            {vehiclePhotos[v.id] ? (
                              <img
                                src={vehiclePhotos[v.id]}
                                alt={v.model}
                                className="w-16 h-12 object-cover rounded"
                              />
                            ) : (
                              <div className="w-16 h-12 bg-muted rounded" />
                            )}
                          </TableCell>
                          <TableCell>
                            {v.brand} {v.model} {v.year}
                          </TableCell>
                          <TableCell className="text-sm">{v.location}</TableCell>
                          <TableCell>${Number(v.price_per_day).toFixed(2)}</TableCell>
                          <TableCell>
                            {v.active ? (
                              <Badge className="bg-primary text-primary-foreground">
                                Activo
                              </Badge>
                            ) : (
                              <Badge variant="secondary">Inactivo</Badge>
                            )}
                          </TableCell>
                          <TableCell>{count}</TableCell>
                          <TableCell>
                            <Button asChild size="sm" variant="outline">
                              <Link to={`/vehiculo/${v.id}`}>Ver</Link>
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>
          )}

          {/* Reviews */}
          <TabsContent value="reviews">
            <div className="space-y-3">
              {reviews.length === 0 && (
                <p className="text-muted-foreground text-sm">Sin reseñas.</p>
              )}
              {reviews.map((r) => (
                <div key={r.id} className="rounded-xl border bg-card p-4">
                  <div className="flex justify-between items-start gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <StarRating rating={r.rating} size="sm" />
                        <Badge variant="outline">
                          {r.reviewer_type === "renter"
                            ? "Como aliado"
                            : "Como arrendatario"}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {new Date(r.created_at).toLocaleDateString("es-VE")}
                      </p>
                      {r.comment && <p className="mt-2 text-sm">{r.comment}</p>}
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        setConfirm({
                          title: "¿Eliminar reseña?",
                          description: "Esta acción es permanente.",
                          run: async () => deleteReview(r.id),
                        })
                      }
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>

          {/* Notes */}
          <TabsContent value="notes">
            <div className="space-y-4">
              <div className="rounded-xl border bg-card p-4">
                <h3 className="font-semibold mb-2">Enviar advertencia al usuario</h3>
                <Textarea
                  placeholder="Mensaje de advertencia que verá el usuario..."
                  value={warningText}
                  onChange={(e) => setWarningText(e.target.value)}
                />
                <Button
                  className="mt-2"
                  size="sm"
                  onClick={sendWarning}
                  disabled={!warningText.trim()}
                >
                  <AlertTriangle className="w-4 h-4 mr-1" /> Enviar advertencia
                </Button>
              </div>

              <div className="rounded-xl border bg-card p-4">
                <h3 className="font-semibold mb-2">Nota interna (privada)</h3>
                <Textarea
                  placeholder="Notas para el equipo, no visibles al usuario..."
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                />
                <Button
                  className="mt-2"
                  size="sm"
                  onClick={addNote}
                  disabled={!newNote.trim()}
                >
                  Agregar nota
                </Button>
              </div>

              <div className="space-y-2">
                {notes.length === 0 && (
                  <p className="text-muted-foreground text-sm">Sin notas internas.</p>
                )}
                {notes.map((n) => (
                  <div key={n.id} className="rounded-xl border bg-card p-4 text-sm">
                    <p className="text-xs text-muted-foreground mb-1">
                      {new Date(n.created_at).toLocaleString("es-VE")}
                    </p>
                    <p>{n.note}</p>
                  </div>
                ))}
              </div>
            </div>
          </TabsContent>

          {/* Log */}
          <TabsContent value="log">
            <div className="rounded-xl border bg-card overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Acción</TableHead>
                    <TableHead>Detalles</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {actions.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center text-muted-foreground py-6">
                        Sin acciones registradas.
                      </TableCell>
                    </TableRow>
                  ) : (
                    actions.map((a) => (
                      <TableRow key={a.id}>
                        <TableCell className="text-xs">
                          {new Date(a.created_at).toLocaleString("es-VE")}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{a.action_type}</Badge>
                        </TableCell>
                        <TableCell className="text-sm">{a.details || "—"}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>
        </Tabs>
      </main>

      <AlertDialog open={!!confirm} onOpenChange={(o) => !o && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirm?.title}</AlertDialogTitle>
            <AlertDialogDescription>{confirm?.description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                const c = confirm;
                setConfirm(null);
                if (c) await c.run();
              }}
            >
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

const Info = ({ label, value }: { label: string; value: any }) => (
  <div>
    <p className="text-xs text-muted-foreground">{label}</p>
    <p className="font-medium">{value || "—"}</p>
  </div>
);

const DocPreview = ({ label, url }: { label: string; url: string }) => (
  <a
    href={url}
    target="_blank"
    rel="noreferrer"
    className="block rounded-lg border overflow-hidden hover:border-primary transition"
  >
    <img src={url} alt={label} className="w-full h-32 object-cover bg-muted" />
    <p className="text-xs p-2 text-center">{label}</p>
  </a>
);

export default AdminUserDetailPage;
