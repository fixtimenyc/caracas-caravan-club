import { Check, Shield, Smartphone, Star } from "lucide-react";

const features = [
  {
    icon: <Shield className="w-8 h-8" />,
    title: "100% Seguro",
    description: "Todos los vehículos están verificados y cuentan con seguro incluido en cada reserva.",
  },
  {
    icon: <Smartphone className="w-8 h-8" />,
    title: "Reserva fácil",
    description: "Reserva en minutos desde tu teléfono. Sin papeleos, sin complicaciones.",
  },
  {
    icon: <Star className="w-8 h-8" />,
    title: "Propietarios verificados",
    description: "Comunidad de anfitriones evaluados con calificaciones reales de usuarios.",
  },
  {
    icon: <Check className="w-8 h-8" />,
    title: "Cancelación flexible",
    description: "Cancela gratis hasta 24 horas antes de tu reserva sin cargos adicionales.",
  },
];

const HowItWorks = () => {
  return (
    <section className="py-20 bg-secondary/30">
      <div className="container mx-auto px-4">
        {/* Header */}
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            ¿Por qué elegir RuedaVe?
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            La forma más fácil y segura de alquilar un vehículo en Venezuela
          </p>
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {features.map((feature, index) => (
            <div
              key={index}
              className="bg-card rounded-2xl p-6 text-center shadow-soft hover:shadow-card transition-smooth group"
            >
              <div className="w-16 h-16 bg-gradient-hero rounded-2xl flex items-center justify-center mx-auto mb-5 text-primary-foreground group-hover:scale-110 transition-bounce">
                {feature.icon}
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-3">
                {feature.title}
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default HowItWorks;
