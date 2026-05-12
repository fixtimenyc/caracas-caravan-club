import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  ArrowLeft,
  Save,
  X,
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  AlertTriangle,
  Image as ImageIcon,
  EyeOff,
} from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Calendar } from "@/components/ui/calendar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CARACAS_ZONES, matchZone } from "@/lib/locations";
import { toast } from "sonner";

const FEATURES = [
  "Bluetooth",
  "USB",
  "GPS",
  "Cámara reversa",
  "Sillón de bebé",
  "Aire acondicionado",
];

const COMMISSION = 0.35;

type FormState = {
  title: string;
  description: string;
  pricePerDay: number;
  zone: string;
  addressDetail: string;
  brand: string;
  model: string;
  year: number;
  features: string[];
  customFeatures: string[];
  photos: string[];
  blockedDates: Date[];
  minRentalDays: number;
  minAdvanceHours: number;
  homeDelivery: boolean;
  homeDeliveryFee: number;
  active: boolean;
};

const SAMPLE: FormState = {
  title: "Toyota Terios 2016 — SUV ágil para Caracas",
  description:
    "SUV cómoda y económica, ideal para moverse por Caracas. Excelente rendimiento de combustible, mantenimiento al día y aire acondicionado en perfecto estado.",
  pricePerDay: 50,
  zone: "Altamira",
  addressDetail: "Av. Luis Roche, frente a la plaza",
  brand: "Toyota",
  model: "Terios",
  year: 2016,
  features: ["Bluetooth", "USB", "Aire acondicionado"],
  customFeatures: ["Vidrios polarizados"],
  photos: ["/placeholder.svg", "/placeholder.svg"],
  blockedDates: [],
  minRentalDays: 1,
  minAdvanceHours: 12,
  homeDelivery: true,
  homeDeliveryFee: 15,
  active: true,
};

