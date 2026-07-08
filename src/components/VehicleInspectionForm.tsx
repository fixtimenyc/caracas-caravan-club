import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, X, ClipboardCheck, AlertTriangle, Camera } from "lucide-react";
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
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import LiveCameraCapture from "@/components/LiveCameraCapture";
import {
  INSPECTION_SECTIONS,
  FUEL_LEVELS,
  STATE_META,
  buildEmptyChecklist,
  summarizeChecklist,
  InspectionItemState,
} from "@/lib/inspectionChecklist";


interface Props {
  reservationId: string;
  vehicleId: string;
  type: "pickup" | "return";
  inspectorRole: "renter" | "owner";
  inspectorId: string;
  redirectTo?: string;
}

const STATES: InspectionItemState[] = ["ok", "minor", "damage", "na"];

export default function VehicleInspectionForm({
  reservationId,
  vehicleId,
  type,
  inspectorRole,
  inspectorId,
  redirectTo,
}: Props) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [existing, setExisting] = useState<any>(null);
  const [checklist, setChecklist] = useState<Record<string, InspectionItemState>>(
    buildEmptyChecklist()
  );
  const [mileage, setMileage] = useState("");
  const [fuel, setFuel] = useState("1/2");
  const [notes, setNotes] = useState("");
  const [damageNotes, setDamageNotes] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({});
  const [signatureName, setSignatureName] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);


  const summary = useMemo(() => summarizeChecklist(checklist), [checklist]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("vehicle_inspections")
        .select("*")
        .eq("reservation_id", reservationId)
        .eq("type", type)
        .maybeSingle();
      if (data) setExisting(data);
      setLoading(false);
    })();
  }, [reservationId, type]);

  const setItem = (key: string, value: InspectionItemState) =>
    setChecklist((c) => ({ ...c, [key]: value }));

  const handleUpload = async (files: FileList | File[] | null) => {
    const selected = Array.from(files ?? []);
    if (selected.length === 0) return;

    setUploading(true);
    try {
      const uploaded: string[] = [];
      let lastError: string | null = null;
      for (const file of selected) {
        if (file.size > 8 * 1024 * 1024) {
          lastError = `${file.name} supera 8MB`;
          toast.error(lastError);
          continue;
        }
        const ext = file.name.split(".").pop() || "jpg";
        const path = `${reservationId}/${type}/${crypto.randomUUID()}.${ext}`;
        const { error } = await supabase.storage
          .from("inspection-photos")
          .upload(path, file, { upsert: false });
        if (error) {
          lastError = `Error: ${error.message}`;
          toast.error(lastError);
          continue;
        }
        uploaded.push(path);
      }
      if (uploaded.length) {
        const { data: signed } = await supabase.storage
          .from("inspection-photos")
          .createSignedUrls(uploaded, 60 * 60);
        const urlMap: Record<string, string> = {};
        signed?.forEach((s, i) => {
          if (s.signedUrl) urlMap[uploaded[i]] = s.signedUrl;
        });
        setPhotoUrls((prev) => ({ ...prev, ...urlMap }));
      }
      setPhotos((p) => [...p, ...uploaded]);
      if (!uploaded.length && lastError) throw new Error(lastError);
    } finally {
      setUploading(false);
    }
  };

  const removePhoto = async (path: string) => {
    await supabase.storage.from("inspection-photos").remove([path]);
    setPhotos((p) => p.filter((x) => x !== path));
  };

  const submit = async () => {
    if (!signatureName.trim()) return toast.error("Firma con tu nombre completo");
    if (!accepted) return toast.error("Debes aceptar las condiciones");
    if (!mileage) return toast.error("Indica el kilometraje");
    if (photos.length < 4)
      return toast.error("Sube al menos 4 fotos del vehículo (frontal, trasera, laterales)");

    setSubmitting(true);
    const { error } = await supabase.from("vehicle_inspections").insert({
      reservation_id: reservationId,
      vehicle_id: vehicleId,
      type,
      inspector_id: inspectorId,
      inspector_role: inspectorRole,
      mileage: Number(mileage),
      fuel_level: fuel,
      checklist,
      notes: notes.trim() || null,
      damage_notes: damageNotes.trim() || null,
      photos,
      accepted_terms: accepted,
      signature_name: signatureName.trim(),
      signed_at: new Date().toISOString(),
      user_agent: navigator.userAgent,
    });
    setSubmitting(false);
    if (error) return toast.error(error.message);

    // Sync mileage on the reservation
    await supabase
      .from("reservations")
      .update(
        type === "pickup"
          ? { start_mileage: Number(mileage) }
          : { end_mileage: Number(mileage) }
      )
      .eq("id", reservationId);

    // Log event
    await supabase.from("reservation_events").insert({
      reservation_id: reservationId,
      event_type: "note",
      actor_id: inspectorId,
      message:
        type === "pickup"
          ? `Inspección de entrega firmada por ${signatureName.trim()} (arrendatario)`
          : `Inspección de devolución firmada por ${signatureName.trim()} (propietario)`,
      metadata: { inspection_type: type, mileage: Number(mileage), fuel_level: fuel, summary },
    });

    // Notify the other party (RLS allows insert when reservation_id is set and recipient is the counterpart)
    const { data: resData } = await supabase
      .from("reservations")
      .select("renter_id, vehicle_id, vehicles(owner_id)")
      .eq("id", reservationId)
      .maybeSingle();
    const renterId = (resData as any)?.renter_id;
    const ownerId = (resData as any)?.vehicles?.owner_id;
    const recipient = type === "pickup" ? ownerId : renterId;
    if (recipient) {
      await supabase.from("notifications").insert({
        user_id: recipient,
        type: type === "pickup" ? "inspection_pickup" : "inspection_return",
        title:
          type === "pickup"
            ? "El arrendatario firmó la inspección de entrega"
            : "El propietario firmó la inspección de devolución",
        message: `${signatureName.trim()} confirmó el estado del vehículo (${Number(
          mileage
        ).toLocaleString()} km, combustible ${fuel}).`,
        action_url: `/admin/reservas/${reservationId}`,
        reservation_id: reservationId,
        vehicle_id: vehicleId,
      });
    }

    toast.success("Inspección registrada");
    if (redirectTo) navigate(redirectTo);
    else window.location.reload();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (existing) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ClipboardCheck className="h-5 w-5 text-emerald-600" />
            Inspección de {type === "pickup" ? "entrega" : "devolución"} ya registrada
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>
            Firmada por <strong>{existing.signature_name}</strong> el{" "}
            {existing.signed_at
              ? new Date(existing.signed_at).toLocaleString("es-VE")
              : "—"}
          </p>
          <p className="text-muted-foreground">
            Kilometraje: {existing.mileage?.toLocaleString() ?? "—"} km · Combustible:{" "}
            {existing.fuel_level ?? "—"}
          </p>
          {existing.notes && <p>Observaciones: {existing.notes}</p>}
          {existing.damage_notes && (
            <p className="text-red-600">Daños: {existing.damage_notes}</p>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ClipboardCheck className="h-5 w-5 text-primary" />
            {type === "pickup"
              ? "Inspección al recibir el vehículo"
              : "Inspección al recibir el vehículo de vuelta"}
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <Label>Kilometraje actual *</Label>
            <Input
              type="number"
              inputMode="numeric"
              value={mileage}
              onChange={(e) => setMileage(e.target.value)}
              placeholder="0"
            />
          </div>
          <div>
            <Label>Nivel de combustible *</Label>
            <Select value={fuel} onValueChange={setFuel}>
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
              <Badge variant="outline" className={STATE_META.ok.cls}>
                OK: {summary.ok}
              </Badge>
              <Badge variant="outline" className={STATE_META.minor.cls}>
                Menor: {summary.minor}
              </Badge>
              <Badge variant="outline" className={STATE_META.damage.cls}>
                Daño: {summary.damage}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

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
                        onClick={() => setItem(item.key, s)}
                        className={`px-2.5 py-1 text-xs rounded-md border transition ${
                          v === s
                            ? STATE_META[s].cls + " font-medium"
                            : "bg-background text-muted-foreground border-border hover:bg-muted"
                        }`}
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
            <Camera className="h-4 w-4" /> Fotos del vehículo (mínimo 4)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Recomendado: frontal, trasera, ambos laterales, kilometraje del tablero,
            interior y cualquier daño existente.
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {photos.map((p) => {
              const url = photoUrls[p];
              return (
                <div key={p} className="relative group aspect-square rounded-md overflow-hidden border border-border">
                  <img src={url} alt="Inspección" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => removePhoto(p)}
                    className="absolute top-1 right-1 bg-background/90 rounded-full p-1 opacity-0 group-hover:opacity-100 transition"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              );
            })}
            <button
              type="button"
              onClick={() => setCameraOpen(true)}
              className="aspect-square rounded-md border-2 border-dashed border-border flex flex-col items-center justify-center gap-1 cursor-pointer hover:bg-muted transition"
            >
              {uploading ? (
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              ) : (
                <>
                  <Camera className="h-5 w-5 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">Tomar foto</span>
                </>
              )}
            </button>
          </div>
          <LiveCameraCapture
            open={cameraOpen}
            onClose={() => setCameraOpen(false)}
            onCapture={(files) => handleUpload(files)}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Observaciones</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label>Comentarios generales</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Estado general, accesorios, etc."
            />
          </div>
          <div>
            <Label className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-yellow-600" />
              Daños detectados (si aplica)
            </Label>
            <Textarea
              value={damageNotes}
              onChange={(e) => setDamageNotes(e.target.value)}
              rows={3}
              placeholder="Describe rayones, abolladuras, fallas mecánicas, etc."
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
              del contrato de arrendamiento de RuedaVe. Esta inspección queda registrada
              de forma legal y digital con fecha, hora y dispositivo.
            </p>
            {type === "pickup" ? (
              <p>
                Como arrendatario, doy fe de que recibo el vehículo en las condiciones
                aquí descritas y me comprometo a devolverlo en el mismo estado salvo el
                desgaste normal de uso.
              </p>
            ) : (
              <p>
                Como propietario, doy fe del estado en el que recibo el vehículo de vuelta
                según lo aquí registrado.
              </p>
            )}
          </div>
          <div>
            <Label>Nombre completo (firma) *</Label>
            <Input
              value={signatureName}
              onChange={(e) => setSignatureName(e.target.value)}
              placeholder="Tu nombre completo"
            />
          </div>
          <div className="flex items-start gap-2">
            <Checkbox
              id="accept"
              checked={accepted}
              onCheckedChange={(v) => setAccepted(!!v)}
            />
            <Label htmlFor="accept" className="text-sm font-normal cursor-pointer">
              Acepto las condiciones y confirmo el estado del vehículo descrito arriba.
            </Label>
          </div>
          <Button onClick={submit} disabled={submitting} className="w-full" size="lg">
            {submitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Firmar y registrar inspección
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
