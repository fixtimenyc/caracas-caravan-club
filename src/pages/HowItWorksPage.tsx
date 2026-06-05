import { Search, CalendarCheck, Key, Star, Shield, Smartphone, Check, CreditCard, MapPin, MessageCircle } from "lucide-react";
import { Helmet } from "react-helmet-async";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import CTASection from "@/components/CTASection";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";

const renterSteps = [
  {
    icon: <Search className="w-7 h-7" />,
    title: "Busca tu vehículo",
    description: "Explora cientos de vehículos en Caracas. Filtra por ubicación, tipo, precio y fechas para encontrar el ideal.",
  },
  {
    icon: <CalendarCheck className="w-7 h-7" />,
    title: "Reserva en minutos",
    description: "Selecciona las fechas, envía tu solicitud y espera la aprobación del propietario. Todo desde tu teléfono.",
  },
  {
    icon: <CreditCard className="w-7 h-7" />,
    title: "Paga de forma segura",
    description: "Realiza el pago a través de nuestra plataforma con métodos locales. Tu dinero está protegido hasta entregar el vehículo.",
  },
  {
    icon: <Key className="w-7 h-7" />,
    title: "Recoge y disfruta",
    description: "Coordina la entrega con el propietario, revisa el vehículo y disfruta tu viaje por Caracas y Venezuela.",
  },
];

const ownerSteps = [
  {
    icon: <Car className="w-7 h-7" />,
    title: "Publica tu vehículo",
    description: "Sube fotos, agrega los detalles y describe tu vehículo. La publicación es 100% gratis.",
  },
  {
    icon: <CalendarCheck className="w-7 h-7" />,
    title: "Define precio y disponibilidad",
    description: "Tú decides el precio por día y los días en que tu vehículo está disponible para alquilar.",
  },
  {
    icon: <Check className="w-7 h-7" />,
    title: "Aprueba solicitudes",
    description: "Revisa el perfil de los arrendatarios y aprueba o rechaza las solicitudes según tu criterio.",
  },
  {
    icon: <CreditCard className="w-7 h-7" />,
    title: "Recibe tus ingresos",
    description: "Cobra de forma segura por cada reserva completada. Consulta tus ingresos desde el panel.",
  },
];

const benefits = [
  {
    icon: <Shield className="w-8 h-8" />,
    title: "100% Seguro",
    description: "Vehículos verificados con seguro incluido en cada reserva.",
  },
  {
    icon: <Smartphone className="w-8 h-8" />,
    title: "Reserva fácil",
    description: "Sin papeleos ni complicaciones, todo desde tu móvil.",
  },
  {
    icon: <Star className="w-8 h-8" />,
    title: "Comunidad verificada",
    description: "Anfitriones y arrendatarios evaluados con calificaciones reales.",
  },
  {
    icon: <MessageCircle className="w-8 h-8" />,
    title: "Soporte 24/7",
    description: "Equipo de ayuda disponible en cualquier momento del día.",
  },
];

const faqs = [
  {
    q: "¿Necesito una licencia especial para alquilar?",
    a: "Solo necesitas tu cédula de identidad y licencia de conducir vigente venezolana o internacional.",
  },
  {
    q: "¿Qué incluye el precio del alquiler?",
    a: "El precio incluye el uso del vehículo y el seguro básico. Combustible y peajes corren por cuenta del arrendatario.",
  },
  {
    q: "¿Puedo cancelar una reserva?",
    a: "Sí, puedes cancelar gratis hasta 24 horas antes del inicio de la reserva sin cargos adicionales.",
  },
  {
    q: "¿Cómo se entrega el vehículo?",
    a: "Coordinas directamente con el propietario el lugar y hora de entrega dentro del área metropolitana de Caracas.",
  },
  {
    q: "¿Qué pasa si el vehículo sufre un daño?",
    a: "El seguro cubre la mayoría de incidentes. Reporta el caso a soporte y nuestro equipo te guiará en el proceso.",
  },
];

import { Car } from "lucide-react";

