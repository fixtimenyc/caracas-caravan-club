import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Calendar, MapPin, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CARACAS_ZONES } from "@/lib/locations";
import heroImage from "@/assets/hero-car.jpg";


const HeroSection = () => {
  const navigate = useNavigate();
  const today = new Date().toISOString().split("T")[0];
  const inThreeDays = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000)
    .toISOString()
    .split("T")[0];
  const [zone, setZone] = useState<string>("");
  const [from, setFrom] = useState<string>(today);
  const [to, setTo] = useState<string>(inThreeDays);

  const handleSearch = () => {
    const params = new URLSearchParams();
    if (zone) params.set("zona", zone);
    if (from) params.set("desde", from);
    if (to) params.set("hasta", to);
    const qs = params.toString();
    navigate(qs ? `/?${qs}#vehiculos` : "/#vehiculos");
    setTimeout(() => {
      const el = document.getElementById("vehiculos");
      if (el) el.scrollIntoView({ behavior: "smooth" });
    }, 50);
  };

  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
      {/* Background Image */}
      <div className="absolute inset-0 z-0">
        <img
          src={heroImage}
          alt="Vehículo en Caracas"
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-foreground/60 via-foreground/40 to-foreground/70" />
      </div>

      {/* Content */}
      <div className="relative z-10 container mx-auto px-4 pt-20">
        <div className="max-w-4xl mx-auto text-center mb-12">
          <h1 className="text-4xl md:text-6xl lg:text-7xl font-extrabold text-primary-foreground mb-6 animate-slide-up">
            Alquila el carro perfecto
            <span className="block text-accent">en Caracas</span>
          </h1>
          <p className="text-lg md:text-xl text-primary-foreground/80 max-w-2xl mx-auto animate-slide-up" style={{ animationDelay: "0.1s" }}>
            Conectamos propietarios con personas que necesitan un vehículo. 
            Fácil, seguro y al mejor precio.
          </p>
        </div>

        {/* Search Card */}
        <div className="max-w-4xl mx-auto animate-slide-up" style={{ animationDelay: "0.2s" }}>
          <div className="bg-card rounded-2xl shadow-card p-4 md:p-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {/* Location */}
              <div className="md:col-span-1">
                <label className="text-xs font-medium text-muted-foreground mb-2 block">
                  Ubicación
                </label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground z-10" />
                  <select
                    value={zone}
                    onChange={(e) => setZone(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 bg-muted rounded-xl text-foreground text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary appearance-none cursor-pointer"
                  >
                    <option value="">Todas las zonas</option>
                    {CARACAS_ZONES.map((z) => (
                      <option key={z} value={z}>
                        {z}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* From Date */}
              <div className="md:col-span-1">
                <label className="text-xs font-medium text-muted-foreground mb-2 block">
                  Desde
                </label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <input
                    type="date"
                    value={from}
                    onChange={(e) => setFrom(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 bg-muted rounded-xl text-foreground text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>

              {/* To Date */}
              <div className="md:col-span-1">
                <label className="text-xs font-medium text-muted-foreground mb-2 block">
                  Hasta
                </label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <input
                    type="date"
                    value={to}
                    onChange={(e) => setTo(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 bg-muted rounded-xl text-foreground text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>

              {/* Search Button */}
              <div className="md:col-span-1 flex items-end">
                <Button variant="hero" size="lg" className="w-full" onClick={handleSearch}>
                  <Search className="w-5 h-5" />
                  Buscar
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="max-w-3xl mx-auto mt-12 grid grid-cols-3 gap-8 animate-slide-up" style={{ animationDelay: "0.3s" }}>
          <div className="text-center">
            <div className="text-3xl md:text-4xl font-bold text-primary-foreground">500+</div>
            <div className="text-sm text-primary-foreground/70">Vehículos</div>
          </div>
          <div className="text-center">
            <div className="text-3xl md:text-4xl font-bold text-primary-foreground">2,000+</div>
            <div className="text-sm text-primary-foreground/70">Usuarios</div>
          </div>
          <div className="text-center">
            <div className="text-3xl md:text-4xl font-bold text-primary-foreground">4.9</div>
            <div className="text-sm text-primary-foreground/70">Calificación</div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
