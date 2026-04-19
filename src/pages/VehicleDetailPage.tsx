import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { format, addDays, differenceInDays } from "date-fns";
import { es } from "date-fns/locale";
import {
  ChevronLeft,
  ChevronRight,
  Star,
  MapPin,
  Users,
  Fuel,
  Cog,
  Gauge,
  Calendar as CalendarIcon,
  Shield,
  CheckCircle2,
  MessageCircle,
  Heart,
  Share2,
  Clock,
} from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { DateRange } from "react-day-picker";

import carSedan from "@/assets/car-sedan.jpg";
import carSuv from "@/assets/car-suv.jpg";
import carCompact from "@/assets/car-compact.jpg";
import carPickup from "@/assets/car-pickup.jpg";

const vehicleData = {
  id: "1",
  name: "Toyota Corolla 2022",
  brand: "Toyota",
  model: "Corolla",
  year: 2022,
  price: 45,
  rating: 4.9,
  totalReviews: 128,
  location: "Las Mercedes",
  zone: "Caracas",
  photos: [carSedan, carSuv, carCompact, carPickup, carSedan],
  specs: {
    seats: 5,
    transmission: "Automático",
    fuel: "Gasolina",
    mileage: "45.000 km",
    doors: 4,
    color: "Plata",
  },
  description:
    "Toyota Corolla 2022 en excelente estado, ideal para la ciudad y viajes largos. Bajo consumo de combustible, aire acondicionado, dirección hidráulica y sistema de audio Bluetooth. Mantenimiento al día.",
  features: [
    "Aire acondicionado",
    "Bluetooth",
    "Cámara de reversa",
    "Vidrios eléctricos",
    "Cierre centralizado",
    "GPS",
  ],
  owner: {
    name: "Carlos Méndez",
    avatar: "",
    rating: 4.95,
    reviewCount: 87,
    responseRate: 98,
    responseTime: "1 hora",
    memberSince: "Marzo 2023",
    verified: true,
  },
};

const reviews = [
  {
    id: "r1",
    author: "María González",
    avatar: "",
    rating: 5,
    date: "Hace 2 semanas",
    comment:
      "Excelente experiencia. El carro estaba impecable y Carlos muy atento. Lo recomiendo 100%.",
  },
  {
    id: "r2",
    author: "Andrés Rivera",
    avatar: "",
    rating: 5,
    date: "Hace 1 mes",
    comment:
      "Muy puntual con la entrega y el vehículo en perfectas condiciones. Volvería a alquilar sin dudar.",
  },
  {
    id: "r3",
    author: "Lucía Pérez",
    avatar: "",
    rating: 4,
    date: "Hace 2 meses",
    comment:
      "Buen carro y buena comunicación. Solo el aire podría enfriar un poco más pero todo bien.",
  },
];