const EditVehiclePage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<FormState>(SAMPLE);
  const [newCustomFeature, setNewCustomFeature] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 700);
    return () => clearTimeout(t);
  }, [id]);

  const update = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const netEarnings = useMemo(
    () => Math.max(0, form.pricePerDay) * (1 - COMMISSION),
    [form.pricePerDay]
  );

  const toggleFeature = (f: string) => {
    setForm((s) => ({
      ...s,
      features: s.features.includes(f)
        ? s.features.filter((x) => x !== f)
        : [...s.features, f],
    }));
  };

  const addCustomFeature = () => {
    const v = newCustomFeature.trim();
    if (!v) return;
    if (form.customFeatures.includes(v)) {
      toast.error("Esa característica ya existe");
      return;
    }
    update("customFeatures", [...form.customFeatures, v]);
    setNewCustomFeature("");
  };

  const removeCustomFeature = (v: string) =>
    update(
      "customFeatures",
      form.customFeatures.filter((x) => x !== v)
    );

  const addPhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (form.photos.length + files.length > 10) {
      toast.error("Máximo 10 fotos");
      return;
    }
    const urls = files.map((f) => URL.createObjectURL(f));
    update("photos", [...form.photos, ...urls]);
    e.target.value = "";
  };

  const removePhoto = (i: number) => {
    if (form.photos.length <= 1) {
      toast.error("Debe haber al menos 1 foto");
      return;
    }
    update(
      "photos",
      form.photos.filter((_, idx) => idx !== i)
    );
  };

  const movePhoto = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= form.photos.length) return;
    const next = [...form.photos];
    [next[i], next[j]] = [next[j], next[i]];
    update("photos", next);
  };

  const currentYear = new Date().getFullYear();

  const validate = (): string | null => {
    if (!form.title.trim()) return "El título es obligatorio";
    if (form.title.trim().length < 10)
      return "El título debe tener al menos 10 caracteres";
    if (!form.brand.trim()) return "La marca es obligatoria";
    if (!form.model.trim()) return "El modelo es obligatorio";
    if (!form.year || form.year < 1980 || form.year > currentYear + 1)
      return `El año debe estar entre 1980 y ${currentYear + 1}`;
    if (!form.location.trim()) return "La ubicación es obligatoria";
    if (form.description.trim().length < 20)
      return "La descripción debe tener al menos 20 caracteres";
    if (form.photos.length < 1) return "Debe haber al menos 1 foto";
    if (form.pricePerDay <= 0) return "El precio debe ser mayor a 0";
    if (!Number.isFinite(form.minRentalDays) || form.minRentalDays < 1)
      return "La duración mínima de alquiler debe ser de al menos 1 día";
    if (form.minRentalDays > 30)
      return "La duración mínima de alquiler no puede superar 30 días";
    if (!Number.isFinite(form.minAdvanceHours) || form.minAdvanceHours < 0)
      return "El anticipo mínimo en horas no puede ser negativo";
    if (form.minAdvanceHours > 168)
      return "El anticipo mínimo no puede superar 168 horas (7 días)";
    if (form.homeDelivery) {
      if (!Number.isFinite(form.homeDeliveryFee) || form.homeDeliveryFee < 0)
        return "El costo de entrega a domicilio no puede ser negativo";
      if (form.homeDeliveryFee > 500)
        return "El costo de entrega a domicilio parece demasiado alto";
    }
    return null;
  };

  const handleSave = () => {
    const err = validate();
    if (err) {
      toast.error(err);
      return;
    }
    setSaving(true);
    setTimeout(() => {
      setSaving(false);
      toast.success("Cambios guardados con éxito");
    }, 900);
  };

  const handleCancel = () => navigate("/my-vehicles");

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <main className="container mx-auto px-4 pt-24 pb-32 space-y-4 max-w-4xl">
          <Skeleton className="h-10 w-72" />
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-40 w-full" />
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container mx-auto px-4 pt-24 pb-32 md:pb-12 max-w-4xl">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Button
            variant="ghost"
            size="icon"
            onClick={handleCancel}
            aria-label="Volver"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl md:text-3xl font-bold text-foreground">
              Editar vehículo
            </h1>
            <p className="text-sm text-muted-foreground">
              {form.brand} {form.model} {form.year}
            </p>
          </div>
          {!form.active && (
            <Badge variant="secondary" className="gap-1">
              <EyeOff className="w-3 h-3" /> Oculto
            </Badge>
          )}
        </div>

        {!form.active && (
          <Card className="p-4 mb-6 border-accent/50 bg-accent/10 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-accent shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-semibold text-foreground">
                Tu vehículo está oculto
              </p>
              <p className="text-muted-foreground">
                No será visible en los resultados de búsqueda hasta que vuelvas
                a activarlo.
              </p>
            </div>
          </Card>
        )}

        <Accordion
          type="multiple"
          defaultValue={["basics"]}
          className="space-y-4"
        >
          {/* SECTION 1: Información básica y fotos */}
          <Card className="px-4">
            <AccordionItem value="basics" className="border-0">
              <AccordionTrigger className="text-lg font-semibold">
                1. Información básica y fotos
              </AccordionTrigger>
              <AccordionContent className="space-y-5 pt-2">
                <div className="space-y-2">
                  <Label htmlFor="title">Título del anuncio</Label>
                  <Input
                    id="title"
                    value={form.title}
                    onChange={(e) => update("title", e.target.value)}
                    maxLength={100}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Marca</Label>
                    <Input
                      value={form.brand}
                      onChange={(e) => update("brand", e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Modelo</Label>
                    <Input
                      value={form.model}
                      onChange={(e) => update("model", e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Año</Label>
                    <Input
                      type="number"
                      value={form.year}
                      onChange={(e) =>
                        update("year", Number(e.target.value) || 0)
                      }
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="location">Ubicación</Label>
                  <Input
                    id="location"
                    value={form.location}
                    onChange={(e) => update("location", e.target.value)}
                    placeholder="Ej: Altamira, Caracas"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Descripción larga</Label>
                  <Textarea
                    id="description"
                    rows={5}
                    value={form.description}
                    onChange={(e) => update("description", e.target.value)}
                    placeholder="Describe tu vehículo (mínimo 20 caracteres)"
                  />
                  <p
                    className={`text-xs ${
                      form.description.length < 20
                        ? "text-destructive"
                        : "text-muted-foreground"
                    }`}
                  >
                    {form.description.length} / 20 caracteres mínimos
                  </p>
                </div>

                <div className="space-y-3">
                  <Label>Características</Label>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {FEATURES.map((f) => (
                      <label
                        key={f}
                        className="flex items-center gap-2 p-2 rounded-md border border-border hover:bg-muted/40 cursor-pointer"
                      >
                        <Checkbox
                          checked={form.features.includes(f)}
                          onCheckedChange={() => toggleFeature(f)}
                        />
                        <span className="text-sm">{f}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="space-y-3">
                  <Label>Características personalizadas</Label>
                  <div className="flex flex-wrap gap-2">
                    {form.customFeatures.map((f) => (
                      <Badge
                        key={f}
                        variant="secondary"
                        className="gap-1 py-1.5 pl-3 pr-1"
                      >
                        {f}
                        <button
                          type="button"
                          onClick={() => removeCustomFeature(f)}
                          className="ml-1 rounded hover:bg-background/40 p-0.5"
                          aria-label={`Eliminar ${f}`}
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <Input
                      value={newCustomFeature}
                      onChange={(e) => setNewCustomFeature(e.target.value)}
                      placeholder="Ej: Vidrios polarizados"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          addCustomFeature();
                        }
                      }}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={addCustomFeature}
                    >
                      <Plus className="w-4 h-4 mr-1" /> Añadir
                    </Button>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label>Fotos ({form.photos.length}/10)</Label>
                    <label className="cursor-pointer">
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        className="hidden"
                        onChange={addPhoto}
                      />
                      <span className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium rounded-md border border-input hover:bg-accent/10">
                        <Plus className="w-4 h-4" /> Subir fotos
                      </span>
                    </label>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {form.photos.map((src, i) => (
                      <div
                        key={`${src}-${i}`}
                        className="relative group rounded-lg overflow-hidden border border-border bg-muted aspect-video"
                      >
                        <img
                          src={src}
                          alt={`Foto ${i + 1}`}
                          className="w-full h-full object-cover"
                        />
                        {i === 0 && (
                          <Badge className="absolute top-2 left-2 bg-primary text-primary-foreground">
                            Portada
                          </Badge>
                        )}
                        <div className="absolute inset-x-0 bottom-0 flex justify-between gap-1 p-1.5 bg-gradient-to-t from-black/70 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                          <div className="flex gap-1">
                            <button
                              type="button"
                              onClick={() => movePhoto(i, -1)}
                              disabled={i === 0}
                              className="p-1.5 rounded bg-background/90 hover:bg-background disabled:opacity-40"
                              aria-label="Mover izquierda"
                            >
                              <ArrowUp className="w-3.5 h-3.5 -rotate-90" />
                            </button>
                            <button
                              type="button"
                              onClick={() => movePhoto(i, 1)}
                              disabled={i === form.photos.length - 1}
                              className="p-1.5 rounded bg-background/90 hover:bg-background disabled:opacity-40"
                              aria-label="Mover derecha"
                            >
                              <ArrowDown className="w-3.5 h-3.5 -rotate-90" />
                            </button>
                          </div>
                          <button
                            type="button"
                            onClick={() => removePhoto(i)}
                            className="p-1.5 rounded bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            aria-label="Eliminar foto"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                    {form.photos.length === 0 && (
                      <div className="col-span-full flex flex-col items-center justify-center py-10 text-muted-foreground border-2 border-dashed border-border rounded-lg">
                        <ImageIcon className="w-8 h-8 mb-2" />
                        <p className="text-sm">Aún no has subido fotos</p>
                      </div>
                    )}
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>
          </Card>

          {/* SECTION 2: Precios y disponibilidad */}
          <Card className="px-4">
            <AccordionItem value="pricing" className="border-0">
              <AccordionTrigger className="text-lg font-semibold">
                2. Precios y disponibilidad
              </AccordionTrigger>
              <AccordionContent className="space-y-5 pt-2">
                <div className="space-y-2">
                  <Label htmlFor="price">Precio por día (USD)</Label>
                  <Input
                    id="price"
                    type="number"
                    min={1}
                    step="0.01"
                    value={form.pricePerDay}
                    onChange={(e) =>
                      update("pricePerDay", Number(e.target.value) || 0)
                    }
                  />
                  <p
                    className={`text-sm ${
                      form.pricePerDay <= 0
                        ? "text-destructive"
                        : "text-primary font-medium"
                    }`}
                  >
                    {form.pricePerDay <= 0
                      ? "El precio debe ser mayor a 0"
                      : `Recibirás $${netEarnings.toFixed(2)} después de comisión del 35%`}
                  </p>
                </div>

                <div className="space-y-3">
                  <Label>Bloquear fechas no disponibles</Label>
                  <div className="rounded-lg border border-border p-3 inline-block bg-card">
                    <Calendar
                      mode="multiple"
                      selected={form.blockedDates}
                      onSelect={(d) => update("blockedDates", d || [])}
                      locale={es}
                      className="pointer-events-auto"
                    />
                  </div>
                  {form.blockedDates.length > 0 && (
                    <p className="text-xs text-muted-foreground">
                      {form.blockedDates.length} día(s) bloqueado(s):{" "}
                      {form.blockedDates
                        .slice(0, 3)
                        .map((d) => format(d, "d MMM", { locale: es }))
                        .join(", ")}
                      {form.blockedDates.length > 3 && "…"}
                    </p>
                  )}
                </div>
              </AccordionContent>
            </AccordionItem>
          </Card>

          {/* SECTION 3: Reglas y preferencias */}
          <Card className="px-4">
            <AccordionItem value="rules" className="border-0">
              <AccordionTrigger className="text-lg font-semibold">
                3. Reglas y preferencias
              </AccordionTrigger>
              <AccordionContent className="space-y-5 pt-2">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="minRentalDays">
                      Duración mínima de alquiler (días)
                    </Label>
                    <Input
                      id="minRentalDays"
                      type="number"
                      min={1}
                      max={30}
                      value={form.minRentalDays}
                      onChange={(e) =>
                        update(
                          "minRentalDays",
                          Math.max(1, Number(e.target.value) || 1)
                        )
                      }
                    />
                    <p
                      className={`text-xs ${
                        form.minRentalDays < 1 || form.minRentalDays > 30
                          ? "text-destructive"
                          : "text-muted-foreground"
                      }`}
                    >
                      Entre 1 y 30 días
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="minAdvanceHours">
                      Anticipo mínimo requerido (horas)
                    </Label>
                    <Input
                      id="minAdvanceHours"
                      type="number"
                      min={0}
                      max={168}
                      value={form.minAdvanceHours}
                      onChange={(e) =>
                        update(
                          "minAdvanceHours",
                          Math.max(0, Number(e.target.value) || 0)
                        )
                      }
                    />
                    <p
                      className={`text-xs ${
                        form.minAdvanceHours < 0 || form.minAdvanceHours > 168
                          ? "text-destructive"
                          : "text-muted-foreground"
                      }`}
                    >
                      Entre 0 y 168 horas (máx. 7 días)
                    </p>
                  </div>
                </div>

                <div className="space-y-3 p-4 rounded-lg bg-muted/40">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-base">Entrega a domicilio</Label>
                      <p className="text-xs text-muted-foreground">
                        Llevas el vehículo a la ubicación del huésped
                      </p>
                    </div>
                    <Switch
                      checked={form.homeDelivery}
                      onCheckedChange={(v) => update("homeDelivery", v)}
                    />
                  </div>
                  {form.homeDelivery && (
                    <div className="space-y-2">
                      <Label htmlFor="homeDeliveryFee">
                        Costo adicional (USD)
                      </Label>
                      <Input
                        id="homeDeliveryFee"
                        type="number"
                        min={0}
                        max={500}
                        step="0.01"
                        value={form.homeDeliveryFee}
                        onChange={(e) =>
                          update(
                            "homeDeliveryFee",
                            Math.max(0, Number(e.target.value) || 0)
                          )
                        }
                      />
                      <p
                        className={`text-xs ${
                          form.homeDeliveryFee < 0 || form.homeDeliveryFee > 500
                            ? "text-destructive"
                            : "text-muted-foreground"
                        }`}
                      >
                        {form.homeDeliveryFee === 0
                          ? "Entrega gratuita"
                          : `Se cobrará $${form.homeDeliveryFee.toFixed(2)} adicionales por entrega`}
                      </p>
                    </div>
                  )}
                </div>
              </AccordionContent>
            </AccordionItem>
          </Card>

          {/* SECTION 4: Estado del vehículo */}
          <Card className="px-4">
            <AccordionItem value="status" className="border-0">
              <AccordionTrigger className="text-lg font-semibold">
                4. Estado del vehículo
              </AccordionTrigger>
              <AccordionContent className="space-y-4 pt-2">
                <div className="flex items-center justify-between p-4 rounded-lg bg-muted/40">
                  <div>
                    <Label className="text-base">
                      {form.active ? "Activo" : "Oculto"}
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      {form.active
                        ? "Tu vehículo aparece en los resultados de búsqueda"
                        : "Tu vehículo no será visible para los huéspedes"}
                    </p>
                  </div>
                  <Switch
                    checked={form.active}
                    onCheckedChange={(v) => update("active", v)}
                  />
                </div>
              </AccordionContent>
            </AccordionItem>
          </Card>
        </Accordion>

        {/* Desktop actions */}
        <div className="hidden md:flex justify-end gap-3 mt-8">
          <Button variant="outline" onClick={handleCancel} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving} className="gap-2">
            <Save className="w-4 h-4" />
            {saving ? "Guardando..." : "Guardar cambios"}
          </Button>
        </div>
      </main>

      {/* Mobile sticky bar */}
      <div className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-background/95 backdrop-blur border-t border-border p-3 flex gap-2">
        <Button
          variant="outline"
          onClick={handleCancel}
          disabled={saving}
          className="flex-1"
        >
          Cancelar
        </Button>
        <Button
          onClick={handleSave}
          disabled={saving}
          className="flex-1 gap-2"
        >
          <Save className="w-4 h-4" />
          {saving ? "Guardando..." : "Guardar"}
        </Button>
      </div>

      <Footer />
    </div>
  );
};

export default EditVehiclePage;
