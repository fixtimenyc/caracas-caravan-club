import { Button } from "@/components/ui/button";
import { ArrowRight, Car } from "lucide-react";
import { Link } from "react-router-dom";

const CTASection = () => {
  return (
    <section className="py-20 bg-gradient-hero relative overflow-hidden">
      {/* Decorative Elements */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-primary-foreground/5 rounded-full blur-3xl" />
      <div className="absolute bottom-0 left-0 w-72 h-72 bg-primary-foreground/5 rounded-full blur-3xl" />

      <div className="container mx-auto px-4 relative z-10">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-primary-foreground/10 backdrop-blur-sm rounded-full px-4 py-2 mb-6">
            <Car className="w-5 h-5 text-primary-foreground" />
            <span className="text-sm font-medium text-primary-foreground">
              ¿Tienes un vehículo?
            </span>
          </div>

          <h2 className="text-3xl md:text-5xl font-bold text-primary-foreground mb-6">
            Gana dinero compartiendo
            <span className="block">tu vehículo</span>
          </h2>

          <p className="text-lg text-primary-foreground/80 max-w-2xl mx-auto mb-10">
            Únete a cientos de propietarios que ya están generando ingresos extra alquilando su vehículo cuando no lo usan.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button variant="hero" size="xl" asChild>
              <Link to="/conviertete-en-anfitrion">
                Comenzar ahora
                <ArrowRight className="w-5 h-5" />
              </Link>
            </Button>
            <Button variant="heroOutline" size="xl" asChild>
              <Link to="/como-funciona">Ver cómo funciona</Link>
            </Button>
          </div>

          {/* Trust Stats */}
          <div className="mt-12 pt-12 border-t border-primary-foreground/20">
            <div className="grid grid-cols-3 gap-8 max-w-lg mx-auto">
              <div>
                <div className="text-2xl md:text-3xl font-bold text-primary-foreground">$800</div>
                <div className="text-xs text-primary-foreground/70">Promedio mensual</div>
              </div>
              <div>
                <div className="text-2xl md:text-3xl font-bold text-primary-foreground">24h</div>
                <div className="text-xs text-primary-foreground/70">Para aprobar</div>
              </div>
              <div>
                <div className="text-2xl md:text-3xl font-bold text-primary-foreground">0%</div>
                <div className="text-xs text-primary-foreground/70">Comisión inicial</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default CTASection;
