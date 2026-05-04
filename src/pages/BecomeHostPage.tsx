import { Car, DollarSign, Calendar, Shield, Camera, Users, TrendingUp, CheckCircle2, Upload, FileCheck, Wallet } from "lucide-react";
import { useNavigate } from "react-router-dom";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

const benefits = [
  {
    icon: <DollarSign className="w-7 h-7" />,
    title: "Ingresos extra cada mes",
    description: "Pon a producir tu vehículo cuando no lo uses y genera ingresos pasivos en dólares o bolívares.",
  },
  {
    icon: <Shield className="w-7 h-7" />,
    title: "Protección incluida",
    description: "Cada reserva incluye cobertura básica para tu vehículo durante el alquiler.",
  },
  {
    icon: <Calendar className="w-7 h-7" />,
    title: "Tú controlas tu agenda",
    description: "Define los días disponibles y aprueba cada solicitud. Tú decides cuándo y a quién alquilar.",
  },
  {
    icon: <Users className="w-7 h-7" />,
    title: "Comunidad verificada",
    description: "Todos los arrendatarios pasan por un proceso de verificación con cédula y licencia.",
  },
  {
    icon: <TrendingUp className="w-7 h-7" />,
    title: "Sin costos iniciales",
    description: "Publicar tu vehículo es 100% gratis. Solo cobramos una pequeña comisión por reserva completada.",
  },
  {
    icon: <Wallet className="w-7 h-7" />,
    title: "Pagos seguros",
    description: "Recibe el pago de forma segura por cada reserva, directo a tu cuenta.",
  },
];

const steps = [
  {
    icon: <Camera className="w-7 h-7" />,
    title: "Sube fotos y datos",
    description: "Toma buenas fotos de tu vehículo y agrega marca, modelo, año y descripción.",
  },
  {
    icon: <DollarSign className="w-7 h-7" />,
    title: "Define tu precio",
    description: "Establece el precio por día. Te sugerimos un rango basado en vehículos similares en Caracas.",
  },
  {
    icon: <FileCheck className="w-7 h-7" />,
    title: "Recibe solicitudes",
    description: "Los arrendatarios verificados te enviarán solicitudes que tú apruebas o rechazas.",
  },
  {
    icon: <Wallet className="w-7 h-7" />,
    title: "Cobra y repite",
    description: "Entrega el vehículo, recibe tu pago y vuelve a publicar disponibilidad.",
  },
];

const requirements = [
  "Ser propietario del vehículo o tener autorización",
  "Documentos del vehículo vigentes (título, RCV, INTT)",
  "Vehículo en buen estado mecánico y estético",
  "Año 2010 o más reciente preferiblemente",
  "Cédula de identidad venezolana vigente",
  "Disponibilidad para coordinar entregas en Caracas",
];

