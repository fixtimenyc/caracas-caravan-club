import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, Loader2, RefreshCw, X, Check, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onClose: () => void;
  onCapture: (files: File[]) => Promise<void> | void;
}

/**
 * In-page live camera. Uses getUserMedia so the browser doesn't unload the page
 * (which happens with <input capture>) and allows taking multiple shots in a row.
 */
export default function LiveCameraCapture({ open, onClose, onCapture }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [starting, setStarting] = useState(false);
  const [shots, setShots] = useState<{ file: File; url: string }[]>([]);
  const [saving, setSaving] = useState(false);
  const [facing, setFacing] = useState<"environment" | "user">("environment");

  const [denied, setDenied] = useState(false);
  const fallbackRef = useRef<HTMLInputElement>(null);

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const start = useCallback(async () => {
    setStarting(true);
    setDenied(false);
    try {
      stop();
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("Cámara no disponible en este navegador");
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: facing }, width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
    } catch (e: any) {
      const msg = e?.message ?? "permiso denegado";
      toast.error("No se pudo acceder a la cámara: " + msg);
      setDenied(true);
    } finally {
      setStarting(false);
    }
  }, [facing, stop]);

  useEffect(() => {
    if (open) start();
    return () => stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, facing]);

  useEffect(() => {
    return () => {
      shots.forEach((s) => URL.revokeObjectURL(s.url));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const takeShot = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || !video.videoWidth) return;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const file = new File([blob], `foto-${Date.now()}.jpg`, { type: "image/jpeg" });
        const url = URL.createObjectURL(blob);
        setShots((s) => [...s, { file, url }]);
      },
      "image/jpeg",
      0.9
    );
  };

  const removeShot = (idx: number) => {
    setShots((s) => {
      const copy = [...s];
      const [gone] = copy.splice(idx, 1);
      if (gone) URL.revokeObjectURL(gone.url);
      return copy;
    });
  };

  const finish = async () => {
    if (shots.length === 0) {
      onClose();
      return;
    }
    setSaving(true);
    try {
      await onCapture(shots.map((s) => s.file));
      shots.forEach((s) => URL.revokeObjectURL(s.url));
      setShots([]);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const handleOpenChange = (v: boolean) => {
    if (!v) {
      stop();
      shots.forEach((s) => URL.revokeObjectURL(s.url));
      setShots([]);
      onClose();
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl p-0 overflow-hidden">
        <DialogHeader className="p-4 pb-2">
          <DialogTitle className="flex items-center gap-2">
            <Camera className="h-5 w-5" /> Tomar fotos en vivo
          </DialogTitle>
        </DialogHeader>
        <div className="relative bg-black">
          <video
            ref={videoRef}
            playsInline
            muted
            autoPlay
            className="w-full max-h-[60vh] object-contain bg-black"
          />
          {starting && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/50">
              <Loader2 className="h-6 w-6 animate-spin text-white" />
            </div>
          )}
          <canvas ref={canvasRef} className="hidden" />
        </div>

        {shots.length > 0 && (
          <div className="px-4 pt-3">
            <p className="text-xs text-muted-foreground mb-2">
              {shots.length} foto{shots.length === 1 ? "" : "s"} tomada{shots.length === 1 ? "" : "s"}
            </p>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {shots.map((s, i) => (
                <div key={s.url} className="relative shrink-0">
                  <img src={s.url} alt="" className="h-16 w-16 object-cover rounded-md border border-border" />
                  <button
                    type="button"
                    onClick={() => removeShot(i)}
                    className="absolute -top-1 -right-1 bg-background border border-border rounded-full p-0.5"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex items-center justify-between gap-2 p-4">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setFacing((f) => (f === "environment" ? "user" : "environment"))}
          >
            <RefreshCw className="h-4 w-4 mr-1" /> Cambiar cámara
          </Button>
          <div className="flex gap-2">
            <Button type="button" size="lg" onClick={takeShot} disabled={starting}>
              <Camera className="h-5 w-5 mr-2" /> Capturar
            </Button>
            <Button type="button" variant="default" size="lg" onClick={finish} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Check className="h-4 w-4 mr-2" />}
              Listo ({shots.length})
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
