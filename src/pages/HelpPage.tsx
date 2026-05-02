import { useMemo, useState } from "react";
import { z } from "zod";
import {
  Search,
  HelpCircle,
  CalendarDays,
  CreditCard,
  Car,
  ShieldCheck,
  UserCog,
  MessageSquare,
  Send,
  Phone,
  Mail,
  Loader2,
} from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

const WHATSAPP_NUMBER = "584121234567"; // RuedaVe soporte

type Category = {
  id: string;
  label: string;
  icon: typeof CalendarDays;
  faqs: { q: string; a: string }[];
};

const categories: Category[] = [
  {
    id: "reservas",
    label: "Reservas",
    icon: CalendarDays,
    faqs: [
      {
        q: "¿Cómo reservo un vehículo?",
        a: "Busca el vehículo que te interesa en el catálogo, selecciona las fechas en el calendario y haz clic en 'Reservar'. El anfitrión tiene 24 horas para aprobar tu solicitud.",
      },
      {
        q: "¿Puedo cancelar una reserva?",
        a: "Sí. Mientras la reserva esté en estado 'Pendiente' puedes cancelarla sin cargo desde tu panel. Una vez aprobada, aplican las políticas de cancelación.",
      },
      {
        q: "¿Qué pasa si el anfitrión no responde en 24 horas?",
        a: "La solicitud expira automáticamente y no se te cobra nada. Te recomendamos buscar otro vehículo disponible.",
      },
    ],
  },
  {
    id: "pagos",
    label: "Pagos",
    icon: CreditCard,
    faqs: [
      {
        q: "¿Qué métodos de pago aceptan?",
        a: "Aceptamos transferencias bancarias en bolívares, Pago Móvil, Zelle y tarjetas internacionales. Los precios se muestran en USD como referencia.",
      },
      {
        q: "¿Cuándo se cobra la reserva?",
        a: "El cobro se realiza al momento que el anfitrión aprueba tu solicitud. Mientras esté pendiente, no se descuenta ningún monto.",
      },
      {
        q: "¿Hay cargos adicionales?",
        a: "Sí: una comisión de servicio del 10% y un seguro diario de $8. Ambos se muestran desglosados antes de confirmar la reserva.",
      },
    ],
  },
  {
    id: "aliados",
    label: "Aliados",
    icon: Car,
    faqs: [
      {
        q: "¿Cómo me convierto en aliado?",
        a: "Completa la solicitud en 'Convertirte en anfitrión' con los datos de tu vehículo y documentos. Nuestro equipo revisa tu aplicación en 24-48 horas.",
      },
      {
        q: "¿Qué documentos necesito?",
        a: "Cédula de identidad, título de propiedad del vehículo, póliza de seguro vigente y fotos del vehículo (mínimo 4 ángulos).",
      },
      {
        q: "¿Cuánto gano por alquiler?",
        a: "Recibes el 70% del precio total. RuedaVe retiene un 30% que cubre comisión de plataforma, soporte y procesamiento de pagos.",
      },
    ],
  },
  {
    id: "cuenta",
    label: "Mi cuenta",
    icon: UserCog,
    faqs: [
      {
        q: "¿Cómo cambio mis datos personales?",
        a: "Ve a 'Mi perfil' desde el menú superior. Allí puedes actualizar tu nombre, teléfono, dirección y cédula.",
      },
      {
        q: "¿Cómo elimino mi cuenta?",
        a: "Escríbenos un ticket de soporte solicitando la eliminación. Procesaremos tu solicitud en un plazo máximo de 7 días hábiles.",
      },
    ],
  },
  {
    id: "seguridad",
    label: "Seguridad",
    icon: ShieldCheck,
    faqs: [
      {
        q: "¿Los anfitriones están verificados?",
        a: "Sí. Verificamos identidad, propiedad del vehículo y póliza de seguro antes de aprobar a cada aliado. Verás un sello 'Verificado' en su perfil.",
      },
      {
        q: "¿Qué cubre el seguro?",
        a: "El seguro incluido cubre daños menores y responsabilidad civil. Para coberturas mayores te recomendamos contratar un seguro complementario.",
      },
      {
        q: "¿Qué hago en caso de accidente?",
        a: "Contacta inmediatamente al anfitrión y a nuestra línea de emergencia 24/7 vía WhatsApp. Documenta el incidente con fotos y reporte policial si aplica.",
      },
    ],
  },
];

const ticketSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Ingresa tu nombre")
    .max(100, "Máximo 100 caracteres"),
  email: z
    .string()
    .trim()
    .email("Correo inválido")
    .max(255, "Máximo 255 caracteres"),
  subject: z
    .string()
    .trim()
    .min(3, "Asunto muy corto")
    .max(150, "Máximo 150 caracteres"),
  category: z.enum([
    "reservas",
    "pagos",
    "aliados",
    "cuenta",
    "seguridad",
    "otro",
  ]),
  message: z
    .string()
    .trim()
    .min(10, "Cuéntanos un poco más (mínimo 10 caracteres)")
    .max(2000, "Máximo 2000 caracteres"),
});

type TicketForm = z.infer<typeof ticketSchema>;

const HelpPage = () => {
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState<TicketForm>({
    name: "",
    email: user?.email || "",
    subject: "",
    category: "otro",
    message: "",
  });

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return categories
      .filter((c) => activeCategory === "all" || c.id === activeCategory)
      .map((c) => ({
        ...c,
        faqs: c.faqs.filter(
          (f) =>
            !term ||
            f.q.toLowerCase().includes(term) ||
            f.a.toLowerCase().includes(term)
        ),
      }))
      .filter((c) => c.faqs.length > 0);
  }, [search, activeCategory]);

  const openWhatsApp = () => {
    const msg = encodeURIComponent(
      "Hola RuedaVe, necesito ayuda con mi cuenta."
    );
    window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${msg}`, "_blank");
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const result = ticketSchema.safeParse(form);
    if (!result.success) {
      toast.error(result.error.issues[0].message);
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.from("support_tickets").insert({
      user_id: user?.id ?? null,
      name: result.data.name,
      email: result.data.email,
      subject: result.data.subject,
      category: result.data.category,
      message: result.data.message,
    });
    setSubmitting(false);
    if (error) {
      toast.error("No se pudo enviar tu mensaje", { description: error.message });
      return;
    }
    toast.success("Mensaje enviado", {
      description: "Te responderemos al correo registrado en menos de 24 horas.",
    });
    setForm({
      name: "",
      email: user?.email || "",
      subject: "",
      category: "otro",
      message: "",
    });
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <main className="pt-24 pb-16">
        {/* Hero */}
        <section className="bg-gradient-hero text-primary-foreground py-16">
          <div className="container mx-auto px-4 text-center">
            <div className="w-16 h-16 bg-primary-foreground/15 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <HelpCircle className="w-8 h-8" />
            </div>
            <h1 className="text-4xl md:text-5xl font-bold mb-4">
              Centro de ayuda
            </h1>
            <p className="text-primary-foreground/80 max-w-2xl mx-auto mb-8">
              Encuentra respuestas a las preguntas más comunes o contáctanos
              directamente. Estamos para ti.
            </p>
            <div className="relative max-w-2xl mx-auto">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar en preguntas frecuentes…"
                className="pl-12 h-14 bg-card text-foreground border-0 shadow-card"
              />
            </div>
          </div>
        </section>

        {/* Categorías */}
        <section className="container mx-auto px-4 py-12">
          <div className="flex flex-wrap gap-2 justify-center mb-10">
            <Button
              variant={activeCategory === "all" ? "default" : "outline"}
              size="sm"
              onClick={() => setActiveCategory("all")}
            >
              Todas
            </Button>
            {categories.map((c) => {
              const Icon = c.icon;
              return (
                <Button
                  key={c.id}
                  variant={activeCategory === c.id ? "default" : "outline"}
                  size="sm"
                  onClick={() => setActiveCategory(c.id)}
                  className="gap-2"
                >
                  <Icon className="w-4 h-4" />
                  {c.label}
                </Button>
              );
            })}
          </div>

          {/* FAQs */}
          {filtered.length === 0 ? (
            <Card className="p-12 text-center max-w-2xl mx-auto">
              <HelpCircle className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground">
                No encontramos resultados. Intenta con otras palabras o
                escríbenos directamente.
              </p>
            </Card>
          ) : (
            <div className="max-w-3xl mx-auto space-y-8">
              {filtered.map((c) => {
                const Icon = c.icon;
                return (
                  <div key={c.id}>
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-10 h-10 bg-primary/10 text-primary rounded-xl flex items-center justify-center">
                        <Icon className="w-5 h-5" />
                      </div>
                      <h2 className="text-2xl font-bold text-foreground">
                        {c.label}
                      </h2>
                    </div>
                    <Card className="p-2">
                      <Accordion type="single" collapsible>
                        {c.faqs.map((f, i) => (
                          <AccordionItem
                            key={i}
                            value={`${c.id}-${i}`}
                            className="border-b last:border-0"
                          >
                            <AccordionTrigger className="px-4 text-left hover:no-underline">
                              {f.q}
                            </AccordionTrigger>
                            <AccordionContent className="px-4 text-muted-foreground leading-relaxed">
                              {f.a}
                            </AccordionContent>
                          </AccordionItem>
                        ))}
                      </Accordion>
                    </Card>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Contacto */}
        <section className="container mx-auto px-4 py-12">
          <div className="grid lg:grid-cols-2 gap-8 max-w-5xl mx-auto">
            {/* Canales rápidos */}
            <Card className="p-8 bg-gradient-hero text-primary-foreground">
              <h3 className="text-2xl font-bold mb-3">¿Necesitas hablar ya?</h3>
              <p className="text-primary-foreground/80 mb-8">
                Nuestro equipo de soporte responde en horario de oficina y para
                emergencias 24/7 vía WhatsApp.
              </p>

              <div className="space-y-4">
                <Button
                  size="lg"
                  variant="secondary"
                  className="w-full justify-start gap-3"
                  onClick={openWhatsApp}
                >
                  <MessageSquare className="w-5 h-5" />
                  Chatear por WhatsApp
                </Button>
                <a
                  href={`tel:+${WHATSAPP_NUMBER}`}
                  className="flex items-center gap-3 px-4 py-3 rounded-lg bg-primary-foreground/10 hover:bg-primary-foreground/20 transition-smooth"
                >
                  <Phone className="w-5 h-5" />
                  <div>
                    <p className="text-sm opacity-80">Llámanos</p>
                    <p className="font-semibold">+58 412 123 4567</p>
                  </div>
                </a>
                <a
                  href="mailto:hola@ruedave.com"
                  className="flex items-center gap-3 px-4 py-3 rounded-lg bg-primary-foreground/10 hover:bg-primary-foreground/20 transition-smooth"
                >
                  <Mail className="w-5 h-5" />
                  <div>
                    <p className="text-sm opacity-80">Email</p>
                    <p className="font-semibold">hola@ruedave.com</p>
                  </div>
                </a>
              </div>
            </Card>

            {/* Formulario */}
            <Card className="p-8">
              <h3 className="text-2xl font-bold mb-2 text-foreground">
                Envíanos un mensaje
              </h3>
              <p className="text-sm text-muted-foreground mb-6">
                Completa el formulario y te respondemos en menos de 24 horas.
              </p>

              <form onSubmit={submit} className="space-y-4">
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="name">Nombre</Label>
                    <Input
                      id="name"
                      value={form.name}
                      maxLength={100}
                      onChange={(e) =>
                        setForm({ ...form, name: e.target.value })
                      }
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="email">Correo</Label>
                    <Input
                      id="email"
                      type="email"
                      value={form.email}
                      maxLength={255}
                      onChange={(e) =>
                        setForm({ ...form, email: e.target.value })
                      }
                      required
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="category">Categoría</Label>
                  <Select
                    value={form.category}
                    onValueChange={(v) =>
                      setForm({ ...form, category: v as TicketForm["category"] })
                    }
                  >
                    <SelectTrigger id="category">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="reservas">Reservas</SelectItem>
                      <SelectItem value="pagos">Pagos</SelectItem>
                      <SelectItem value="aliados">Aliados</SelectItem>
                      <SelectItem value="cuenta">Mi cuenta</SelectItem>
                      <SelectItem value="seguridad">Seguridad</SelectItem>
                      <SelectItem value="otro">Otro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="subject">Asunto</Label>
                  <Input
                    id="subject"
                    value={form.subject}
                    maxLength={150}
                    onChange={(e) =>
                      setForm({ ...form, subject: e.target.value })
                    }
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="message">Mensaje</Label>
                  <Textarea
                    id="message"
                    rows={5}
                    value={form.message}
                    maxLength={2000}
                    onChange={(e) =>
                      setForm({ ...form, message: e.target.value })
                    }
                    required
                  />
                  <p className="text-xs text-muted-foreground text-right">
                    {form.message.length}/2000
                  </p>
                </div>

                <Button
                  type="submit"
                  size="lg"
                  className="w-full gap-2"
                  disabled={submitting}
                >
                  {submitting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                  Enviar mensaje
                </Button>
              </form>
            </Card>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default HelpPage;
