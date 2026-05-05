import { useEffect, useState } from "react";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { Star, MessageSquare } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import StarRating from "./StarRating";
import { supabase } from "@/integrations/supabase/client";

interface ReviewsSectionProps {
  vehicleId: string;
}

type ReviewRow = {
  id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  author_id: string;
  car_condition: number | null;
  owner_communication: number | null;
  listing_accuracy: number | null;
};

type AuthorMap = Record<string, { full_name: string | null; avatar_url: string | null }>;

const ReviewsSection = ({ vehicleId }: ReviewsSectionProps) => {
  const [loading, setLoading] = useState(true);
  const [reviews, setReviews] = useState<ReviewRow[]>([]);
  const [summary, setSummary] = useState<{ avg: number | null; count: number }>(
    { avg: null, count: 0 }
  );
  const [authors, setAuthors] = useState<AuthorMap>({});

  useEffect(() => {
    const load = async () => {
      setLoading(true);

      const [{ data: reviewData }, { data: summaryData }] = await Promise.all([
        supabase
          .from("reviews")
          .select(
            "id, rating, comment, created_at, author_id, car_condition, owner_communication, listing_accuracy"
          )
          .eq("vehicle_id", vehicleId)
          .eq("reviewer_type", "renter")
          .order("created_at", { ascending: false })
          .limit(20),
        supabase.rpc("vehicle_rating_summary", { _vehicle_id: vehicleId }),
      ]);

      const list = (reviewData || []) as ReviewRow[];
      setReviews(list);

      const summaryRow = (summaryData as Array<{ avg_rating: number | null; review_count: number }> | null)?.[0];
      setSummary({
        avg: summaryRow?.avg_rating ? Number(summaryRow.avg_rating) : null,
        count: Number(summaryRow?.review_count || 0),
      });

      if (list.length > 0) {
        const authorIds = [...new Set(list.map((r) => r.author_id))];
        const { data: profs } = await supabase
          .from("profiles_public" as any)
          .select("user_id, full_name, avatar_url")
          .in("user_id", authorIds);
        const map: AuthorMap = {};
        (profs || []).forEach((p: any) => {
          map[p.user_id] = { full_name: p.full_name, avatar_url: p.avatar_url };
        });
        setAuthors(map);
      }

      setLoading(false);
    };
    load();
  }, [vehicleId]);

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="grid md:grid-cols-2 gap-4">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
      </div>
    );
  }

  return (
    <section>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <h2 className="text-2xl font-bold text-foreground">
          Reseñas
        </h2>
        {summary.count > 0 && summary.avg !== null && (
          <div className="flex items-center gap-2">
            <Star className="w-5 h-5 fill-accent text-accent" />
            <span className="text-lg font-bold text-foreground">
              {summary.avg.toFixed(1)}
            </span>
            <span className="text-sm text-muted-foreground">
              · {summary.count} {summary.count === 1 ? "reseña" : "reseñas"}
            </span>
          </div>
        )}
      </div>

      {reviews.length === 0 ? (
        <Card className="p-8 text-center">
          <MessageSquare className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-50" />
          <p className="text-muted-foreground text-sm">
            Este vehículo aún no tiene reseñas públicas. Las reseñas aparecen una vez
            que ambas partes (arrendatario y anfitrión) las publican, o automáticamente
            tras 7 días.
          </p>
        </Card>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {reviews.map((r) => {
            const author = authors[r.author_id];
            const name = author?.full_name || "Arrendatario";
            return (
              <Card key={r.id} className="p-5">
                <div className="flex items-start gap-3 mb-3">
                  <Avatar className="w-10 h-10">
                    <AvatarImage src={author?.avatar_url || ""} />
                    <AvatarFallback className="bg-primary text-primary-foreground text-sm font-bold">
                      {name
                        .split(" ")
                        .map((n) => n[0])
                        .slice(0, 2)
                        .join("")}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-foreground truncate">{name}</p>
                    <p className="text-xs text-muted-foreground">
                      {format(parseISO(r.created_at), "PPP", { locale: es })}
                    </p>
                  </div>
                  <StarRating value={r.rating} readOnly size="sm" />
                </div>

                {(r.car_condition || r.owner_communication || r.listing_accuracy) && (
                  <div className="grid grid-cols-3 gap-2 mb-3 text-xs text-muted-foreground">
                    <div>
                      <p className="mb-0.5">Vehículo</p>
                      <StarRating value={r.car_condition || 0} readOnly size="sm" />
                    </div>
                    <div>
                      <p className="mb-0.5">Comunicación</p>
                      <StarRating value={r.owner_communication || 0} readOnly size="sm" />
                    </div>
                    <div>
                      <p className="mb-0.5">Precisión</p>
                      <StarRating value={r.listing_accuracy || 0} readOnly size="sm" />
                    </div>
                  </div>
                )}

                {r.comment && (
                  <p className="text-sm text-foreground/90 leading-relaxed">
                    {r.comment}
                  </p>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </section>
  );
};

export default ReviewsSection;
