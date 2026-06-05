import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import Navbar from "@/components/Navbar";
import HeroSection from "@/components/HeroSection";
import FeaturedCars from "@/components/FeaturedCars";
import HowItWorks from "@/components/HowItWorks";
import CTASection from "@/components/CTASection";
import Footer from "@/components/Footer";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

const Index = () => {
  const { user, loading, hasRole } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading || !user) return;
    // Only renters (not owners/admins) need the verification questionnaire
    if (hasRole("admin") || hasRole("owner")) return;
    if (!hasRole("renter")) return;

    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("renter_verifications")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();
      if (cancelled) return;
      if (!data) navigate("/arrendatario/verificacion");
    })();
    return () => {
      cancelled = true;
    };
  }, [user, loading, hasRole, navigate]);

  return (
    <div className="min-h-screen">
      <Helmet>
        <title>RuedaVe - Alquiler de Vehículos en Caracas, Venezuela</title>
        <meta name="description" content="Alquila vehículos de propietarios verificados en Caracas. Sedanes, SUVs, camionetas y más. Fácil, seguro y al mejor precio." />
        <link rel="canonical" href="https://caracas-caravan-club.lovable.app/" />
        <meta property="og:title" content="RuedaVe - Alquiler de Vehículos en Caracas" />
        <meta property="og:description" content="Conectamos propietarios con personas que necesitan un vehículo. Fácil, seguro y al mejor precio." />
        <meta property="og:url" content="https://caracas-caravan-club.lovable.app/" />
        <meta property="og:type" content="website" />
      </Helmet>
      <Navbar />
      <main>
        <HeroSection />
        <FeaturedCars />
        <HowItWorks />
        <CTASection />
      </main>
      <Footer />
    </div>
  );
};

export default Index;
