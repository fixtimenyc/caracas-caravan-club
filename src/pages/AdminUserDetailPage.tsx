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
  driving_license_number: string | null;
  driving_license_expiry: string | null;
  driving_license_doc_url: string | null;
  selfie_url: string | null;
  utility_bill_url: string | null;
  bank_reference_url: string | null;
  medical_certificate_url: string | null;
  has_medical_condition: boolean | null;
  own_social_provider: string | null;
  own_social_verified_at: string | null;
  own_social_verified_name: string | null;
  own_social_verified_email: string | null;
  own_social_verified_picture: string | null;
  own_social_declared_age_months: number | null;
  personal_reference_email: string | null;
}

interface RenterVerification {
  id: string;
  status: 'pending' | 'approved' | 'rejected';
  full_name: string;
  document_type: string;
  document_number: string;
  birth_date: string;
  nationality: string | null;
  gender: string | null;
  occupation: string | null;
  employer: string | null;
  phone: string;
  phone_secondary: string | null;
  contact_email: string | null;
  address: string;
  city: string;
  state: string | null;
  country: string;
  emergency_contact_name: string;
  emergency_contact_relationship: string;
  emergency_contact_phone: string;
  driving_license_number: string;
  driving_license_expiry: string;
  has_medical_condition: boolean;
  identity_doc_url: string;
  driving_license_doc_url: string;
  medical_certificate_url: string | null;
  selfie_url: string;
  own_social_platform: string;
  own_social_url: string;
  own_social_age_months: number;
  reference_name: string;
  reference_relationship: string;
  reference_phone: string;
  reference_social_platform: string;
  reference_social_url: string;
  reference_social_age_months: number;
  admin_notes: string | null;
  created_at: string;
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
  const [verification, setVerification] = useState<RenterVerification | null>(null);
  const [verificationDocs, setVerificationDocs] = useState<Record<string, string>>({});
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

