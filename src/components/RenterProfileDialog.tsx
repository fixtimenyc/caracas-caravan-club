import { useEffect, useState } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  BadgeCheck,
  Mail,
  Phone,
  Globe,
  Star,
  Clock,
  ShieldCheck,
  ShieldAlert,
  Loader2,
  MessageSquareText,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type RenterProfile = {
  user_id: string;
  full_name: string | null;
  avatar_url: string | null;
  verified: boolean;
  member_since: string;
  email_verified: boolean;
  phone_verified: boolean;
  social_verified: boolean;
  social_platform: string | null;
  social_age_months: number | null;
  verification_status: string | null;
  avg_rating: number | null;
  review_count: number;
  reviews: Array<{
    rating: number;
    comment: string | null;
    created_at: string;
    renter_responsibility: number | null;
    punctuality: number | null;
  }>;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  renterId: string | null;
};

const monthsLabel = (months: number) => {
  if (months < 1) return "Menos de un mes";
  if (months < 12) return `${months} ${months === 1 ? "mes" : "meses"}`;
  const years = Math.floor(months / 12);
  const remaining = months % 12;
  return remaining > 0
    ? `${years} ${years === 1 ? "año" : "años"} y ${remaining} m`
    : `${years} ${years === 1 ? "año" : "años"}`;
};

const VerifiedRow = ({
  ok,
  icon: Icon,
  label,
  detail,
}: {
  ok: boolean;
  icon: any;
  label: string;
  detail?: string;
}) => (
  <div className="flex items-center justify-between gap-3 py-2">
    <div className="flex items-center gap-2 min-w-0">
      <Icon className="w-4 h-4 text-muted-foreground shrink-0" />
      <div className="min-w-0">
        <p className="text-sm text-foreground truncate">{label}</p>
        {detail && (
          <p className="text-xs text-muted-foreground truncate">{detail}</p>
        )}
      </div>
    </div>
    {ok ? (
      <Badge className="gap-1 bg-primary/10 text-primary hover:bg-primary/15 border-primary/20">
        <BadgeCheck className="w-3 h-3" />
        Verificado
      </Badge>
    ) : (
      <Badge variant="secondary" className="gap-1">
        <ShieldAlert className="w-3 h-3" />
        Sin verificar
      </Badge>
    )}
  </div>
);

