import { useEffect, useState } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { ClipboardCheck, AlertTriangle, ImageIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import {
  INSPECTION_SECTIONS,
  STATE_META,
  InspectionItemState,
} from "@/lib/inspectionChecklist";

interface Props {
  reservationId: string;
}

export default function ReservationInspectionsPanel({ reservationId }: Props) {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<any[]>([]);
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({});

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("vehicle_inspections")
        .select("*")
        .eq("reservation_id", reservationId)
        .order("type");
      const list = data || [];
      setItems(list);

      const allPaths = list.flatMap((i: any) => i.photos || []);
      if (allPaths.length) {
        const { data: signed } = await supabase.storage
          .from("inspection-photos")
          .createSignedUrls(allPaths, 60 * 60);
        const map: Record<string, string> = {};
        signed?.forEach((s, i) => {
          if (s.signedUrl) map[allPaths[i]] = s.signedUrl;
        });
        setPhotoUrls(map);
      }
      setLoading(false);
    })();
  }, [reservationId]);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ClipboardCheck className="h-4 w-4" /> Inspecciones del vehículo
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Cargando...</p>
        </CardContent>
      </Card>
    );
  }

  const renderInspection = (insp: any) => {
    const checklist = (insp.checklist || {}) as Record<string, InspectionItemState>;
    const damaged = INSPECTION_SECTIONS.flatMap((s) =>
      s.items
        .filter((i) => checklist[i.key] === "damage" || checklist[i.key] === "minor")
        .map((i) => ({ ...i, state: checklist[i.key], section: s.title }))
    );
    return (
      <div className="space-y-3 border rounded-lg p-4">
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <div>
            <p className="font-semibold">
              {insp.type === "pickup" ? "Entrega (arrendatario)" : "Devolución (propietario)"}
            </p>
            <p className="text-xs text-muted-foreground">
              Firmada por <strong>{insp.signature_name}</strong> ·{" "}
              {insp.signed_at
                ? format(new Date(insp.signed_at), "dd MMM yyyy HH:mm", { locale: es })
                : "—"}
            </p>
          </div>
          <Badge variant="outline" className="bg-emerald-500/10 text-emerald-700 border-emerald-500/30">
            Firmado
          </Badge>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
          <div>
            <p className="text-xs text-muted-foreground">Kilometraje</p>
            <p className="font-medium">{insp.mileage?.toLocaleString() ?? "—"} km</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Combustible</p>
            <p className="font-medium">{insp.fuel_level ?? "—"}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Daños/menores</p>
            <p className="font-medium">{damaged.length}</p>
          </div>
        </div>

        {insp.notes && (
          <div className="text-sm">
            <p className="text-xs text-muted-foreground">Observaciones</p>
            <p>{insp.notes}</p>
          </div>
        )}
        {insp.damage_notes && (
          <div className="text-sm bg-red-500/10 border border-red-500/30 rounded p-2">
            <p className="text-xs font-semibold text-red-700 flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" /> Daños registrados
            </p>
            <p className="text-red-700">{insp.damage_notes}</p>
          </div>
        )}

        {damaged.length > 0 && (
          <div>
            <p className="text-xs font-semibold mb-1">Items con observación</p>
            <div className="flex flex-wrap gap-1">
              {damaged.map((d) => (
                <Badge
                  key={d.key}
                  variant="outline"
                  className={STATE_META[d.state].cls + " text-xs"}
                >
                  {d.label}: {STATE_META[d.state].label}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {insp.photos?.length > 0 && (
          <div>
            <p className="text-xs font-semibold mb-2 flex items-center gap-1">
              <ImageIcon className="h-3 w-3" /> Fotos ({insp.photos.length})
            </p>
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
              {insp.photos.map((p: string) => (
                <a
                  key={p}
                  href={photoUrls[p]}
                  target="_blank"
                  rel="noreferrer"
                  className="aspect-square rounded border overflow-hidden block"
                >
                  {photoUrls[p] && (
                    <img src={photoUrls[p]} alt="" className="w-full h-full object-cover hover:scale-105 transition" />
                  )}
                </a>
              ))}
            </div>
          </div>
        )}

        <p className="text-[10px] text-muted-foreground">
          Consentimiento aceptado · UA: {insp.user_agent?.slice(0, 60) || "—"}
        </p>
      </div>
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <ClipboardCheck className="h-4 w-4" /> Inspecciones del vehículo
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            Aún no se han registrado inspecciones para esta reserva.
          </p>
        ) : (
          items.map((i) => <div key={i.id}>{renderInspection(i)}</div>)
        )}
      </CardContent>
    </Card>
  );
}
