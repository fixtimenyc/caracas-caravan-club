import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useVerificationStatus } from "@/hooks/useVerificationStatus";
import { supabase } from "@/integrations/supabase/client";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, User, Mail, Phone, MapPin, IdCard, ShieldCheck, Star, Car } from "lucide-react";
import { toast } from "sonner";

interface ProfileData {
  full_name: string | null;
  phone: string | null;
  address: string | null;
  cedula: string | null;
  avatar_url: string | null;
  verified: boolean;
}

const ProfilePage = () => {
  const { user, roles, loading: authLoading } = useAuth();
  const verification = useVerificationStatus();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<ProfileData>({
    full_name: "",
    phone: "",
    address: "",
    cedula: "",
    avatar_url: null,
    verified: false,
  });
  const [rating, setRating] = useState<{ avg: number; count: number }>({ avg: 0, count: 0 });
  const [vehicleCount, setVehicleCount] = useState(0);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [authLoading, user, navigate]);

  useEffect(() => {
    if (!user) return;

    const load = async () => {
      setLoading(true);

      const { data: profileRow } = await supabase
        .from("profiles")
        .select("full_name, phone, address, cedula, avatar_url, verified")
        .eq("user_id", user.id)
        .maybeSingle();

      if (profileRow) {
        setProfile(profileRow);
      }

      const { data: ratingData } = await supabase.rpc("user_rating_summary", { _user_id: user.id });
      if (ratingData && ratingData.length > 0) {
        setRating({ avg: Number(ratingData[0].avg_rating) || 0, count: Number(ratingData[0].review_count) || 0 });
      }

      if (roles.includes("owner") || roles.includes("admin")) {
        const { count } = await supabase
          .from("vehicles")
          .select("*", { count: "exact", head: true })
          .eq("owner_id", user.id);
        setVehicleCount(count || 0);
      }

      setLoading(false);
    };

    load();
  }, [user, roles]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSaving(true);

    const { error } = await supabase
      .from("profiles")
      .upsert(
        {
          user_id: user.id,
          full_name: profile.full_name,
          phone: profile.phone,
          address: profile.address,
          cedula: profile.cedula,
        },
        { onConflict: "user_id" }
      );

    setSaving(false);

    if (error) {
      toast.error("Error al guardar el perfil");
      console.error(error);
      return;
    }

    toast.success("Perfil actualizado");
  };

  const getRoleLabel = () => {
    return verification.roleLabel;
  };

  if (authLoading || verification.loading || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <main className="container mx-auto px-4 pt-24 pb-16 max-w-4xl">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-8">
          <div className="w-20 h-20 rounded-full bg-gradient-hero flex items-center justify-center shrink-0">
            <User className="w-10 h-10 text-primary-foreground" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl sm:text-3xl font-bold text-foreground">
                {profile.full_name || "Mi perfil"}
              </h1>
              {profile.verified && (
                <Badge variant="secondary" className="gap-1">
                  <ShieldCheck className="w-3 h-3" />
                  Verificado
                </Badge>
              )}
            </div>
            <p className="text-muted-foreground text-sm mt-1">{user.email}</p>
            <Badge className="mt-2" variant="outline">
              {getRoleLabel()}
            </Badge>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <Star className="w-5 h-5 text-primary fill-primary" />
                <div>
                  <p className="text-2xl font-bold">{rating.count > 0 ? rating.avg.toFixed(1) : "—"}</p>
                  <p className="text-xs text-muted-foreground">
                    {rating.count} {rating.count === 1 ? "reseña" : "reseñas"}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {(roles.includes("owner") || roles.includes("admin")) && (
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <Car className="w-5 h-5 text-primary" />
                  <div>
                    <p className="text-2xl font-bold">{vehicleCount}</p>
                    <p className="text-xs text-muted-foreground">Vehículos publicados</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <ShieldCheck className={`w-5 h-5 ${profile.verified ? "text-primary" : "text-muted-foreground"}`} />
                <div>
                  <p className="text-sm font-semibold">{profile.verified ? "Verificado" : "Sin verificar"}</p>
                  <p className="text-xs text-muted-foreground">Estado de cuenta</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Edit form */}
        <Card>
          <CardHeader>
            <CardTitle>Información personal</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSave} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="full_name" className="flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5" /> Nombre completo
                  </Label>
                  <Input
                    id="full_name"
                    value={profile.full_name || ""}
                    onChange={(e) => setProfile({ ...profile, full_name: e.target.value })}
                    placeholder="Tu nombre"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email" className="flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5" /> Email
                  </Label>
                  <Input id="email" value={user.email || ""} disabled />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone" className="flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5" /> Teléfono
                  </Label>
                  <Input
                    id="phone"
                    value={profile.phone || ""}
                    onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                    placeholder="+58 412 1234567"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="cedula" className="flex items-center gap-1.5">
                    <IdCard className="w-3.5 h-3.5" /> Cédula
                  </Label>
                  <Input
                    id="cedula"
                    value={profile.cedula || ""}
                    onChange={(e) => setProfile({ ...profile, cedula: e.target.value })}
                    placeholder="V-12345678"
                  />
                </div>

                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="address" className="flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5" /> Dirección
                  </Label>
                  <Input
                    id="address"
                    value={profile.address || ""}
                    onChange={(e) => setProfile({ ...profile, address: e.target.value })}
                    placeholder="Caracas, Venezuela"
                  />
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <Button type="submit" disabled={saving}>
                  {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Guardar cambios
                </Button>
                {(roles.includes("owner") || roles.includes("admin")) && (
                  <Button type="button" variant="outline" onClick={() => navigate("/my-vehicles")}>
                    <Car className="w-4 h-4 mr-2" />
                    Mis vehículos
                  </Button>
                )}
                {verification.isOwnerApplicant && (
                  <Button type="button" variant="outline" onClick={() => navigate("/aliado/solicitud")}>
                    <ShieldCheck className="w-4 h-4 mr-2" />
                    Solicitud de aliado
                  </Button>
                )}
                {verification.needsRenterVerification && (
                  <Button type="button" variant="outline" onClick={() => navigate("/arrendatario/verificacion")}>
                    <ShieldCheck className="w-4 h-4 mr-2" />
                    Verificación arrendatario
                  </Button>
                )}
                <Button type="button" variant="outline" onClick={() => navigate("/perfil/privacidad")}>
                  <ShieldCheck className="w-4 h-4 mr-2" />
                  Mis datos y privacidad
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </main>

      <Footer />
    </div>
  );
};

export default ProfilePage;