const RenterProfileDialog = ({ open, onOpenChange, renterId }: Props) => {
  const [loading, setLoading] = useState(false);
  const [profile, setProfile] = useState<RenterProfile | null>(null);

  useEffect(() => {
    if (!open || !renterId) {
      setProfile(null);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase.rpc(
        "get_renter_profile_for_owner" as any,
        { _renter_id: renterId }
      );
      if (cancelled) return;
      if (error) {
        toast.error("No se pudo cargar el perfil");
        setProfile(null);
      } else {
        setProfile(data as unknown as RenterProfile);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [open, renterId]);

  const memberMonths = profile
    ? Math.max(
        0,
        Math.floor(
          (Date.now() - new Date(profile.member_since).getTime()) /
            (1000 * 60 * 60 * 24 * 30)
        )
      )
    : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-0 overflow-hidden">
        <ScrollArea className="max-h-[85vh]">
          <div className="p-6">
            <DialogHeader className="text-left">
              <DialogTitle>Perfil del arrendatario</DialogTitle>
              <DialogDescription>
                Información básica disponible para aliados con conversación
                activa.
              </DialogDescription>
            </DialogHeader>

            {loading ? (
              <div className="py-12 flex justify-center">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : !profile ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No se pudo cargar la información.
              </p>
            ) : (
              <div className="mt-4 space-y-5">
                {/* Header */}
                <div className="flex items-center gap-4">
                  <Avatar className="w-16 h-16">
                    <AvatarImage src={profile.avatar_url || undefined} />
                    <AvatarFallback className="text-lg">
                      {(profile.full_name || "?").charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="font-semibold text-lg text-foreground truncate">
                        {profile.full_name || "Arrendatario"}
                      </p>
                      {profile.verified && (
                        <ShieldCheck className="w-4 h-4 text-primary shrink-0" />
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                      <Clock className="w-3 h-3" />
                      En la app desde{" "}
                      {format(new Date(profile.member_since), "MMM yyyy", {
                        locale: es,
                      })}
                      {" · "}
                      {monthsLabel(memberMonths)}
                    </p>
                  </div>
                </div>

                {/* Rating */}
                <div className="rounded-lg border border-border bg-card p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">
                        Calificación como arrendatario
                      </p>
                      <div className="flex items-baseline gap-1 mt-1">
                        <Star className="w-5 h-5 text-primary fill-primary" />
                        <span className="text-2xl font-bold text-foreground">
                          {profile.avg_rating
                            ? Number(profile.avg_rating).toFixed(1)
                            : "—"}
                        </span>
                        <span className="text-sm text-muted-foreground">
                          / 5
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">
                        Reseñas
                      </p>
                      <p className="text-xl font-semibold text-foreground">
                        {profile.review_count}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Verifications */}
                <div>
                  <h4 className="text-sm font-semibold text-foreground mb-1">
                    Verificaciones
                  </h4>
                  <div className="rounded-lg border border-border bg-card divide-y divide-border px-4">
                    <VerifiedRow
                      ok={profile.email_verified}
                      icon={Mail}
                      label="Correo electrónico"
                    />
                    <VerifiedRow
                      ok={profile.phone_verified}
                      icon={Phone}
                      label="Teléfono"
                    />
                    <VerifiedRow
                      ok={profile.social_verified}
                      icon={Globe}
                      label="Red social"
                      detail={
                        profile.social_verified
                          ? [
                              profile.social_platform,
                              profile.social_age_months
                                ? `${monthsLabel(profile.social_age_months)} de antigüedad`
                                : null,
                            ]
                              .filter(Boolean)
                              .join(" · ")
                          : undefined
                      }
                    />
                  </div>
                  {profile.verification_status &&
                    profile.verification_status !== "approved" && (
                      <p className="text-xs text-muted-foreground mt-2">
                        Estado de verificación:{" "}
                        <span className="font-medium">
                          {profile.verification_status}
                        </span>
                      </p>
                    )}
                </div>

                {/* Reviews */}
                {profile.reviews && profile.reviews.length > 0 && (
                  <>
                    <Separator />
                    <div>
                      <h4 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-1.5">
                        <MessageSquareText className="w-4 h-4" />
                        Comentarios recientes de aliados
                      </h4>
                      <div className="space-y-3">
                        {profile.reviews.map((r, i) => (
                          <div
                            key={i}
                            className="rounded-lg border border-border bg-card p-3"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-1">
                                {Array.from({ length: 5 }).map((_, idx) => (
                                  <Star
                                    key={idx}
                                    className={
                                      idx < r.rating
                                        ? "w-3.5 h-3.5 text-primary fill-primary"
                                        : "w-3.5 h-3.5 text-muted-foreground/30"
                                    }
                                  />
                                ))}
                              </div>
                              <span className="text-[10px] text-muted-foreground">
                                {format(new Date(r.created_at), "dd MMM yyyy", {
                                  locale: es,
                                })}
                              </span>
                            </div>
                            {r.comment && (
                              <p className="text-sm text-foreground/90 mt-2 whitespace-pre-wrap">
                                {r.comment}
                              </p>
                            )}
                            {(r.renter_responsibility || r.punctuality) && (
                              <div className="flex gap-3 mt-2 text-[11px] text-muted-foreground">
                                {r.renter_responsibility != null && (
                                  <span>
                                    Responsabilidad: {r.renter_responsibility}/5
                                  </span>
                                )}
                                {r.punctuality != null && (
                                  <span>Puntualidad: {r.punctuality}/5</span>
                                )}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};

export default RenterProfileDialog;
