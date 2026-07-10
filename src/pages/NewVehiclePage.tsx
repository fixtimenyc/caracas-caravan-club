import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Loader2, Plus, Trash2, Upload, X } from "lucide-react";
import { toast } from "sonner";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CARACAS_ZONES } from "@/lib/locations";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { resolveVehiclePhotos } from "@/lib/vehiclePhoto";

const FEATURES = [
  "Bluetooth",
  "USB",
  "GPS",
  "Cámara reversa",
  "Sillón de bebé",
  "Aire acondicionado",
];

const FUEL_TYPES = ["Gasolina", "Diésel", "Híbrido", "Eléctrico", "GNV"];
const TRANSMISSIONS = ["Automática", "Manual"];

type FormState = {
  brand: string;
  model: string;
  year: number;
  color: string;
  plate: string;
  vin: string;
  fuelType: string;
  transmission: string;
  seats: number;
  pricePerDay: number;
  zone: string;
  addressDetail: string;
  description: string;
  features: string[];
  customFeatures: string[];
  photos: string[]; // storage paths
  noSmoking: boolean;
  smokingFine: number;
  noPets: boolean;
  returnSameFuel: boolean;
  noOffRoad: boolean;
};

const currentYear = new Date().getFullYear();

const initialState: FormState = {
  brand: "",
  model: "",
  year: currentYear,
  color: "",
  plate: "",
  vin: "",
  fuelType: "",
  transmission: "",
  seats: 5,
  pricePerDay: 30,
  zone: "",
  addressDetail: "",
  description: "",
  features: [],
  customFeatures: [],
  photos: [],
  noSmoking: true,
  smokingFine: 50,
  noPets: true,
  returnSameFuel: true,
  noOffRoad: true,
};

