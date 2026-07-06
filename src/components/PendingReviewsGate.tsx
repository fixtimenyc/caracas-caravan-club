import { useEffect, useState, useCallback } from "react";
import { useLocation } from "react-router-dom";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import ReviewDialog, { ReviewerType } from "./ReviewDialog";

type PendingReview = {
  reservationId: string;
  vehicleId: string;
  subjectUserId: string;
  reviewerType: ReviewerType;
  contextLabel: string;
};

// Routes where we should NOT interrupt with the mandatory review dialog
const EXCLUDED_PREFIXES = ["/auth", "/reset-password", "/forgot-password"];

const PendingReviewsGate = () => {
  const { user, loading } = useAuth();
  const location = useLocation();
  const [pending, setPending] = useState<PendingReview[]>([]);
  const [open, setOpen] = useState(false);

  const load = useCallback(async () => {
    if (!user) {
      setPending([]);
      return;
    }
    // Fetch completed reservations where user is either the renter or the vehicle owner
    const { data: rs } = await supabase
      .from("reservations")
      .select(
        "id, vehicle_id, renter_id, start_date, end_date, status, vehicles!inner(owner_id, brand, model, year)"
      )
      .eq("status", "completed");
    if (!rs || rs.length === 0) {
      setPending([]);
      return;
    }
    const relevant = rs.filter((r: any) => {
      const ownerId = r.vehicles?.owner_id;
      return r.renter_id === user.id || ownerId === user.id;
    });
    if (relevant.length === 0) {
      setPending([]);
      return;
    }
    const ids = relevant.map((r: any) => r.id);
    const { data: mine } = await supabase
      .from("reviews")
      .select("reservation_id")
      .eq("author_id", user.id)
      .in("reservation_id", ids);
    const submitted = new Set((mine || []).map((m: any) => m.reservation_id));
    const list: PendingReview[] = relevant
      .filter((r: any) => !submitted.has(r.id))
      .map((r: any) => {
        const isRenter = r.renter_id === user.id;
        const v = r.vehicles || {};
        return {
          reservationId: r.id,
          vehicleId: r.vehicle_id,
          subjectUserId: isRenter ? v.owner_id : r.renter_id,
          reviewerType: (isRenter ? "renter" : "owner") as ReviewerType,
          contextLabel: `${v.brand ?? ""} ${v.model ?? ""} ${v.year ?? ""} · ${format(
            new Date(r.start_date),
            "d MMM",
            { locale: es }
          )} → ${format(new Date(r.end_date), "d MMM yyyy", { locale: es })}`.trim(),
        };
      });
    setPending(list);
    setOpen(list.length > 0);
  }, [user]);

  useEffect(() => {
    if (loading) return;
    load();
  }, [loading, load, location.pathname]);

  const excluded = EXCLUDED_PREFIXES.some((p) => location.pathname.startsWith(p));
  if (!user || excluded || pending.length === 0) return null;

  const current = pending[0];

  return (
    <ReviewDialog
      key={current.reservationId + current.reviewerType}
      open={open}
      onOpenChange={setOpen}
      reservationId={current.reservationId}
      vehicleId={current.vehicleId}
      subjectUserId={current.subjectUserId}
      reviewerType={current.reviewerType}
      contextLabel={current.contextLabel}
      mandatory
      onSubmitted={() => {
        // Remove and continue with next
        setPending((prev) => prev.slice(1));
      }}
    />
  );
};

export default PendingReviewsGate;