const VehicleDetailPage = () => {
  useParams<{ id: string }>();
  const [photoIndex, setPhotoIndex] = useState(0);
  const [isFavorite, setIsFavorite] = useState(false);
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: addDays(new Date(), 1),
    to: addDays(new Date(), 4),
  });

  const days =
    dateRange?.from && dateRange?.to
      ? Math.max(differenceInDays(dateRange.to, dateRange.from), 1)
      : 0;
  const subtotal = days * vehicleData.price;
  const serviceFee = Math.round(subtotal * 0.1);
  const insuranceFee = days * 8;
  const total = subtotal + serviceFee + insuranceFee;

  const nextPhoto = () =>
    setPhotoIndex((p) => (p + 1) % vehicleData.photos.length);
  const prevPhoto = () =>
    setPhotoIndex(
      (p) => (p - 1 + vehicleData.photos.length) % vehicleData.photos.length
    );

  const handleReserve = () => {
    if (!dateRange?.from || !dateRange?.to) {
      toast.error("Selecciona las fechas de tu reserva");
      return;
    }
    toast.success("Reserva iniciada", {
      description: `${days} días · $${total} total`,
    });
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <main className="container mx-auto px-4 py-8">
        {/* Breadcrumb */}
        <Link
          to="/"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4 transition-smooth"
        >
          <ChevronLeft className="w-4 h-4" />
          Volver al catálogo
        </Link>

        {/* Title */}
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-2">
              {vehicleData.name}
            </h1>
            <div className="flex flex-wrap items-center gap-4 text-sm">
              <div className="flex items-center gap-1">
                <Star className="w-4 h-4 fill-accent text-accent" />
                <span className="font-semibold text-foreground">
                  {vehicleData.rating}
                </span>
                <span className="text-muted-foreground">
                  ({vehicleData.totalReviews} reseñas)
                </span>
              </div>
              <div className="flex items-center gap-1 text-muted-foreground">
                <MapPin className="w-4 h-4" />
                <span>
                  {vehicleData.location}, {vehicleData.zone}
                </span>
              </div>
              <Badge variant="secondary" className="gap-1">
                <Shield className="w-3 h-3" /> Verificado
              </Badge>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={() => setIsFavorite(!isFavorite)}
            >
              <Heart
                className={cn(
                  "w-4 h-4",
                  isFavorite && "fill-accent text-accent"
                )}
              />
            </Button>
            <Button variant="outline" size="icon">
              <Share2 className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Photo Gallery */}
        <div className="relative rounded-2xl overflow-hidden bg-muted mb-2 aspect-[16/9] md:aspect-[21/9]">
          <img
            src={vehicleData.photos[photoIndex]}
            alt={`${vehicleData.name} - foto ${photoIndex + 1}`}
            className="w-full h-full object-cover transition-smooth"
          />
          <button
            onClick={prevPhoto}
            className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 bg-card/90 backdrop-blur-sm rounded-full flex items-center justify-center shadow-card hover:bg-card transition-smooth"
            aria-label="Foto anterior"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            onClick={nextPhoto}
            className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 bg-card/90 backdrop-blur-sm rounded-full flex items-center justify-center shadow-card hover:bg-card transition-smooth"
            aria-label="Foto siguiente"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
          <div className="absolute bottom-4 right-4 bg-card/90 backdrop-blur-sm rounded-lg px-3 py-1 text-sm font-medium">
            {photoIndex + 1} / {vehicleData.photos.length}
          </div>
        </div>

        {/* Thumbnails */}
        <div className="flex gap-2 mb-10 overflow-x-auto pb-2">
          {vehicleData.photos.map((photo, idx) => (
            <button
              key={idx}
              onClick={() => setPhotoIndex(idx)}
              className={cn(
                "relative shrink-0 w-24 h-16 rounded-lg overflow-hidden transition-smooth",
                photoIndex === idx
                  ? "ring-2 ring-primary"
                  : "opacity-70 hover:opacity-100"
              )}
            >
              <img
                src={photo}
                alt={`Miniatura ${idx + 1}`}
                className="w-full h-full object-cover"
              />
            </button>
          ))}
        </div>

        {/* Main Grid */}
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Left Column */}
          <div className="lg:col-span-2 space-y-8">
            {/* Specs */}
            <section>
              <h2 className="text-2xl font-bold text-foreground mb-4">
                Especificaciones
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {[
                  { icon: Users, label: "Asientos", value: vehicleData.specs.seats },
                  { icon: Cog, label: "Transmisión", value: vehicleData.specs.transmission },
                  { icon: Fuel, label: "Combustible", value: vehicleData.specs.fuel },
                  { icon: Gauge, label: "Kilometraje", value: vehicleData.specs.mileage },
                  { icon: Users, label: "Puertas", value: vehicleData.specs.doors },
                  { icon: CheckCircle2, label: "Color", value: vehicleData.specs.color },
                ].map((spec) => (
                  <Card key={spec.label} className="p-4 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center shrink-0">
                      <spec.icon className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">{spec.label}</p>
                      <p className="font-semibold text-foreground">{spec.value}</p>
                    </div>
                  </Card>
                ))}
              </div>
            </section>

            {/* Description */}
            <section>
              <h2 className="text-2xl font-bold text-foreground mb-3">
                Acerca de este vehículo
              </h2>
              <p className="text-muted-foreground leading-relaxed mb-4">
                {vehicleData.description}
              </p>
              <div className="grid grid-cols-2 gap-2">
                {vehicleData.features.map((feature) => (
                  <div key={feature} className="flex items-center gap-2 text-sm">
                    <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
                    <span className="text-foreground">{feature}</span>
                  </div>
                ))}
              </div>
            </section>

            {/* Owner Info */}
            <section>
              <h2 className="text-2xl font-bold text-foreground mb-4">
                Conoce a tu anfitrión
              </h2>
              <Card className="p-6">
                <div className="flex flex-col sm:flex-row items-start gap-4">
                  <Avatar className="w-20 h-20">
                    <AvatarImage src={vehicleData.owner.avatar} />
                    <AvatarFallback className="bg-primary text-primary-foreground text-xl font-bold">
                      {vehicleData.owner.name
                        .split(" ")
                        .map((n) => n[0])
                        .join("")}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-lg font-bold text-foreground">
                        {vehicleData.owner.name}
                      </h3>
                      {vehicleData.owner.verified && (
                        <Badge variant="secondary" className="gap-1">
                          <Shield className="w-3 h-3" /> Verificado
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground mb-3">
                      Miembro desde {vehicleData.owner.memberSince}
                    </p>
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <div className="flex items-center gap-1">
                          <Star className="w-4 h-4 fill-accent text-accent" />
                          <span className="font-bold text-foreground">
                            {vehicleData.owner.rating}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {vehicleData.owner.reviewCount} reseñas
                        </p>
                      </div>
                      <div>
                        <p className="font-bold text-foreground">
                          {vehicleData.owner.responseRate}%
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Tasa respuesta
                        </p>
                      </div>
                      <div>
                        <div className="flex items-center gap-1">
                          <Clock className="w-4 h-4 text-primary" />
                          <span className="font-bold text-foreground">
                            {vehicleData.owner.responseTime}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Tiempo respuesta
                        </p>
                      </div>
                    </div>
                  </div>
                  <Button variant="outline" className="gap-2">
                    <MessageCircle className="w-4 h-4" />
                    Contactar
                  </Button>
                </div>
              </Card>
            </section>

            {/* Location Map */}
            <section>
              <h2 className="text-2xl font-bold text-foreground mb-3">Ubicación</h2>
              <p className="text-muted-foreground mb-4">
                Zona de recogida: {vehicleData.location}, {vehicleData.zone}
              </p>
              <div className="rounded-2xl overflow-hidden border border-border">
                <iframe
                  title="Mapa de ubicación"
                  src={`https://www.google.com/maps?q=${encodeURIComponent(
                    vehicleData.location + ", " + vehicleData.zone + ", Venezuela"
                  )}&output=embed`}
                  className="w-full h-80 border-0"
                  loading="lazy"
                />
              </div>
            </section>

            {/* Availability Calendar */}
            <section>
              <h2 className="text-2xl font-bold text-foreground mb-3">
                Disponibilidad
              </h2>
              <p className="text-muted-foreground mb-4">
                Selecciona tus fechas de inicio y fin
              </p>
              <Card className="p-4 inline-block">
                <Calendar
                  mode="range"
                  selected={dateRange}
                  onSelect={setDateRange}
                  numberOfMonths={1}
                  disabled={(date) => date < new Date()}
                  locale={es}
                  className={cn("p-3 pointer-events-auto")}
                />
              </Card>
            </section>
          </div>

          {/* Right Column - Booking Card */}
          <div className="lg:col-span-1">
            <Card className="p-6 sticky top-24 shadow-card-hover">
              <div className="flex items-baseline gap-1 mb-4">
                <span className="text-3xl font-bold text-foreground">
                  ${vehicleData.price}
                </span>
                <span className="text-muted-foreground">/día</span>
              </div>

              <div className="space-y-3 mb-4">
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">
                    Recogida
                  </p>
                  <div className="flex items-center gap-2 p-3 border border-border rounded-lg">
                    <CalendarIcon className="w-4 h-4 text-primary" />
                    <span className="text-sm font-medium">
                      {dateRange?.from
                        ? format(dateRange.from, "PPP", { locale: es })
                        : "Selecciona fecha"}
                    </span>
                  </div>
                </div>
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">
                    Entrega
                  </p>
                  <div className="flex items-center gap-2 p-3 border border-border rounded-lg">
                    <CalendarIcon className="w-4 h-4 text-primary" />
                    <span className="text-sm font-medium">
                      {dateRange?.to
                        ? format(dateRange.to, "PPP", { locale: es })
                        : "Selecciona fecha"}
                    </span>
                  </div>
                </div>
              </div>

              <Separator className="my-4" />

              {/* Pricing Breakdown */}
              <div className="space-y-2 text-sm">
                <div className="flex justify-between text-muted-foreground">
                  <span>
                    ${vehicleData.price} × {days} {days === 1 ? "día" : "días"}
                  </span>
                  <span>${subtotal}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Tarifa de servicio</span>
                  <span>${serviceFee}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Seguro de protección</span>
                  <span>${insuranceFee}</span>
                </div>
              </div>

              <Separator className="my-4" />

              <div className="flex justify-between items-center mb-4">
                <span className="font-bold text-foreground">Total</span>
                <span className="text-2xl font-bold text-foreground">
                  ${total}
                </span>
              </div>

              <Button
                onClick={handleReserve}
                size="lg"
                className="w-full bg-gradient-accent hover:opacity-90 text-accent-foreground font-semibold shadow-accent"
              >
                Reservar ahora
              </Button>

              <p className="text-xs text-center text-muted-foreground mt-3">
                No se te cobrará todavía
              </p>
            </Card>
          </div>
        </div>

        {/* Reviews Section */}
        <section className="mt-16">
          <div className="flex items-center gap-3 mb-6">
            <Star className="w-6 h-6 fill-accent text-accent" />
            <h2 className="text-2xl font-bold text-foreground">
              {vehicleData.rating} · {vehicleData.totalReviews} reseñas
            </h2>
          </div>

          {/* Rating breakdown */}
          <div className="grid md:grid-cols-2 gap-8 mb-8">
            <div className="space-y-2">
              {[
                { label: "Limpieza", value: 4.9 },
                { label: "Comunicación", value: 5.0 },
                { label: "Puntualidad", value: 4.8 },
                { label: "Estado del vehículo", value: 4.9 },
              ].map((item) => (
                <div key={item.label} className="flex items-center gap-3">
                  <span className="text-sm text-foreground w-40">
                    {item.label}
                  </span>
                  <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full"
                      style={{ width: `${(item.value / 5) * 100}%` }}
                    />
                  </div>
                  <span className="text-sm font-semibold text-foreground w-8">
                    {item.value}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {reviews.map((review) => (
              <Card key={review.id} className="p-6">
                <div className="flex items-center gap-3 mb-3">
                  <Avatar>
                    <AvatarFallback className="bg-secondary text-secondary-foreground font-semibold">
                      {review.author
                        .split(" ")
                        .map((n) => n[0])
                        .join("")}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-semibold text-foreground">
                      {review.author}
                    </p>
                    <p className="text-xs text-muted-foreground">{review.date}</p>
                  </div>
                </div>
                <div className="flex gap-0.5 mb-2">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star
                      key={i}
                      className={cn(
                        "w-4 h-4",
                        i < review.rating
                          ? "fill-accent text-accent"
                          : "text-muted"
                      )}
                    />
                  ))}
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {review.comment}
                </p>
              </Card>
            ))}
          </div>

          <div className="text-center mt-8">
            <Button variant="outline" size="lg">
              Ver todas las reseñas
            </Button>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default VehicleDetailPage;
