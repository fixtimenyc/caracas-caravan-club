import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Upload, DollarSign, Clock, AlertCircle, CheckCircle2, Loader2, ImageIcon, Copy, Smartphone, Building2, Mail, Banknote, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { format, formatDistanceToNow, differenceInMinutes } from "date-fns";
import { es } from "date-fns/locale";

type Props = {
  reservationId: string;
  totalPrice: number;
  paymentDeadline?: string | null;
};

const METHOD_LABELS: Record<string, string> = {
  pago_movil: "Pago Móvil",
  transferencia: "Transferencia bancaria",
  zelle: "Zelle (USD)",
  efectivo: "Efectivo",
};

export default function PaymentReceiptUpload({ reservationId, totalPrice, paymentDeadline }: Props) {
  const [loading, setLoading] = useState(true);
  const [payment, setPayment] = useState<any>(null);
  const [receiptSignedUrl, setReceiptSignedUrl] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [reference, setReference] = useState("");
  const [payerName, setPayerName] = useState("");
  const [payerPhone, setPayerPhone] = useState("");
  const [method, setMethod] = useState("pago_movil");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("payments")
      .select("*")
      .eq("reservation_id", reservationId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    setPayment(data);
    if (data?.receipt_url) {
      const { data: signed } = await supabase.storage
        .from("payment-receipts")
        .createSignedUrl(data.receipt_url, 60 * 60);
      setReceiptSignedUrl(signed?.signedUrl ?? null);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, [reservationId]);

  const upload = async () => {
    if (!file) return toast.error("Selecciona el comprobante");
    if (!reference.trim()) return toast.error("Ingresa el número de referencia");
    if (!payerName.trim()) return toast.error("Ingresa el nombre del pagador");
    setSaving(true);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${reservationId}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("payment-receipts")
        .upload(path, file, { upsert: false, contentType: file.type });
      if (upErr) throw upErr;

      const payload: any = {
        reservation_id: reservationId,
        amount: totalPrice,
        payment_method: method,
        status: "submitted",
        receipt_url: path,
        reference_number: reference.trim(),
        payer_name: payerName.trim(),
        payer_phone: payerPhone.trim() || null,
        notes: notes.trim() || null,
        submitted_at: new Date().toISOString(),
        rejection_reason: null,
      };

      if (payment?.id && ["pending", "submitted", "failed"].includes(payment.status)) {
        const { error } = await supabase.from("payments").update(payload).eq("id", payment.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("payments").insert(payload);
        if (error) throw error;
      }
      toast.success("Comprobante enviado. Un administrador lo verificará pronto.");
      setFile(null);
      setReference("");
      setNotes("");
      await load();
    } catch (e: any) {
      toast.error(e.message || "No se pudo enviar el comprobante");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Card><CardContent className="p-6 flex justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </CardContent></Card>
    );
  }

  const deadlineDate = paymentDeadline ? new Date(paymentDeadline) : null;
  const minutesLeft = deadlineDate ? differenceInMinutes(deadlineDate, new Date()) : null;
  const expired = minutesLeft != null && minutesLeft <= 0;

  // Already submitted, awaiting admin verification
  if (payment && payment.status === "submitted") {
    return (
      <Card className="border-blue-500/30 bg-blue-500/5">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="h-4 w-4 text-blue-600" /> Comprobante en revisión
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p className="text-muted-foreground">
            Recibimos tu comprobante. Un administrador de RuedaVe verificará el pago y liberará la reserva.
            Recibirás una notificación en cuanto se confirme.
          </p>
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div><p className="text-muted-foreground">Método</p><p className="font-medium">{payment.payment_method}</p></div>
            <div><p className="text-muted-foreground">Referencia</p><p className="font-medium">{payment.reference_number || "—"}</p></div>
            <div><p className="text-muted-foreground">Monto</p><p className="font-medium">${Number(payment.amount).toFixed(2)}</p></div>
            <div><p className="text-muted-foreground">Enviado</p>
              <p className="font-medium">{payment.submitted_at ? format(new Date(payment.submitted_at), "dd MMM HH:mm", { locale: es }) : "—"}</p>
            </div>
          </div>
          {receiptSignedUrl && (
            <a href={receiptSignedUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
              <ImageIcon className="h-3 w-3" /> Ver comprobante
            </a>
          )}
        </CardContent>
      </Card>
    );
  }

  const wasRejected = payment && payment.status === "failed";

  return (
    <Card className="border-amber-500/40 bg-amber-500/5">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <DollarSign className="h-4 w-4 text-amber-700" />
          {wasRejected ? "Reenviar comprobante de pago" : "Completa el pago de tu reserva"}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="text-xs space-y-1">
            <p>
              <strong>Monto a pagar: ${totalPrice.toFixed(2)}</strong>
            </p>
            <p>
              Realiza el pago a nombre de <strong>RuedaVe C.A.</strong> vía Pago Móvil,
              transferencia bancaria o Zelle. Luego sube el comprobante y llena los datos
              para que un administrador verifique el pago.
            </p>
            {deadlineDate && !expired && minutesLeft != null && (
              <p className="text-amber-700 font-medium pt-1">
                Tiempo restante: {formatDistanceToNow(deadlineDate, { locale: es })}
              </p>
            )}
            {expired && (
              <p className="text-destructive font-medium pt-1">
                El plazo de 24h expiró. La reserva puede cancelarse en cualquier momento.
              </p>
            )}
          </AlertDescription>
        </Alert>

        <PaymentMethodsPanel amount={totalPrice} selected={method} onSelect={setMethod} />

        {wasRejected && payment.rejection_reason && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-xs">
              Comprobante anterior rechazado: {payment.rejection_reason}
            </AlertDescription>
          </Alert>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label className="text-xs">Método de pago</Label>
            <select
              className="w-full h-9 rounded-md border border-input bg-background px-2 text-sm"
              value={method}
              onChange={(e) => setMethod(e.target.value)}
            >
              <option value="pago_movil">Pago Móvil</option>
              <option value="transferencia">Transferencia bancaria</option>
              <option value="zelle">Zelle</option>
              <option value="efectivo">Efectivo</option>
            </select>
          </div>
          <div>
            <Label className="text-xs">N° de referencia</Label>
            <Input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Ej. 000123456789" />
          </div>
          <div>
            <Label className="text-xs">Nombre del pagador</Label>
            <Input value={payerName} onChange={(e) => setPayerName(e.target.value)} placeholder="Nombre y apellido" />
          </div>
          <div>
            <Label className="text-xs">Teléfono del pagador (opcional)</Label>
            <Input value={payerPhone} onChange={(e) => setPayerPhone(e.target.value)} placeholder="0412..." />
          </div>
          <div className="sm:col-span-2">
            <Label className="text-xs">Comprobante (imagen o PDF)</Label>
            <Input
              type="file"
              accept="image/*,application/pdf"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
            {file && <p className="text-xs text-muted-foreground mt-1">{file.name}</p>}
          </div>
          <div className="sm:col-span-2">
            <Label className="text-xs">Notas (opcional)</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Banco origen, fecha del pago, etc."
            />
          </div>
        </div>

        <Button onClick={upload} disabled={saving || !file} className="w-full">
          {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
          Enviar comprobante para verificación
        </Button>
      </CardContent>
    </Card>
  );
}

type MethodKey = "pago_movil" | "transferencia" | "zelle" | "efectivo";

const PAYMENT_METHODS: Array<{
  key: MethodKey;
  label: string;
  icon: any;
  currency: "VES" | "USD";
  fields: Array<{ label: string; value: string; copy?: boolean }>;
  note?: string;
}> = [
  {
    key: "pago_movil",
    label: "Pago Móvil",
    icon: Smartphone,
    currency: "VES",
    fields: [
      { label: "Banco", value: "0102 — Banco de Venezuela" },
      { label: "Cédula / RIF", value: "J-501234567", copy: true },
      { label: "Teléfono", value: "0414-1234567", copy: true },
      { label: "Titular", value: "RuedaVe C.A." },
    ],
    note: "Convierte el monto a Bs. usando la tasa BCV del día del pago.",
  },
  {
    key: "transferencia",
    label: "Transferencia bancaria",
    icon: Building2,
    currency: "VES",
    fields: [
      { label: "Banco", value: "Banesco (0134)" },
      { label: "Cuenta corriente", value: "0134-0000-00-0000000000", copy: true },
      { label: "RIF", value: "J-501234567", copy: true },
      { label: "Titular", value: "RuedaVe C.A." },
    ],
    note: "Convierte el monto a Bs. usando la tasa BCV del día del pago.",
  },
  {
    key: "zelle",
    label: "Zelle (USD)",
    icon: Mail,
    currency: "USD",
    fields: [
      { label: "Correo Zelle", value: "pagos@ruedave.com", copy: true },
      { label: "Titular", value: "RuedaVe LLC" },
    ],
    note: "Envía el monto exacto en USD. Incluye el ID de la reserva en el memo.",
  },
  {
    key: "efectivo",
    label: "Efectivo (USD o Bs.)",
    icon: Banknote,
    currency: "USD",
    fields: [
      { label: "Coordinación", value: "Contacta a soporte de RuedaVe" },
      { label: "WhatsApp", value: "+58 414-1234567", copy: true },
    ],
    note: "Solo con cita previa en la oficina de RuedaVe. Se emite recibo firmado.",
  },
];

function PaymentMethodsPanel({
  amount,
  selected,
  onSelect,
}: {
  amount: number;
  selected: string;
  onSelect: (m: string) => void;
}) {
  const copy = (val: string) => {
    navigator.clipboard.writeText(val);
    toast.success("Copiado al portapapeles");
  };
  const openWhatsApp = () => {
    const msg = encodeURIComponent(
      `Hola RuedaVe, ya realicé el pago de mi reserva por $${amount.toFixed(2)}. Adjunto el comprobante.`,
    );
    window.open(`https://wa.me/584141234567?text=${msg}`, "_blank");
  };

  return (
    <div className="space-y-3">
      <div>
        <p className="text-sm font-semibold">Elige un método de pago</p>
        <p className="text-xs text-muted-foreground">
          Paga a nombre de <strong>RuedaVe C.A.</strong> por el monto exacto de{" "}
          <strong>${amount.toFixed(2)}</strong> y guarda el comprobante.
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {PAYMENT_METHODS.map((m) => {
          const Icon = m.icon;
          const active = selected === m.key;
          return (
            <button
              key={m.key}
              type="button"
              onClick={() => onSelect(m.key)}
              className={`rounded-lg border p-2 text-left transition-colors ${
                active
                  ? "border-primary bg-primary/5 ring-1 ring-primary"
                  : "border-border hover:border-primary/40 hover:bg-muted/40"
              }`}
            >
              <Icon className={`h-4 w-4 mb-1 ${active ? "text-primary" : "text-muted-foreground"}`} />
              <p className="text-xs font-medium leading-tight">{m.label}</p>
              <p className="text-[10px] text-muted-foreground">{m.currency}</p>
            </button>
          );
        })}
      </div>

      {PAYMENT_METHODS.filter((m) => m.key === selected).map((m) => (
        <div key={m.key} className="rounded-lg border bg-background p-3 space-y-2">
          <div className="flex items-center gap-2">
            <m.icon className="h-4 w-4 text-primary" />
            <p className="text-sm font-semibold">{m.label}</p>
            <Badge variant="outline" className="ml-auto text-[10px]">{m.currency}</Badge>
          </div>
          <div className="grid gap-1.5">
            {m.fields.map((f) => (
              <div key={f.label} className="flex items-center justify-between gap-2 text-xs">
                <span className="text-muted-foreground">{f.label}</span>
                <div className="flex items-center gap-1 min-w-0">
                  <span className="font-medium truncate">{f.value}</span>
                  {f.copy && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 shrink-0"
                      onClick={() => copy(f.value)}
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
          {m.note && (
            <p className="text-[11px] text-muted-foreground border-t pt-2">{m.note}</p>
          )}
        </div>
      ))}

      <div className="rounded-lg border border-dashed p-3 space-y-2">
        <p className="text-xs font-medium">¿Cómo enviar el comprobante?</p>
        <ul className="text-[11px] text-muted-foreground list-disc pl-4 space-y-0.5">
          <li>Sube la captura o PDF en el formulario debajo (recomendado).</li>
          <li>O envíanoslo por WhatsApp para respuesta más rápida.</li>
        </ul>
        <Button type="button" variant="outline" size="sm" className="w-full" onClick={openWhatsApp}>
          <MessageCircle className="h-3.5 w-3.5 mr-1" /> Enviar comprobante por WhatsApp
        </Button>
      </div>
    </div>
  );
}
