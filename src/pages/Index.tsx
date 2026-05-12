import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
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
