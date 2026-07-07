import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle2, XCircle, ImageIcon, Loader2, DollarSign, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { es } from "date-fns/locale";

type Props = {
  reservationId: string;
  onChange?: () => void;
};

export default function AdminPaymentVerification({ reservationId, onChange }: Props) {
  const [loading, setLoading] = useState(true);
  const [payment, setPayment] = useState<any>(null);
  const [receiptUrl, setReceiptUrl] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [acting, setActing] = useState(false);

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
      setReceiptUrl(signed?.signedUrl ?? null);
    } else {
      setReceiptUrl(null);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, [reservationId]);

  const verify = async () => {
    if (!payment) return;
    setActing(true);
    const { data: userData } = await supabase.auth.getUser();
    const { error } = await supabase
      .from("payments")
      .update({
        status: "completed",
        verified_at: new Date().toISOString(),
        verified_by: userData.user?.id ?? null,
        rejection_reason: null,
      })
      .eq("id", payment.id);
    setActing(false);
    if (error) return toast.error(error.message);
    toast.success("Pago verificado. La reserva quedó aprobada.");
    await load();
    onChange?.();
  };

  const reject = async () => {
    if (!payment) return;
    if (!rejectReason.trim()) return toast.error("Escribe un motivo de rechazo");
    setActing(true);
    const { data: userData } = await supabase.auth.getUser();
    const { error } = await supabase
      .from("payments")
      .update({
        status: "failed",
        verified_at: new Date().toISOString(),
        verified_by: userData.user?.id ?? null,
        rejection_reason: rejectReason.trim(),
      })
      .eq("id", payment.id);
    setActing(false);
    if (error) return toast.error(error.message);
    toast.success("Comprobante rechazado. Se notificó al arrendatario.");
    setRejectReason("");
    await load();
    onChange?.();
  };

  if (loading) {
    return (
      <Card><CardContent className="p-6 flex justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </CardContent></Card>
    );
  }

  if (!payment) {
    return (
      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><DollarSign className="h-4 w-4" /> Verificación de pago</CardTitle></CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">El arrendatario aún no ha enviado el comprobante.</p>
        </CardContent>
      </Card>
    );
  }

  const statusBadge: Record<string, { label: string; cls: string }> = {
    pending: { label: "Pendiente", cls: "bg-muted text-muted-foreground" },
    submitted: { label: "En revisión", cls: "bg-blue-500/10 text-blue-700 border-blue-500/30" },
    completed: { label: "Verificado", cls: "bg-emerald-500/10 text-emerald-700 border-emerald-500/30" },
    failed: { label: "Rechazado", cls: "bg-red-500/10 text-red-700 border-red-500/30" },
    refunded: { label: "Reembolsado", cls: "bg-slate-100 text-slate-700" },
  };
  const s = statusBadge[payment.status] ?? statusBadge.pending;
  const canAct = payment.status === "submitted";

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base flex items-center gap-2">
          <DollarSign className="h-4 w-4" /> Verificación de pago
        </CardTitle>
        <Badge variant="outline" className={s.cls}>{s.label}</Badge>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div><p className="text-muted-foreground">Método</p><p className="font-medium">{payment.payment_method}</p></div>
          <div><p className="text-muted-foreground">Monto</p><p className="font-medium">${Number(payment.amount).toFixed(2)}</p></div>
          <div><p className="text-muted-foreground">Referencia</p><p className="font-medium">{payment.reference_number || "—"}</p></div>
          <div><p className="text-muted-foreground">Pagador</p><p className="font-medium">{payment.payer_name || "—"}</p></div>
          {payment.payer_phone && (<div><p className="text-muted-foreground">Teléfono</p><p className="font-medium">{payment.payer_phone}</p></div>)}
          <div><p className="text-muted-foreground">Enviado</p>
            <p className="font-medium">{payment.submitted_at ? format(new Date(payment.submitted_at), "dd MMM HH:mm", { locale: es }) : "—"}</p>
          </div>
        </div>
        {payment.notes && (
          <div className="rounded border bg-muted/40 p-2 text-xs">
            <span className="text-muted-foreground">Nota: </span>{payment.notes}
          </div>
        )}
        {receiptUrl ? (
          <a href={receiptUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
            <ImageIcon className="h-3 w-3" /> Ver comprobante
          </a>
        ) : (
          <p className="text-xs text-muted-foreground">Sin comprobante adjunto</p>
        )}

        {payment.status === "failed" && payment.rejection_reason && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-xs">Rechazado: {payment.rejection_reason}</AlertDescription>
          </Alert>
        )}
        {payment.status === "completed" && payment.verified_at && (
          <p className="text-xs text-emerald-700">
            Verificado el {format(new Date(payment.verified_at), "dd MMM yyyy HH:mm", { locale: es })}
          </p>
        )}

        {canAct && (
          <div className="space-y-2 pt-2 border-t">
            <Button onClick={verify} disabled={acting} className="w-full">
              {acting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
              Aprobar pago y liberar reserva
            </Button>
            <Textarea
              placeholder="Motivo del rechazo (obligatorio para rechazar)"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={2}
            />
            <Button onClick={reject} disabled={acting || !rejectReason.trim()} variant="destructive" className="w-full">
              <XCircle className="h-4 w-4 mr-2" /> Rechazar comprobante
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
