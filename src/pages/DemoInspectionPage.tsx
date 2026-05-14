import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, ClipboardCheck, AlertTriangle, Camera, Eye } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  INSPECTION_SECTIONS, FUEL_LEVELS, STATE_META,
  buildEmptyChecklist, summarizeChecklist, InspectionItemState,
} from "@/lib/inspectionChecklist";

const STATES: InspectionItemState[] = ["ok", "minor", "damage", "na"];

// Hipotético: arrendatario "Carlos Rodríguez" recibiendo un Toyota Corolla 2022
const DEMO_PRESET: Record<string, InspectionItemState> = {
  ...buildEmptyChecklist(),
  front_bumper: "minor",
  rear_left_door: "damage",
  tire_rl: "minor",
  fog_lights: "na",
  spare_tire: "ok",
};

export default function DemoInspectionPage() {
  const [checklist, setChecklist] = useState<Record<string, InspectionItemState>>(DEMO_PRESET);
  const [mileage, setMileage] = useState("48230");
  const [fuel, setFuel] = useState("3/4");
  const [notes, setNotes] = useState(
    "Vehículo recibido en buen estado general. Llaves entregadas, documentos completos. Aire acondicionado funcionando correctamente."
  );
  const [damageNotes, setDamageNotes] = useState(
    "Pequeño rayón de unos 5cm en el parachoques delantero (lado izquierdo). Abolladura leve en puerta trasera izquierda. Llanta trasera izquierda con desgaste menor."
  );
  const [signatureName, setSignatureName] = useState("Carlos José Rodríguez Pérez");
  const [accepted, setAccepted] = useState(true);
  const [readOnly, setReadOnly] = useState(false);

  const summary = summarizeChecklist(checklist);
  const setItem = (k: string, v: InspectionItemState) =>
    !readOnly && setChecklist((c) => ({ ...c, [k]: v }));

  // Mock photos (using placeholder service)
  const demoPhotos = [
    "https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=400",
    "https://images.unsplash.com/photo-1542362567-b07e54358753?w=400",
    "https://images.unsplash.com/photo-1494976388531-d1058494cdd8?w=400",
    "https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?w=400",
    "https://images.unsplash.com/photo-1605559424843-9e4c228bf1c2?w=400",
  ];

  return (
    <div className="min-h-screen flex flex-col bg-muted/20">
      <Navbar />
      <main className="flex-1 container mx-auto px-4 pt-24 pb-16 max-w-4xl">
        <Link to="/admin">
          <Button variant="ghost" size="sm" className="mb-4">
            <ArrowLeft className="h-4 w-4 mr-2" /> Volver
          </Button>
        </Link>

        <div className="rounded-lg border-2 border-dashed border-primary/40 bg-primary/5 p-4 mb-6 flex items-start gap-3">
          <Eye className="h-5 w-5 text-primary mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-primary">Vista previa hipotética</p>
            <p className="text-xs text-muted-foreground">
              Ejemplo de cómo el arrendatario completa la inspección al recibir un{" "}
              <strong>Toyota Corolla 2022</strong> · Reserva #DEMO12 ·
              Periodo: 15 May → 22 May 2026
            </p>
          </div>
          <Button size="sm" variant="outline" onClick={() => setReadOnly((v) => !v)}>
            {readOnly ? "Modo edición" : "Modo firmado"}
          </Button>
        </div>

        <div className="mb-6">
          <h1 className="text-2xl md:text-3xl font-bold">Recepción del vehículo</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Toyota Corolla 2022 · Reserva DEMO12345
          </p>
        </div>

        {readOnly && (
          <Card className="mb-6 border-emerald-500/30 bg-emerald-500/5">
            <CardContent className="p-4 flex items-center gap-3">
              <ClipboardCheck className="h-6 w-6 text-emerald-600" />
              <div>
                <p className="font-semibold text-emerald-700">Inspección firmada</p>
                <p className="text-xs text-muted-foreground">
                  Firmada por <strong>{signatureName}</strong> · 14 May 2026, 10:34 ·
                  Bloqueada para edición
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ClipboardCheck className="h-5 w-5 text-primary" /> Inspección al recibir el vehículo
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label>Kilometraje actual *</Label>
              <Input
                type="number"
                value={mileage}
                onChange={(e) => setMileage(e.target.value)}
                disabled={readOnly}
              />
            </div>
            <div>
              <Label>Nivel de combustible *</Label>
              <Select value={fuel} onValueChange={setFuel} disabled={readOnly}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {FUEL_LEVELS.map((f) => (
                    <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <div className="flex gap-2 text-xs flex-wrap">
                <Badge variant="outline" className={STATE_META.ok.cls}>OK: {summary.ok}</Badge>
                <Badge variant="outline" className={STATE_META.minor.cls}>Menor: {summary.minor}</Badge>
                <Badge variant="outline" className={STATE_META.damage.cls}>Daño: {summary.damage}</Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6 mt-6">
          {INSPECTION_SECTIONS.map((section) => (
            <Card key={section.key}>
              <CardHeader>
                <CardTitle className="text-base">{section.title}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {section.items.map((item) => {
                  const v = checklist[item.key] || "ok";
                  return (
                    <div
                      key={item.key}
                      className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 py-2 border-b border-border last:border-0"
                    >
                      <span className="text-sm">{item.label}</span>
                      <div className="flex gap-1 flex-wrap">
                        {STATES.map((s) => (
                          <button
                            key={s}
                            type="button"
                            disabled={readOnly}
                            onClick={() => setItem(item.key, s)}
                            className={`px-2.5 py-1 text-xs rounded-md border transition ${
                              v === s
                                ? STATE_META[s].cls + " font-medium"
                                : "bg-background text-muted-foreground border-border hover:bg-muted"
                            } ${readOnly ? "cursor-not-allowed opacity-80" : ""}`}
                          >
                            {STATE_META[s].label}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          ))}

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Camera className="h-4 w-4" /> Fotos del vehículo
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                {demoPhotos.map((url, i) => (
                  <div key={i} className="aspect-square rounded-md overflow-hidden border">
                    <img src={url} alt={`Demo ${i + 1}`} className="w-full h-full object-cover" />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Observaciones</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label>Comentarios generales</Label>
                <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} disabled={readOnly} />
              </div>
              <div>
                <Label className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-yellow-600" /> Daños detectados
                </Label>
                <Textarea
                  value={damageNotes}
                  onChange={(e) => setDamageNotes(e.target.value)}
                  rows={3}
                  disabled={readOnly}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Consentimiento y firma</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="rounded-md bg-muted/50 p-3 text-xs text-muted-foreground space-y-2">
                <p>
                  Declaro que he inspeccionado el vehículo y que las condiciones registradas
                  en este documento son verdaderas. Acepto las políticas, deberes y derechos
                  del contrato de arrendamiento de RuedaVe.
                </p>
                <p>
                  Como arrendatario, doy fe de que recibo el vehículo en las condiciones aquí
                  descritas y me comprometo a devolverlo en el mismo estado salvo el desgaste
                  normal de uso.
                </p>
              </div>
              <div>
                <Label>Nombre completo (firma) *</Label>
                <Input
                  value={signatureName}
                  onChange={(e) => setSignatureName(e.target.value)}
                  disabled={readOnly}
                />
              </div>
              <div className="flex items-start gap-2">
                <Checkbox checked={accepted} onCheckedChange={(v) => !readOnly && setAccepted(!!v)} disabled={readOnly} />
                <Label className="text-sm font-normal">
                  Acepto las condiciones y confirmo el estado del vehículo descrito arriba.
                </Label>
              </div>
              <Button className="w-full" size="lg" disabled={readOnly}>
                {readOnly ? "Inspección ya firmada" : "Firmar y registrar inspección"}
              </Button>
            </CardContent>
          </Card>
        </div>
      </main>
      <Footer />
    </div>
  );
}