const HowItWorksPage = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen">
      <Helmet>
        <title>Cómo funciona RuedaVe - Alquila o publica tu vehículo</title>
        <meta name="description" content="Aprende cómo alquilar un vehículo o convertirte en anfitrión en RuedaVe Caracas: proceso paso a paso, beneficios y respuestas a preguntas frecuentes." />
        <link rel="canonical" href="https://caracas-caravan-club.lovable.app/como-funciona" />
        <meta property="og:title" content="Cómo funciona RuedaVe" />
        <meta property="og:description" content="Alquilar o publicar tu vehículo en Caracas paso a paso." />
        <meta property="og:url" content="https://caracas-caravan-club.lovable.app/como-funciona" />
        <meta property="og:type" content="website" />
        <script type="application/ld+json">{JSON.stringify({
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: faqs.map((f) => ({
            "@type": "Question",
            name: f.q,
            acceptedAnswer: { "@type": "Answer", text: f.a },
          })),
        })}</script>
      </Helmet>
      <Navbar />
      <main className="pt-16">
        {/* Hero */}
        <section className="relative py-20 md:py-28 bg-gradient-hero overflow-hidden">
          <div className="container mx-auto px-4 text-center relative z-10">
            <h1 className="text-4xl md:text-6xl font-bold text-primary-foreground mb-6">
              Cómo funciona RuedaVe
            </h1>
            <p className="text-lg md:text-xl text-primary-foreground/90 max-w-2xl mx-auto mb-8">
              Alquilar o publicar tu vehículo en Caracas nunca fue tan fácil. Conoce el proceso paso a paso.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <Button variant="heroOutline" size="lg" onClick={() => navigate('/auth')}>
                Comenzar ahora
              </Button>
            </div>
          </div>
        </section>

        {/* For Renters */}
        <section className="py-20">
          <div className="container mx-auto px-4">
            <div className="text-center mb-14">
              <span className="inline-block px-4 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-semibold mb-4">
                Para arrendatarios
              </span>
              <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
                Alquila un vehículo en 4 pasos
              </h2>
              <p className="text-muted-foreground max-w-2xl mx-auto">
                Encuentra el vehículo perfecto para tu próximo viaje en Caracas
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {renterSteps.map((step, i) => (
                <Card key={i} className="p-6 relative hover:shadow-card transition-smooth">
                  <div className="absolute -top-3 -left-3 w-10 h-10 rounded-full bg-gradient-hero text-primary-foreground font-bold flex items-center justify-center shadow-soft">
                    {i + 1}
                  </div>
                  <div className="w-14 h-14 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-4 mt-2">
                    {step.icon}
                  </div>
                  <h3 className="text-lg font-semibold text-foreground mb-2">{step.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{step.description}</p>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* For Owners */}
        <section className="py-20 bg-secondary/30">
          <div className="container mx-auto px-4">
            <div className="text-center mb-14">
              <span className="inline-block px-4 py-1.5 rounded-full bg-accent/50 text-accent-foreground text-sm font-semibold mb-4">
                Para propietarios
              </span>
              <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
                Genera ingresos con tu vehículo
              </h2>
              <p className="text-muted-foreground max-w-2xl mx-auto">
                Convierte tu vehículo en una fuente de ingresos pasivos
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {ownerSteps.map((step, i) => (
                <Card key={i} className="p-6 relative hover:shadow-card transition-smooth bg-card">
                  <div className="absolute -top-3 -left-3 w-10 h-10 rounded-full bg-foreground text-background font-bold flex items-center justify-center shadow-soft">
                    {i + 1}
                  </div>
                  <div className="w-14 h-14 rounded-xl bg-accent/40 text-accent-foreground flex items-center justify-center mb-4 mt-2">
                    {step.icon}
                  </div>
                  <h3 className="text-lg font-semibold text-foreground mb-2">{step.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{step.description}</p>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* Benefits */}
        <section className="py-20">
          <div className="container mx-auto px-4">
            <div className="text-center mb-14">
              <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
                ¿Por qué elegir RuedaVe?
              </h2>
              <p className="text-muted-foreground max-w-2xl mx-auto">
                Diseñado pensando en la realidad venezolana
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {benefits.map((b, i) => (
                <div key={i} className="text-center p-6">
                  <div className="w-16 h-16 bg-gradient-hero rounded-2xl flex items-center justify-center mx-auto mb-5 text-primary-foreground">
                    {b.icon}
                  </div>
                  <h3 className="text-lg font-semibold text-foreground mb-2">{b.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{b.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="py-20 bg-secondary/30">
          <div className="container mx-auto px-4 max-w-3xl">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
                Preguntas frecuentes
              </h2>
              <p className="text-muted-foreground">Todo lo que necesitas saber antes de empezar</p>
            </div>

            <div className="space-y-4">
              {faqs.map((f, i) => (
                <Card key={i} className="p-6">
                  <h3 className="font-semibold text-foreground mb-2 flex items-start gap-2">
                    <span className="text-primary">•</span>
                    {f.q}
                  </h3>
                  <p className="text-sm text-muted-foreground leading-relaxed pl-4">{f.a}</p>
                </Card>
              ))}
            </div>
          </div>
        </section>

        <CTASection />
      </main>
      <Footer />
    </div>
  );
};

export default HowItWorksPage;