  const signDoc = async (path: string | null, bucket: 'owner-documents' | 'renter-documents' = 'owner-documents') => {
    if (!path) return null;
    const { data } = await supabase.storage
      .from(bucket)
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
        verifRes,
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
          .select("*")
          .eq("user_id", uid)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from("renter_verifications")
          .select("*")
          .eq("user_id", uid)
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

      // Sign owner documents
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

      // Renter verification + signed docs
      const verifData = verifRes.data as RenterVerification | null;
      setVerification(verifData);
      if (verifData) {
        const [identity, license, selfieUrl, medical] = await Promise.all([
          signDoc(verifData.identity_doc_url, 'renter-documents'),
          signDoc(verifData.driving_license_doc_url, 'renter-documents'),
          signDoc(verifData.selfie_url, 'renter-documents'),
          signDoc(verifData.medical_certificate_url, 'renter-documents'),
        ]);
        const vdocs: Record<string, string> = {};
        if (identity) vdocs.identity = identity;
        if (license) vdocs.license = license;
        if (selfieUrl) vdocs.selfie = selfieUrl;
        if (medical) vdocs.medical = medical;
        setVerificationDocs(vdocs);
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

  const setVerificationStatus = async (status: 'approved' | 'rejected') => {
    if (!verification) return;
    const { error } = await supabase
      .from('renter_verifications')
      .update({ status, admin_notes: newNote.trim() || null })
      .eq('id', verification.id);
    if (error) return toast.error(error.message);
    await logAction(status === 'approved' ? 'verified' : 'unverified',
      `Verificación de arrendatario ${status === 'approved' ? 'aprobada' : 'rechazada'}`);
    await supabase.from('notifications').insert({
      user_id: verification.id ? (verification as any).user_id || userId : userId,
      type: status === 'approved' ? 'verification_approved' : 'verification_rejected',
      title: status === 'approved' ? 'Verificación aprobada' : 'Verificación rechazada',
      message: status === 'approved'
        ? 'Tu identidad ha sido verificada. Ya puedes alquilar vehículos.'
        : 'Tu verificación fue rechazada. Contacta al equipo de soporte.',
    });
    toast.success('Estado de verificación actualizado');
    if (userId) loadAll(userId);
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
                  run: async () => { await setVerified(!profile.verified); },
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
                  run: async () => {
                    await setStatus(
                      profile.account_status === "suspended" ? "active" : "suspended",
                      profile.account_status === "suspended"
                        ? "unsuspended"
                        : "suspended"
                    );
                  },
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
                  run: async () => {
                    await setStatus(
                      profile.account_status === "banned" ? "active" : "banned",
                      profile.account_status === "banned" ? "unbanned" : "banned"
                    );
                  },
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
            {verification && <TabsTrigger value="verification">Verificación</TabsTrigger>}
            <TabsTrigger value="activity">Actividad</TabsTrigger>
            <TabsTrigger value="bookings">Reservas</TabsTrigger>
            {isOwner && <TabsTrigger value="vehicles">Vehículos</TabsTrigger>}
            {isOwner && <TabsTrigger value="financial">Financiero</TabsTrigger>}
            <TabsTrigger value="payments">Métodos de pago</TabsTrigger>
            <TabsTrigger value="alerts">Alertas</TabsTrigger>
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
                  <DocPreview label="Certificado de circulación" url={docUrls.title} />
                  )}
                  {docUrls.insurance && (
                    <DocPreview label="Seguro" url={docUrls.insurance} />
                  )}
                </div>
              </div>
            )}
          </TabsContent>

          {/* Renter verification */}
          {verification && (
            <TabsContent value="verification" className="space-y-4">
              <div className="rounded-xl border bg-card p-6">
                <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
                  <div>
                    <h3 className="font-semibold">Verificación de Arrendatario</h3>
                    <p className="text-xs text-muted-foreground">
                      Enviada el {new Date(verification.created_at).toLocaleString("es-VE")}
                    </p>
                  </div>
                  <Badge
                    className={
                      verification.status === 'approved'
                        ? 'bg-primary text-primary-foreground'
                        : verification.status === 'rejected'
                        ? 'bg-destructive text-destructive-foreground'
                        : ''
                    }
                    variant={verification.status === 'pending' ? 'secondary' : 'default'}
                  >
                    {verification.status === 'approved' ? 'Aprobada'
                      : verification.status === 'rejected' ? 'Rechazada' : 'Pendiente'}
                  </Badge>
                </div>

                <div className="grid sm:grid-cols-2 gap-4 text-sm">
                  <Info label="Nombre completo" value={verification.full_name} />
                  <Info label={`Documento (${verification.document_type})`} value={verification.document_number} />
                  <Info label="Fecha de nacimiento" value={new Date(verification.birth_date).toLocaleDateString("es-VE")} />
                  <Info label="Nacionalidad" value={verification.nationality} />
                  <Info label="Género" value={verification.gender} />
                  <Info label="Ocupación" value={verification.occupation} />
                  <Info label="Empleador" value={verification.employer} />
                  <Info label="Teléfono principal" value={verification.phone} />
                  <Info label="Teléfono secundario" value={verification.phone_secondary} />
                  <Info label="Email contacto" value={verification.contact_email} />
                  <Info label="Dirección" value={`${verification.address}, ${verification.city}${verification.state ? ', ' + verification.state : ''}, ${verification.country}`} />
                  <Info label="Licencia N°" value={verification.driving_license_number} />
                  <Info label="Vence licencia" value={new Date(verification.driving_license_expiry).toLocaleDateString("es-VE")} />
                  <Info label="Condición médica" value={verification.has_medical_condition ? 'Sí' : 'No'} />
                </div>
              </div>

              <div className="rounded-xl border bg-card p-6">
                <h3 className="font-semibold mb-3">Contacto de emergencia</h3>
                <div className="grid sm:grid-cols-3 gap-4 text-sm">
                  <Info label="Nombre" value={verification.emergency_contact_name} />
                  <Info label="Parentesco" value={verification.emergency_contact_relationship} />
                  <Info label="Teléfono" value={verification.emergency_contact_phone} />
                </div>
              </div>

              <div className="rounded-xl border bg-card p-6">
                <h3 className="font-semibold mb-3">Redes sociales y referencia</h3>
                <div className="grid sm:grid-cols-2 gap-4 text-sm">
                  <Info label="Su red social" value={`${verification.own_social_platform} · ${verification.own_social_age_months} meses`} />
                  <div>
                    <p className="text-xs text-muted-foreground">URL del perfil</p>
                    <a href={verification.own_social_url} target="_blank" rel="noreferrer"
                      className="text-primary hover:underline text-sm break-all">
                      {verification.own_social_url}
                    </a>
                  </div>
                  <Info label="Referencia personal" value={`${verification.reference_name} (${verification.reference_relationship})`} />
                  <Info label="Teléfono referencia" value={verification.reference_phone} />
                  <Info label="Red social referencia" value={`${verification.reference_social_platform} · ${verification.reference_social_age_months} meses`} />
                  <div>
                    <p className="text-xs text-muted-foreground">URL referencia</p>
                    <a href={verification.reference_social_url} target="_blank" rel="noreferrer"
                      className="text-primary hover:underline text-sm break-all">
                      {verification.reference_social_url}
                    </a>
                  </div>
                </div>
              </div>

              {(verificationDocs.identity || verificationDocs.license || verificationDocs.selfie || verificationDocs.medical) && (
                <div className="rounded-xl border bg-card p-6">
                  <h3 className="font-semibold mb-4">Documentos cargados</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    {verificationDocs.identity && <DocPreview label="Identidad" url={verificationDocs.identity} />}
                    {verificationDocs.license && <DocPreview label="Licencia" url={verificationDocs.license} />}
                    {verificationDocs.selfie && <DocPreview label="Selfie" url={verificationDocs.selfie} />}
                    {verificationDocs.medical && <DocPreview label="Certificado médico" url={verificationDocs.medical} />}
                  </div>
                </div>
              )}

              {verification.admin_notes && (
                <div className="rounded-xl border bg-card p-4 text-sm">
                  <p className="text-xs text-muted-foreground mb-1">Notas del administrador</p>
                  <p>{verification.admin_notes}</p>
                </div>
              )}

              {verification.status === 'pending' && (
                <div className="rounded-xl border bg-card p-4 flex flex-wrap gap-2">
                  <Button size="sm" onClick={() => setVerificationStatus('approved')}>
                    <ShieldCheck className="w-4 h-4 mr-1" /> Aprobar verificación
                  </Button>
                  <Button size="sm" variant="destructive" onClick={() => setVerificationStatus('rejected')}>
                    <Ban className="w-4 h-4 mr-1" /> Rechazar
                  </Button>
                  <p className="text-xs text-muted-foreground w-full mt-2">
                    Tip: agrega una nota interna antes de rechazar para registrar el motivo.
                  </p>
                </div>
              )}
            </TabsContent>
          )}

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

          {/* Financiero (owner) */}
          {isOwner && (
            <TabsContent value="financial" className="space-y-4">
              {(() => {
                const owned = ownerRes;
                const completed = owned.filter((r: any) => ["completed", "active"].includes(r.status));
                const totalRevenue = completed.reduce((s: number, r: any) => s + Number(r.total_price || 0), 0);
                const commissions = Math.round(totalRevenue * 0.10 * 100) / 100;
                const payout = totalRevenue - commissions;
                // 6-month series
                const months: { label: string; revenue: number }[] = [];
                const now = new Date();
                for (let i = 5; i >= 0; i--) {
                  const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
                  const label = d.toLocaleDateString("es-VE", { month: "short", year: "2-digit" });
                  const rev = completed
                    .filter((r: any) => {
                      const rd = new Date(r.created_at);
                      return rd.getMonth() === d.getMonth() && rd.getFullYear() === d.getFullYear();
                    })
                    .reduce((s: number, r: any) => s + Number(r.total_price || 0), 0);
                  months.push({ label, revenue: rev });
                }
                const maxRev = Math.max(1, ...months.map((m) => m.revenue));
                const fmt = (n: number) =>
                  `$${n.toLocaleString("es-VE", { maximumFractionDigits: 0 })}`;
                return (
                  <>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="rounded-xl border bg-card p-4">
                        <p className="text-xs text-muted-foreground">Ingresos totales</p>
                        <p className="text-2xl font-bold">{fmt(totalRevenue)}</p>
                      </div>
                      <div className="rounded-xl border bg-card p-4">
                        <p className="text-xs text-muted-foreground">Comisión RUEDAVE (10%)</p>
                        <p className="text-2xl font-bold text-destructive">−{fmt(commissions)}</p>
                      </div>
                      <div className="rounded-xl border bg-card p-4">
                        <p className="text-xs text-muted-foreground">Payout neto</p>
                        <p className="text-2xl font-bold text-primary">{fmt(payout)}</p>
                      </div>
                    </div>

                    <div className="rounded-xl border bg-card p-4">
                      <p className="text-sm font-medium mb-3">Ingresos últimos 6 meses</p>
                      <div className="flex items-end gap-2 h-32">
                        {months.map((m) => (
                          <div key={m.label} className="flex-1 flex flex-col items-center gap-1">
                            <div className="text-[10px] text-muted-foreground">{fmt(m.revenue)}</div>
                            <div
                              className="w-full bg-primary rounded-t"
                              style={{ height: `${(m.revenue / maxRev) * 100}%`, minHeight: m.revenue > 0 ? "4px" : "0" }}
                            />
                            <div className="text-[10px] text-muted-foreground">{m.label}</div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="rounded-xl border bg-card overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Fecha</TableHead>
                            <TableHead>Vehículo</TableHead>
                            <TableHead className="text-right">Ingreso</TableHead>
                            <TableHead className="text-right">Comisión</TableHead>
                            <TableHead className="text-right">Payout</TableHead>
                            <TableHead>Pago</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {owned.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={6} className="text-center text-muted-foreground py-6">
                                Sin movimientos.
                              </TableCell>
                            </TableRow>
                          ) : (
                            owned.slice(0, 20).map((r: any) => {
                              const rev = Number(r.total_price || 0);
                              const com = Math.round(rev * 0.10 * 100) / 100;
                              return (
                                <TableRow key={r.id}>
                                  <TableCell className="text-xs">
                                    {new Date(r.created_at).toLocaleDateString("es-VE")}
                                  </TableCell>
                                  <TableCell className="text-sm">
                                    {r.vehicles?.brand} {r.vehicles?.model}
                                  </TableCell>
                                  <TableCell className="text-right text-sm">{fmt(rev)}</TableCell>
                                  <TableCell className="text-right text-sm text-destructive">−{fmt(com)}</TableCell>
                                  <TableCell className="text-right text-sm font-medium">{fmt(rev - com)}</TableCell>
                                  <TableCell>
                                    <Badge variant="outline">{r.payments?.[0]?.status || "—"}</Badge>
                                  </TableCell>
                                </TableRow>
                              );
                            })
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </>
                );
              })()}
            </TabsContent>
          )}

          {/* Métodos de pago / Transacciones */}
          <TabsContent value="payments" className="space-y-3">
            <div className="rounded-xl border bg-card p-4">
              <p className="text-sm text-muted-foreground">
                Los métodos de pago tokenizados aún no están integrados. Mientras tanto, mostramos el historial de transacciones de las reservas del usuario.
              </p>
            </div>
            <div className="rounded-xl border bg-card overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Reserva</TableHead>
                    <TableHead>Vehículo</TableHead>
                    <TableHead className="text-right">Monto</TableHead>
                    <TableHead>Estado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {renterRes.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground py-6">
                        Sin transacciones.
                      </TableCell>
                    </TableRow>
                  ) : (
                    renterRes.map((r: any) => (
                      <TableRow key={r.id}>
                        <TableCell className="text-xs">
                          {new Date(r.created_at).toLocaleDateString("es-VE")}
                        </TableCell>
                        <TableCell className="text-xs font-mono">
                          #{r.id.slice(0, 8).toUpperCase()}
                        </TableCell>
                        <TableCell className="text-sm">
                          {r.vehicles?.brand} {r.vehicles?.model}
                        </TableCell>
                        <TableCell className="text-right text-sm font-medium">
                          ${Number(r.total_price || 0).toLocaleString("es-VE", { maximumFractionDigits: 0 })}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {r.payments?.[0]?.status || (r.status === "cancelled" ? "rechazado" : "pendiente")}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          {/* Alertas & Problemas */}
          <TabsContent value="alerts" className="space-y-3">
            {(() => {
              const cancellations = renterRes.filter((r: any) => r.status === "cancelled").length;
              const totalRes = renterRes.length;
              const cancelRate = totalRes > 0 ? Math.round((cancellations / totalRes) * 100) : 0;
              const negativeReviews = reviews.filter(
                (r: any) => r.subject_user_id === profile.user_id && (r.rating || 0) <= 2
              );
              const rejectedPayments = renterRes.filter(
                (r: any) => r.payments?.[0]?.status === "failed" || r.payments?.[0]?.status === "rechazado"
              );
              const isSuspended = profile.account_status !== "active";
              const alerts: { kind: string; title: string; detail: string; severity: "high" | "med" | "low" }[] = [];
              if (cancellations >= 3) alerts.push({ kind: "Cancelaciones frecuentes", title: `${cancellations} reservas canceladas`, detail: `Tasa de cancelación: ${cancelRate}%`, severity: "high" });
              if (negativeReviews.length > 0) alerts.push({ kind: "Reseñas negativas", title: `${negativeReviews.length} reseña(s) ≤ 2 estrellas`, detail: "Revisar comentarios de dueños", severity: "med" });
              if (rejectedPayments.length > 0) alerts.push({ kind: "Pagos rechazados", title: `${rejectedPayments.length} transacción(es) fallida(s)`, detail: "Posible problema con método de pago", severity: "high" });
              if (isSuspended) alerts.push({ kind: "Cuenta suspendida", title: profile.account_status === "banned" ? "Usuario baneado" : "Usuario suspendido", detail: "Revisar log de sanciones", severity: "high" });

              return alerts.length === 0 ? (
                <div className="rounded-xl border bg-card p-6 text-center text-sm text-muted-foreground">
                  ✓ Sin alertas activas. Usuario en buen estado.
                </div>
              ) : (
                <div className="space-y-2">
                  {alerts.map((a, i) => (
                    <div
                      key={i}
                      className={`rounded-xl border p-4 flex items-start gap-3 ${
                        a.severity === "high"
                          ? "border-destructive/30 bg-destructive/5"
                          : a.severity === "med"
                          ? "border-yellow-500/30 bg-yellow-500/5"
                          : "bg-card"
                      }`}
                    >
                      <AlertTriangle className={`w-5 h-5 mt-0.5 ${a.severity === "high" ? "text-destructive" : "text-yellow-600"}`} />
                      <div className="flex-1">
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">{a.kind}</p>
                        <p className="font-medium">{a.title}</p>
                        <p className="text-sm text-muted-foreground">{a.detail}</p>
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()}
          </TabsContent>

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
                        <StarRating value={r.rating} size="sm" readOnly />
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
                          run: async () => { await deleteReview(r.id); },
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
