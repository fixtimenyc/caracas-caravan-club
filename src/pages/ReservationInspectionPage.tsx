import { useEffect, useState } from "react";
import { useParams, Navigate, Link } from "react-router-dom";
import { ArrowLeft, Loader2 } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import VehicleInspectionForm from "@/components/VehicleInspectionForm";

interface Props {
  type: "pickup" | "return";
}

export default function ReservationInspectionPage({ type }: Props) {
  const { id } = useParams<{ id: string }>();
  const { user, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [reservation, setReservation] = useState<any>(null);
  const [vehicle, setVehicle] = useState<any>(null);
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    if (!id || !user) return;
    (async () => {
      const { data: r } = await supabase
        .from("reservations")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (!r) { setLoading(false); return; }
      setReservation(r);
      const { data: v } = await supabase
        .from("vehicles")
        .select("*")
        .eq("id", r.vehicle_id)
        .maybeSingle();
      setVehicle(v);
      if (type === "pickup" && r.renter_id === user.id) setAllowed(true);
      if (type === "return" && v?.owner_id === user.id) setAllowed(true);
      setLoading(false);
    })();
  }, [id, user, type]);

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!user) return <Navigate to="/auth" replace />;
  if (!reservation || !vehicle) {
    return (
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <main className="flex-1 container mx-auto px-4 pt-24 pb-16">
          <p className="text-muted-foreground">Reserva no encontrada.</p>
        </main>
        <Footer />
      </div>
    );
  }
  if (!allowed) {
    return (
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <main className="flex-1 container mx-auto px-4 pt-24 pb-16">
          <p className="text-muted-foreground">No tienes permiso para esta inspección.</p>
        </main>
        <Footer />
      </div>
    );
  }

  const back = type === "pickup" ? "/mis-reservas" : "/owner-dashboard";

  return (
    <div className="min-h-screen flex flex-col bg-muted/20">
      <Navbar />
      <main className="flex-1 container mx-auto px-4 pt-24 pb-16 max-w-4xl">
        <Link to={back}>
          <Button variant="ghost" size="sm" className="mb-4">
            <ArrowLeft className="h-4 w-4 mr-2" /> Volver
          </Button>
        </Link>
        <div className="mb-6">
          <h1 className="text-2xl md:text-3xl font-bold">
            {type === "pickup" ? "Recepción del vehículo" : "Devolución del vehículo"}
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            {vehicle.brand} {vehicle.model} {vehicle.year} · Reserva{" "}
            {String(reservation.id).slice(0, 8)}
          </p>
        </div>
        <VehicleInspectionForm
          reservationId={reservation.id}
          vehicleId={vehicle.id}
          type={type}
          inspectorRole={type === "pickup" ? "renter" : "owner"}
          inspectorId={user.id}
          redirectTo={back}
        />
      </main>
      <Footer />
    </div>
  );
}
