import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Shield, Activity, TrendingUp, ShieldAlert, BrainCircuit } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { useConsents, type ConsentType } from "@/hooks/useConsents";
import { toast } from "sonner";

interface ConsentDef {
  type: ConsentType;
  title: string;
  icon: typeof Activity;
  description: string;
  data: { label: string; collection: string; value: string }[];
  sharedWith: string;
}

const DEFS: ConsentDef[] = [
  {
    type: "telemetry",
    title: "Telemetría y Seguros",
    icon: Activity,
    description:
      "Capturamos datos de conducción durante el viaje para construir su perfil de riesgo y acceder a primas de seguro más bajas.",
    data: [
      { label: "Patrones de frenado brusco", collection: "Acelerómetro / GPS", value: "Predictor de siniestralidad" },
      { label: "Velocidad promedio vs. límites", collection: "GPS + mapas", value: "Evaluación de riesgo" },
      { label: "Horarios de conducción", collection: "GPS", value: "Riesgo nocturno" },
      { label: "Distancia por viaje", collection: "GPS", value: "Acumulación de exposición" },
      { label: "Uso del teléfono mientras conduce", collection: "Sensor de movimiento + touch", value: "Distracción = riesgo" },
    ],
    sharedWith: "Aseguradoras aliadas (datos agregados, nunca el evento crudo).",
  },
  {
    type: "dynamic_pricing",
    title: "Pricing Dinámico y Optimización de Flotas",
    icon: TrendingUp,
    description:
      "Usamos demanda y ocupación para sugerir mejores precios al propietario y descuentos al conductor.",
    data: [
      { label: "Demanda por zona y horario", collection: "Historial de reservas + geo", value: "Ajuste de precios en tiempo real" },
      { label: "Tasa de ocupación de vehículos", collection: "Datos de alquileres", value: "Optimización de inventario" },
      { label: "Tiempo promedio de alquiler por tipo", collection: "Datos transaccionales", value: "Planificación de flota" },
      { label: "Estacionalidad de demanda", collection: "Series temporales", value: "Anticipación de picos" },
    ],
    sharedWith: "Solo RuedaVe (uso interno).",
  },
  {
    type: "fraud_prevention",
    title: "Predicción de Comportamiento y Prevención de Fraude",
    icon: ShieldAlert,
    description:
      "Detectamos cuentas duplicadas, suplantación y patrones sospechosos para proteger a propietarios y conductores honestos.",
    data: [
      { label: "Patrones de cancelación", collection: "Historial de reservas", value: "Modelos de predicción" },
      { label: "Discrepancias perfil vs. comportamiento", collection: "Validación de identidad", value: "Detección de suplantación" },
      { label: "Historial de disputas y siniestros", collection: "Base de incidentes", value: "Scoring de riesgo" },
      { label: "Huella digital del dispositivo", collection: "IP, navegador, geolocalización", value: "Identificación de cuentas múltiples" },
    ],
    sharedWith: "Equipo interno de prevención de fraude y autoridades cuando la ley lo requiera.",
  },
  {
    type: "ai_training",
    title: "Entrenamiento de IA y Modelos de Movilidad",
    icon: BrainCircuit,
    description:
      "Sus datos de viaje, completamente anonimizados, pueden alimentar modelos de seguridad vial, planificación urbana y nuevos productos de movilidad. Nunca serán vendidos de forma identificable.",
    data: [
      { label: "Rutas y patrones de movilidad anonimizados", collection: "Agregado a nivel de zona", value: "Modelos de tráfico" },
      { label: "Comportamiento de conducción agregado", collection: "Telemetría sin identificadores", value: "Seguridad vial" },
      { label: "Series temporales de demanda", collection: "Reservas agregadas", value: "Planificación urbana" },
    ],
    sharedWith: "Socios académicos y de movilidad (siempre agregado y anónimo).",
  },
];

export default function PrivacySettingsPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { consents, loading, setConsent } = useConsents();

  useEffect(() => {
    if (!authLoading && !user) navigate("/auth");
  }, [authLoading, user, navigate]);

  const onToggle = async (type: ConsentType, value: boolean) => {
    const ok = await setConsent(type, value);
    if (ok) toast.success(value ? "Consentimiento otorgado" : "Consentimiento revocado");
    else toast.error("No se pudo actualizar el consentimiento");
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />
      <main className="flex-1 py-10">
        <div className="container mx-auto px-4 max-w-4xl">
          <header className="mb-8">
            <div className="flex items-center gap-3 mb-2">
              <Shield className="h-7 w-7 text-primary" />
              <h1 className="text-3xl font-bold text-foreground">Mis datos y privacidad</h1>
            </div>
            <p className="text-muted-foreground">
              Usted controla qué datos comparte con RuedaVe. Puede activar o desactivar cada
              consentimiento en cualquier momento conforme a la Ley Orgánica de Protección de
              Datos Personales.
            </p>
          </header>

          <div className="grid gap-5">
            {DEFS.map((d) => {
              const c = consents[d.type];
              const granted = c?.granted === true;
              const Icon = d.icon;
              return (
                <Card key={d.type}>
                  <CardHeader>
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3">
                        <div className="rounded-lg bg-primary/10 p-2 text-primary">
                          <Icon className="h-5 w-5" />
                        </div>
                        <div>
                          <CardTitle className="text-lg flex items-center gap-2">
                            {d.title}
                            {granted ? (
                              <Badge variant="default">Activo</Badge>
                            ) : (
                              <Badge variant="secondary">Inactivo</Badge>
                            )}
                          </CardTitle>
                          <CardDescription className="mt-1">{d.description}</CardDescription>
                        </div>
                      </div>
                      <Switch
                        checked={granted}
                        disabled={loading}
                        onCheckedChange={(v) => onToggle(d.type, v)}
                        aria-label={`Toggle ${d.title}`}
                      />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="rounded-md border border-border overflow-hidden">
                      <table className="w-full text-sm">
                        <thead className="bg-muted/50">
                          <tr>
                            <th className="text-left px-3 py-2 font-medium">Dato</th>
                            <th className="text-left px-3 py-2 font-medium">Cómo se recauda</th>
                            <th className="text-left px-3 py-2 font-medium">Para qué se usa</th>
                          </tr>
                        </thead>
                        <tbody>
                          {d.data.map((row) => (
                            <tr key={row.label} className="border-t border-border">
                              <td className="px-3 py-2 text-foreground">{row.label}</td>
                              <td className="px-3 py-2 text-muted-foreground">{row.collection}</td>
                              <td className="px-3 py-2 text-muted-foreground">{row.value}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <p className="mt-3 text-xs text-muted-foreground">
                      <strong>Se comparte con:</strong> {d.sharedWith}
                    </p>
                    {c && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        Última actualización: {new Date(c.updated_at).toLocaleString("es-VE")}
                      </p>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <p className="mt-8 text-xs text-muted-foreground text-center">
            Para más información lea nuestra{" "}
            <a href="/politica-privacidad" className="text-primary underline">
              Política de Privacidad
            </a>
            .
          </p>
        </div>
      </main>
      <Footer />
    </div>
  );
}