const BecomeHostPage = () => {
  const navigate = useNavigate();
  const [pricePerDay, setPricePerDay] = useState(35);
  const [daysPerMonth, setDaysPerMonth] = useState(10);

  const handlePriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = Math.max(0, Math.min(500, Number(e.target.value) || 0));
    setPricePerDay(val);
  };

  const handleDaysChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = Math.max(0, Math.min(30, Number(e.target.value) || 0));
    setDaysPerMonth(val);
  };

  const monthlyGross = pricePerDay * daysPerMonth;
  const commission = Math.round(monthlyGross * 0.30);
  const monthlyNet = monthlyGross - commission;

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="pt-16">
        {/* Hero */}
        <section className="relative py-20 md:py-28 bg-gradient-hero overflow-hidden">
          <div className="container mx-auto px-4 relative z-10">
            <div className="max-w-3xl mx-auto text-center">
              <span className="inline-block px-4 py-1.5 rounded-full bg-white/15 text-primary-foreground text-sm font-semibold mb-6 backdrop-blur-sm">
                Conviértete en anfitrión
              </span>
              <h1 className="text-4xl md:text-6xl font-bold text-primary-foreground mb-6 leading-tight">
                Convierte tu vehículo en una fuente de ingresos
              </h1>
              <p className="text-lg md:text-xl text-primary-foreground/90 mb-8">
                Únete a la comunidad de anfitriones de RuedaVe en Caracas y empieza a generar ingresos con tu carro hoy mismo.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                <Button variant="hero" size="lg" onClick={() => navigate('/auth?mode=signup&role=owner')}>
                  Publicar mi vehículo
                </Button>
                <Button variant="heroOutline" size="lg" onClick={() => document.getElementById('calculator')?.scrollIntoView({ behavior: 'smooth' })}>
                  Calcular ingresos
                </Button>
              </div>
            </div>
          </div>
        </section>

        {/* Earnings Calculator */}
        <section id="calculator" className="py-20">
          <div className="container mx-auto px-4">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
                ¿Cuánto puedes ganar?
              </h2>
              <p className="text-muted-foreground max-w-2xl mx-auto">
                Calcula tus ingresos estimados según el precio y la disponibilidad de tu vehículo
              </p>
            </div>

            <Card className="max-w-4xl mx-auto p-6 md:p-10 shadow-card">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
                <div className="space-y-6">
                  <div>
                    <Label htmlFor="price" className="text-sm font-semibold mb-2 block">
                      Precio por día (USD)
                    </Label>
                    <Input
                      id="price"
                      type="number"
                      min={0}
                      max={500}
                      value={pricePerDay}
                      onChange={handlePriceChange}
                      className="text-lg h-12"
                    />
                    <p className="text-xs text-muted-foreground mt-1">Rango sugerido: $25 - $80</p>
                  </div>

                  <div>
                    <Label htmlFor="days" className="text-sm font-semibold mb-2 block">
                      Días alquilados al mes
                    </Label>
                    <Input
                      id="days"
                      type="number"
                      min={0}
                      max={30}
                      value={daysPerMonth}
                      onChange={handleDaysChange}
                      className="text-lg h-12"
                    />
                    <p className="text-xs text-muted-foreground mt-1">Promedio en Caracas: 8-15 días</p>
                  </div>
                </div>

                <div className="bg-gradient-hero rounded-2xl p-8 text-primary-foreground">
                  <p className="text-sm opacity-90 mb-2">Ingreso neto estimado</p>
                  <p className="text-5xl font-bold mb-1">${monthlyNet}</p>
                  <p className="text-sm opacity-90 mb-6">por mes</p>
                  <div className="space-y-2 pt-4 border-t border-white/20 text-sm">
                    <div className="flex justify-between">
                      <span className="opacity-90">Ingreso bruto</span>
                      <span className="font-semibold">${monthlyGross}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="opacity-90">Comisión RuedaVe (30%)</span>
                      <span className="font-semibold">-${commission}</span>
                    </div>
                  </div>
                </div>
              </div>
              <p className="text-xs text-muted-foreground text-center mt-6">
                * Estimación referencial. Los ingresos reales dependen de la demanda, ubicación y estado del vehículo.
              </p>
            </Card>
          </div>
        </section>

        {/* Benefits */}
        <section className="py-20 bg-secondary/30">
          <div className="container mx-auto px-4">
            <div className="text-center mb-14">
              <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
                Beneficios de ser anfitrión
              </h2>
              <p className="text-muted-foreground max-w-2xl mx-auto">
                Diseñado para que ganes más con menos esfuerzo
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {benefits.map((b, i) => (
                <Card key={i} className="p-6 hover:shadow-card transition-smooth">
                  <div className="w-14 h-14 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-4">
                    {b.icon}
                  </div>
                  <h3 className="text-lg font-semibold text-foreground mb-2">{b.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{b.description}</p>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* Steps */}
        <section className="py-20">
          <div className="container mx-auto px-4">
            <div className="text-center mb-14">
              <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
                Empieza en 4 pasos simples
              </h2>
              <p className="text-muted-foreground max-w-2xl mx-auto">
                Publica tu vehículo en menos de 10 minutos
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {steps.map((step, i) => (
                <Card key={i} className="p-6 relative hover:shadow-card transition-smooth">
                  <div className="absolute -top-3 -left-3 w-10 h-10 rounded-full bg-gradient-hero text-primary-foreground font-bold flex items-center justify-center shadow-soft">
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

        {/* Requirements */}
        <section className="py-20 bg-secondary/30">
          <div className="container mx-auto px-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center max-w-5xl mx-auto">
              <div>
                <span className="inline-block px-4 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-semibold mb-4">
                  Requisitos
                </span>
                <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
                  Lo que necesitas para empezar
                </h2>
                <p className="text-muted-foreground mb-6">
                  Asegurar la calidad y seguridad de la comunidad es nuestra prioridad. Estos son los requisitos básicos para publicar tu vehículo.
                </p>
                <Button variant="default" size="lg" onClick={() => navigate('/auth?mode=signup&role=owner')}>
                  <Upload className="w-4 h-4 mr-2" />
                  Empezar publicación
                </Button>
              </div>
              <Card className="p-6 md:p-8">
                <ul className="space-y-4">
                  {requirements.map((req, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <CheckCircle2 className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                      <span className="text-foreground">{req}</span>
                    </li>
                  ))}
                </ul>
              </Card>
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="py-20">
          <div className="container mx-auto px-4">
            <Card className="max-w-4xl mx-auto p-10 md:p-14 bg-gradient-hero text-center">
              <Car className="w-14 h-14 text-primary-foreground mx-auto mb-6" />
              <h2 className="text-3xl md:text-4xl font-bold text-primary-foreground mb-4">
                ¿Listo para empezar a generar ingresos?
              </h2>
              <p className="text-primary-foreground/90 mb-8 max-w-xl mx-auto">
                Únete a cientos de anfitriones que ya están aprovechando su vehículo en Caracas.
              </p>
              <Button variant="heroOutline" size="lg" onClick={() => navigate('/auth?mode=signup&role=owner')}>
                Publicar mi vehículo gratis
              </Button>
            </Card>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
};

export default BecomeHostPage;
