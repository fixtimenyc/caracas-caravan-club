import { useEffect, useState } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Download, Database, ShieldAlert, Activity, TrendingUp } from "lucide-react";

interface Kpis {
  consent_counts: Record<string, number>;
  events_24h: number;
  trips_with_score: number;
  high_risk_fraud: number;
  total_users: number;
}

function csvEscape(v: any) {
  let s = v === null || v === undefined ? "" : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  if (/[",\n]/.test(s)) s = '"' + s.replace(/"/g, '""') + '"';
  return s;
}

function downloadCSV(filename: string, rows: any[]) {
  if (!rows.length) {
    toast.info("Sin datos para exportar");
    return;
  }
  const headers = Object.keys(rows[0]);
  const csv = [headers.join(","), ...rows.map((r) => headers.map((h) => csvEscape(r[h])).join(","))].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function AdminDataPage() {
  const [kpis, setKpis] = useState<Kpis>({
    consent_counts: {},
    events_24h: 0,
    trips_with_score: 0,
    high_risk_fraud: 0,
    total_users: 0,
  });
  const [trips, setTrips] = useState<any[]>([]);
  const [demand, setDemand] = useState<any[]>([]);
  const [fraud, setFraud] = useState<any[]>([]);
  const [datasets, setDatasets] = useState<any[]>([]);

  const load = async () => {
    const since = new Date(Date.now() - 24 * 3600_000).toISOString();
    const [{ data: consents }, { count: events24 }, { data: tripRows }, { data: demandRows }, { data: fraudRows }, { data: dsRows }, { count: usersTotal }] =
      await Promise.all([
        supabase.from("user_data_consents").select("consent_type,granted"),
        supabase.from("telemetry_events").select("id", { count: "exact", head: true }).gte("recorded_at", since),
        supabase.from("trip_summaries").select("*").order("created_at", { ascending: false }).limit(100),
        supabase.from("demand_signals").select("*").order("hour_bucket", { ascending: false }).limit(50),
        supabase.from("fraud_signals").select("*").order("created_at", { ascending: false }).limit(100),
        supabase.from("ai_training_datasets").select("*").order("created_at", { ascending: false }).limit(50),
        supabase.from("profiles").select("user_id", { count: "exact", head: true }),
      ]);

    const counts: Record<string, number> = {};
    (consents ?? []).forEach((c: any) => {
      if (c.granted) counts[c.consent_type] = (counts[c.consent_type] ?? 0) + 1;
    });

    setKpis({
      consent_counts: counts,
      events_24h: events24 ?? 0,
      trips_with_score: tripRows?.length ?? 0,
      high_risk_fraud: (fraudRows ?? []).filter((f: any) => f.risk_score >= 50).length,
      total_users: usersTotal ?? 0,
    });
    setTrips(tripRows ?? []);
    setDemand(demandRows ?? []);
    setFraud(fraudRows ?? []);
    setDatasets(dsRows ?? []);
  };

  useEffect(() => {
    void load();
  }, []);

  const generateDataset = async () => {
    if (!trips.length) {
      toast.info("No hay viajes para anonimizar");
      return;
    }
    const anon = trips.map((t) => ({
      distance_km: t.distance_km,
      avg_speed_kmh: t.avg_speed_kmh,
      max_speed_kmh: t.max_speed_kmh,
      harsh_brake_count: t.harsh_brake_count,
      harsh_accel_count: t.harsh_accel_count,
      speeding_count: t.speeding_count,
      night_minutes: t.night_minutes,
      phone_use_count: t.phone_use_count,
      risk_score: t.risk_score,
    }));
    const json = JSON.stringify(anon);
    const buf = new TextEncoder().encode(json);
    const hashBuf = await crypto.subtle.digest("SHA-256", buf);
    const hash = Array.from(new Uint8Array(hashBuf)).map((b) => b.toString(16).padStart(2, "0")).join("");
    const user = (await supabase.auth.getUser()).data.user;
    const { error } = await supabase.from("ai_training_datasets").insert({
      name: `viajes_${new Date().toISOString().slice(0, 10)}`,
      description: `Dataset anonimizado de ${anon.length} viajes`,
      row_count: anon.length,
      source_tables: ["trip_summaries"],
      content_hash: hash,
      created_by: user?.id ?? null,
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    downloadCSV(`viajes_anonimizados_${Date.now()}.csv`, anon);
    toast.success("Dataset generado y registrado");
    await load();
  };

  const consentPct = (key: string) =>
    kpis.total_users > 0 ? Math.round(((kpis.consent_counts[key] ?? 0) / kpis.total_users) * 100) : 0;

  return (
    <AdminLayout title="Datos y Monetización">
      <div className="grid gap-4 md:grid-cols-4 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Consentimientos telemetría</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{consentPct("telemetry")}%</div>
            <p className="text-xs text-muted-foreground">{kpis.consent_counts.telemetry ?? 0} usuarios</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Consentimientos IA</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{consentPct("ai_training")}%</div>
            <p className="text-xs text-muted-foreground">{kpis.consent_counts.ai_training ?? 0} usuarios</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Eventos 24h</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{kpis.events_24h.toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Alertas fraude alto</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{kpis.high_risk_fraud}</div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="telemetry" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="telemetry"><Activity className="h-4 w-4 mr-2" />Telemetría</TabsTrigger>
          <TabsTrigger value="demand"><TrendingUp className="h-4 w-4 mr-2" />Demanda</TabsTrigger>
          <TabsTrigger value="fraud"><ShieldAlert className="h-4 w-4 mr-2" />Fraude</TabsTrigger>
          <TabsTrigger value="ai"><Database className="h-4 w-4 mr-2" />Datasets IA</TabsTrigger>
        </TabsList>

        <TabsContent value="telemetry">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Resúmenes de viaje</CardTitle>
              <Button size="sm" variant="outline" onClick={() => downloadCSV("trip_summaries.csv", trips)}>
                <Download className="h-4 w-4 mr-2" /> CSV
              </Button>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b">
                    <tr className="text-left">
                      <th className="py-2 pr-3">Reserva</th>
                      <th className="py-2 pr-3">Distancia</th>
                      <th className="py-2 pr-3">Vel. media</th>
                      <th className="py-2 pr-3">Frenado</th>
                      <th className="py-2 pr-3">Exceso vel.</th>
                      <th className="py-2 pr-3">Teléfono</th>
                      <th className="py-2 pr-3">Score</th>
                    </tr>
                  </thead>
                  <tbody>
                    {trips.length === 0 ? (
                      <tr><td colSpan={7} className="py-6 text-center text-muted-foreground">Sin datos aún</td></tr>
                    ) : trips.map((t) => (
                      <tr key={t.id} className="border-b">
                        <td className="py-2 pr-3 font-mono text-xs">{t.reservation_id.slice(0, 8)}</td>
                        <td className="py-2 pr-3">{t.distance_km} km</td>
                        <td className="py-2 pr-3">{t.avg_speed_kmh}</td>
                        <td className="py-2 pr-3">{t.harsh_brake_count}</td>
                        <td className="py-2 pr-3">{t.speeding_count}</td>
                        <td className="py-2 pr-3">{t.phone_use_count}</td>
                        <td className="py-2 pr-3">
                          <Badge variant={t.risk_score >= 60 ? "destructive" : t.risk_score >= 30 ? "secondary" : "default"}>
                            {t.risk_score}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="demand">
          <Card>
            <CardHeader>
              <CardTitle>Señales de demanda por zona y hora</CardTitle>
            </CardHeader>
            <CardContent>
              {demand.length === 0 ? (
                <p className="py-6 text-center text-muted-foreground">Las señales se acumulan con el uso de la plataforma.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead className="border-b">
                    <tr className="text-left">
                      <th className="py-2 pr-3">Zona</th>
                      <th className="py-2 pr-3">Hora</th>
                      <th className="py-2 pr-3">Búsquedas</th>
                      <th className="py-2 pr-3">Reservas</th>
                      <th className="py-2 pr-3">Ocupación</th>
                    </tr>
                  </thead>
                  <tbody>
                    {demand.map((d) => (
                      <tr key={d.id} className="border-b">
                        <td className="py-2 pr-3">{d.zone}</td>
                        <td className="py-2 pr-3">{new Date(d.hour_bucket).toLocaleString("es-VE")}</td>
                        <td className="py-2 pr-3">{d.searches}</td>
                        <td className="py-2 pr-3">{d.reservations_created}</td>
                        <td className="py-2 pr-3">{d.occupancy_rate != null ? `${Math.round(d.occupancy_rate * 100)}%` : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="fraud">
          <Card>
            <CardHeader>
              <CardTitle>Señales de fraude</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b">
                    <tr className="text-left">
                      <th className="py-2 pr-3">Usuario</th>
                      <th className="py-2 pr-3">Tipo</th>
                      <th className="py-2 pr-3">Score</th>
                      <th className="py-2 pr-3">Fecha</th>
                      <th className="py-2 pr-3">Estado</th>
                      <th className="py-2 pr-3"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {fraud.length === 0 ? (
                      <tr><td colSpan={6} className="py-6 text-center text-muted-foreground">Sin alertas activas</td></tr>
                    ) : fraud.map((f) => (
                      <tr key={f.id} className="border-b">
                        <td className="py-2 pr-3 font-mono text-xs">{f.user_id?.slice(0, 8) ?? "—"}</td>
                        <td className="py-2 pr-3">{f.signal_type}</td>
                        <td className="py-2 pr-3">
                          <Badge variant={f.risk_score >= 50 ? "destructive" : "secondary"}>{f.risk_score}</Badge>
                        </td>
                        <td className="py-2 pr-3">{new Date(f.created_at).toLocaleDateString("es-VE")}</td>
                        <td className="py-2 pr-3">{f.reviewed ? "Revisado" : "Pendiente"}</td>
                        <td className="py-2 pr-3">
                          {!f.reviewed && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={async () => {
                                const u = (await supabase.auth.getUser()).data.user;
                                await supabase
                                  .from("fraud_signals")
                                  .update({ reviewed: true, reviewed_at: new Date().toISOString(), reviewed_by: u?.id })
                                  .eq("id", f.id);
                                await load();
                              }}
                            >
                              Marcar revisado
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ai">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Datasets anonimizados para IA</CardTitle>
              <Button size="sm" onClick={generateDataset}>
                <Database className="h-4 w-4 mr-2" /> Generar dataset
              </Button>
            </CardHeader>
            <CardContent>
              {datasets.length === 0 ? (
                <p className="py-6 text-center text-muted-foreground">Aún no se han generado datasets.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead className="border-b">
                    <tr className="text-left">
                      <th className="py-2 pr-3">Nombre</th>
                      <th className="py-2 pr-3">Filas</th>
                      <th className="py-2 pr-3">Hash</th>
                      <th className="py-2 pr-3">Fecha</th>
                    </tr>
                  </thead>
                  <tbody>
                    {datasets.map((d) => (
                      <tr key={d.id} className="border-b">
                        <td className="py-2 pr-3">{d.name}</td>
                        <td className="py-2 pr-3">{d.row_count}</td>
                        <td className="py-2 pr-3 font-mono text-xs">{d.content_hash?.slice(0, 12)}…</td>
                        <td className="py-2 pr-3">{new Date(d.created_at).toLocaleString("es-VE")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </AdminLayout>
  );
}