const NewVehiclePage = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [checking, setChecking] = useState(true);
  const [approved, setApproved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [form, setForm] = useState<FormState>(initialState);
  const [newFeature, setNewFeature] = useState("");
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);

  const update = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  // Gate: require approved aliado
  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (authLoading) return;
      if (!user) {
        navigate("/auth?mode=signin");
        return;
      }
      const { data } = await supabase
        .from("owner_applications")
        .select("status")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (cancelled) return;
      setApproved(data?.status === "approved");
      setChecking(false);
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [user, authLoading, navigate]);

  // Resolve photo URLs for preview
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!form.photos.length) {
        setPhotoUrls([]);
        return;
      }
      const urls = await resolveVehiclePhotos(form.photos);
      if (!cancelled) setPhotoUrls(urls);
    })();
    return () => {
      cancelled = true;
    };
  }, [form.photos]);

  const toggleFeature = (f: string) =>
    setForm((s) => ({
      ...s,
      features: s.features.includes(f)
        ? s.features.filter((x) => x !== f)
        : [...s.features, f],
    }));

  const addCustomFeature = () => {
    const v = newFeature.trim();
    if (!v) return;
    if (form.customFeatures.includes(v)) {
      toast.error("Esa característica ya existe");
      return;
    }
    update("customFeatures", [...form.customFeatures, v]);
    setNewFeature("");
  };

  const addPhotos = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    e.target.value = "";
    if (!files.length || !user) return;
    if (form.photos.length + files.length > 10) {
      toast.error("Máximo 10 fotos");
      return;
    }
    const ALLOWED = new Set([
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/gif",
      "image/avif",
    ]);
    setUploading(true);
    try {
      const uploaded: string[] = [];
      for (const file of files) {
        if (file.type && !ALLOWED.has(file.type)) {
          toast.error(`Formato no soportado: ${file.name}`);
          continue;
        }
        const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
        const path = `${user.id}/new/${Date.now()}-${Math.random()
          .toString(36)
          .slice(2, 8)}.${ext}`;
        const { error } = await supabase.storage
          .from("vehicle-photos")
          .upload(path, file, { cacheControl: "3600", upsert: false });
        if (error) {
          toast.error(`Error subiendo ${file.name}`);
          continue;
        }
        uploaded.push(path);
      }
      if (uploaded.length) {
        update("photos", [...form.photos, ...uploaded]);
        toast.success(`${uploaded.length} foto(s) subida(s)`);
      }
    } finally {
      setUploading(false);
    }
  };

  const removePhoto = async (i: number) => {
    const target = form.photos[i];
    if (target && !target.startsWith("http")) {
      await supabase.storage.from("vehicle-photos").remove([target]);
    }
    update(
      "photos",
      form.photos.filter((_, idx) => idx !== i),
    );
  };

  const validate = (): string | null => {
    if (!form.brand.trim()) return "La marca es obligatoria";
    if (!form.model.trim()) return "El modelo es obligatorio";
    if (!form.year || form.year < 2010 || form.year > currentYear + 1)
      return `El año debe estar entre 2010 y ${currentYear + 1}`;
    if (!form.color.trim()) return "El color es obligatorio";
    if (!form.plate.trim()) return "La placa es obligatoria";
    if (!form.fuelType) return "Selecciona el tipo de combustible";
    if (!form.transmission) return "Selecciona la transmisión";
    if (!form.zone || !CARACAS_ZONES.includes(form.zone as any))
      return "Selecciona una zona válida de Caracas";
    if (form.description.trim().length < 20)
      return "La descripción debe tener al menos 20 caracteres";
    if (form.pricePerDay < 5) return "Precio mínimo $5/día";
    if (form.photos.length < 3) return "Sube al menos 3 fotos";
    return null;
  };

  const handleSubmit = async () => {
    const err = validate();
    if (err) {
      toast.error(err);
      return;
    }
    if (!user) return;
    setSaving(true);
    const location = form.addressDetail.trim()
      ? `${form.addressDetail.trim()}, ${form.zone}, Caracas`
      : `${form.zone}, Caracas`;
    const { data, error } = await supabase
      .from("vehicles")
      .insert({
        owner_id: user.id,
        brand: form.brand.trim(),
        model: form.model.trim(),
        year: form.year,
        color: form.color.trim(),
        plate: form.plate.trim().toUpperCase(),
        vin: form.vin.trim().toUpperCase() || null,
        fuel_type: form.fuelType,
        transmission: form.transmission,
        seats: form.seats,
        location,
        zone: form.zone,
        description: form.description.trim(),
        price_per_day: form.pricePerDay,
        photos: form.photos,
        features: form.features,
        custom_features: form.customFeatures,
        active: true,
        available: true,
        house_rules: {
          noSmoking: form.noSmoking,
          smokingFine: Number(form.smokingFine) || 0,
          noPets: form.noPets,
          returnSameFuel: form.returnSameFuel,
          noOffRoad: form.noOffRoad,
        } as any,
      })
      .select("id")
      .maybeSingle();
    setSaving(false);
    if (error || !data) {
      toast.error(error?.message || "No se pudo publicar el vehículo");
      return;
    }
    toast.success("¡Vehículo publicado con éxito!");
    navigate(`/my-vehicles/${data.id}/editar`);
  };

  if (authLoading || checking) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <main className="container mx-auto px-4 pt-24 pb-16 max-w-4xl space-y-4">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-40 w-full" />
        </main>
      </div>
    );
  }

  if (!approved) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <main className="container mx-auto px-4 pt-24 pb-16 max-w-2xl">
          <Card className="p-8 text-center">
            <h1 className="text-2xl font-bold mb-2">Cuenta no aprobada aún</h1>
            <p className="text-muted-foreground mb-6">
              Para publicar otro vehículo tu cuenta debe estar aprobada como
              Aliado.
            </p>
            <Button onClick={() => navigate("/aliado/solicitud")}>
              Ver estado de mi solicitud
            </Button>
          </Card>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container mx-auto px-4 pt-24 pb-32 max-w-4xl">
        <div className="flex items-center gap-3 mb-6">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/my-vehicles")}
            aria-label="Volver"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground">
              Publicar otro vehículo
            </h1>
            <p className="text-sm text-muted-foreground">
              Añade un vehículo adicional a tu flota. Se publicará al instante.
            </p>
          </div>
        </div>

        {/* Datos del vehículo */}
        <Card className="p-6 mb-6 space-y-4">
          <h2 className="text-lg font-bold">Datos del vehículo</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Marca *</Label>
              <Input
                value={form.brand}
                onChange={(e) => update("brand", e.target.value)}
                placeholder="Toyota"
              />
            </div>
            <div>
              <Label>Modelo *</Label>
              <Input
                value={form.model}
                onChange={(e) => update("model", e.target.value)}
                placeholder="Corolla"
              />
            </div>
            <div>
              <Label>Año *</Label>
              <Input
                type="number"
                min={2010}
                max={currentYear + 1}
                value={form.year}
                onChange={(e) => update("year", Number(e.target.value))}
              />
            </div>
            <div>
              <Label>Color *</Label>
              <Input
                value={form.color}
                onChange={(e) => update("color", e.target.value)}
                placeholder="Blanco"
              />
            </div>
            <div>
              <Label>Placa *</Label>
              <Input
                value={form.plate}
                onChange={(e) => update("plate", e.target.value.toUpperCase())}
                placeholder="AA123BB"
              />
            </div>
            <div>
              <Label>VIN (opcional)</Label>
              <Input
                value={form.vin}
                onChange={(e) => update("vin", e.target.value.toUpperCase())}
              />
            </div>
            <div>
              <Label>Combustible *</Label>
              <Select
                value={form.fuelType}
                onValueChange={(v) => update("fuelType", v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona" />
                </SelectTrigger>
                <SelectContent>
                  {FUEL_TYPES.map((f) => (
                    <SelectItem key={f} value={f}>
                      {f}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Transmisión *</Label>
              <Select
                value={form.transmission}
                onValueChange={(v) => update("transmission", v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona" />
                </SelectTrigger>
                <SelectContent>
                  {TRANSMISSIONS.map((f) => (
                    <SelectItem key={f} value={f}>
                      {f}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Puestos</Label>
              <Input
                type="number"
                min={2}
                max={20}
                value={form.seats}
                onChange={(e) => update("seats", Number(e.target.value))}
              />
            </div>
            <div>
              <Label>Precio por día (USD) *</Label>
              <Input
                type="number"
                min={5}
                value={form.pricePerDay}
                onChange={(e) =>
                  update("pricePerDay", Number(e.target.value))
                }
              />
            </div>
          </div>
        </Card>

        {/* Ubicación */}
        <Card className="p-6 mb-6 space-y-4">
          <h2 className="text-lg font-bold">Ubicación de entrega</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Zona *</Label>
              <Select value={form.zone} onValueChange={(v) => update("zone", v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona una zona" />
                </SelectTrigger>
                <SelectContent>
                  {CARACAS_ZONES.map((z) => (
                    <SelectItem key={z} value={z}>
                      {z}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Referencia (opcional)</Label>
              <Input
                value={form.addressDetail}
                onChange={(e) => update("addressDetail", e.target.value)}
                placeholder="Av. Luis Roche, frente a la plaza"
              />
            </div>
          </div>
        </Card>

        {/* Descripción */}
        <Card className="p-6 mb-6 space-y-3">
          <h2 className="text-lg font-bold">Descripción *</h2>
          <Textarea
            rows={4}
            value={form.description}
            onChange={(e) => update("description", e.target.value)}
            placeholder="Describe brevemente tu vehículo: estado, cualidades, ideal para..."
          />
        </Card>

        {/* Fotos */}
        <Card className="p-6 mb-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold">Fotos * (mínimo 3)</h2>
            <label>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
                multiple
                className="hidden"
                onChange={addPhotos}
                disabled={uploading}
              />
              <Button asChild variant="outline" disabled={uploading}>
                <span className="cursor-pointer">
                  {uploading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Subiendo…
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4 mr-2" />
                      Subir fotos
                    </>
                  )}
                </span>
              </Button>
            </label>
          </div>
          {photoUrls.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {photoUrls.map((url, i) => (
                <div
                  key={i}
                  className="relative aspect-video rounded-lg overflow-hidden bg-muted"
                >
                  <img
                    src={url}
                    alt={`Foto ${i + 1}`}
                    className="w-full h-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => removePhoto(i)}
                    className="absolute top-1 right-1 p-1 rounded-md bg-background/90 hover:bg-destructive hover:text-destructive-foreground"
                    aria-label="Eliminar foto"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Aún no has subido fotos.
            </p>
          )}
        </Card>

        {/* Características */}
        <Card className="p-6 mb-6 space-y-4">
          <h2 className="text-lg font-bold">Características</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {FEATURES.map((f) => (
              <label
                key={f}
                className="flex items-center gap-2 text-sm cursor-pointer"
              >
                <Checkbox
                  checked={form.features.includes(f)}
                  onCheckedChange={() => toggleFeature(f)}
                />
                {f}
              </label>
            ))}
          </div>
          <div className="flex gap-2">
            <Input
              value={newFeature}
              onChange={(e) => setNewFeature(e.target.value)}
              placeholder="Otra característica"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addCustomFeature();
                }
              }}
            />
            <Button type="button" variant="outline" onClick={addCustomFeature}>
              <Plus className="w-4 h-4" />
            </Button>
          </div>
          {form.customFeatures.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {form.customFeatures.map((f) => (
                <span
                  key={f}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-muted text-sm"
                >
                  {f}
                  <button
                    type="button"
                    onClick={() =>
                      update(
                        "customFeatures",
                        form.customFeatures.filter((x) => x !== f),
                      )
                    }
                    aria-label={`Quitar ${f}`}
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
        </Card>

        {/* Reglas de la casa */}
        <Card className="p-6 mb-6 space-y-3">
          <h2 className="text-lg font-bold">Reglas de la casa</h2>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={form.noSmoking}
              onCheckedChange={(v) => update("noSmoking", Boolean(v))}
            />
            No fumar dentro del vehículo
          </label>
          {form.noSmoking && (
            <div className="ml-6">
              <Label className="text-xs">Multa por fumar (USD)</Label>
              <Input
                type="number"
                min={0}
                value={form.smokingFine}
                onChange={(e) =>
                  update("smokingFine", Number(e.target.value))
                }
                className="w-32"
              />
            </div>
          )}
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={form.noPets}
              onCheckedChange={(v) => update("noPets", Boolean(v))}
            />
            No mascotas
          </label>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={form.returnSameFuel}
              onCheckedChange={(v) => update("returnSameFuel", Boolean(v))}
            />
            Devolver con el mismo nivel de combustible
          </label>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={form.noOffRoad}
              onCheckedChange={(v) => update("noOffRoad", Boolean(v))}
            />
            No off-road / caminos no pavimentados
          </label>
        </Card>

        <div className="flex flex-col md:flex-row gap-3 justify-end">
          <Button
            variant="outline"
            onClick={() => navigate("/my-vehicles")}
            disabled={saving}
          >
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Publicando…
              </>
            ) : (
              "Publicar vehículo"
            )}
          </Button>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default NewVehiclePage;
