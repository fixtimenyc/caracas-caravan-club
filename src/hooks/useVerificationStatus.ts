import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

type VerificationStatus = "pending" | "approved" | "rejected" | null;

export const useVerificationStatus = () => {
  const { user, roles, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [ownerApplicationStatus, setOwnerApplicationStatus] =
    useState<VerificationStatus>(null);
  const [renterVerificationStatus, setRenterVerificationStatus] =
    useState<VerificationStatus>(null);

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      setOwnerApplicationStatus(null);
      setRenterVerificationStatus(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    (async () => {
      const [{ data: ownerApplication }, { data: renterVerification }] =
        await Promise.all([
          supabase
            .from("owner_applications")
            .select("status")
            .eq("user_id", user.id)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle(),
          supabase
            .from("renter_verifications")
            .select("status")
            .eq("user_id", user.id)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle(),
        ]);

      if (cancelled) return;
      setOwnerApplicationStatus(
        (ownerApplication?.status as VerificationStatus) ?? null,
      );
      setRenterVerificationStatus(
        (renterVerification?.status as VerificationStatus) ?? null,
      );
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [authLoading, user]);

  return useMemo(() => {
    const isAdmin = roles.includes("admin");
    const isOwner = roles.includes("owner");
    const isRenter = roles.includes("renter");
    const metadataRole = (user?.user_metadata as any)?.role as string | undefined;
    const hasOwnerApplication = ownerApplicationStatus !== null;
    const isOwnerApplicant =
      !isAdmin &&
      !isOwner &&
      (hasOwnerApplication || metadataRole === "owner");
    const needsRenterVerification =
      !isAdmin &&
      !isOwner &&
      !isOwnerApplicant &&
      isRenter &&
      renterVerificationStatus === null;

    return {
      loading: authLoading || loading,
      ownerApplicationStatus,
      renterVerificationStatus,
      isAdmin,
      isOwner,
      isRenter,
      isOwnerApplicant,
      needsRenterVerification,
      roleLabel: isAdmin
        ? "Admin"
        : isOwner
          ? "Propietario"
          : isOwnerApplicant
            ? "Aliado pendiente"
            : "Arrendatario",
    };
  }, [
    authLoading,
    loading,
    ownerApplicationStatus,
    renterVerificationStatus,
    roles,
    user,
  ]);
};