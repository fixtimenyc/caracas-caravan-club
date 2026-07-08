import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, Loader2, RefreshCw, X, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
  const nativeInputRef = useRef<HTMLInputElement>(null);
  const [starting, setStarting] = useState(false);
  const [shots, setShots] = useState<{ file: File; url: string }[]>([]);
  const [saving, setSaving] = useState(false);
  const [facing, setFacing] = useState<"environment" | "user">("environment");

  const [denied, setDenied] = useState(false);
  const [nativeMode, setNativeMode] = useState(false);
  const startRequestRef = useRef(0);

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const start = useCallback(async () => {
    const requestId = startRequestRef.current + 1;
    startRequestRef.current = requestId;
    setStarting(true);
    setDenied(false);
    setNativeMode(false);
    try {
      stop();
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("Cámara no disponible en este navegador");
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: facing }, width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      });
      if (requestId !== startRequestRef.current) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
    } catch (e: unknown) {
      if (requestId !== startRequestRef.current) return;
      setDenied(true);
      setNativeMode(true);
    } finally {
      if (requestId === startRequestRef.current) setStarting(false);
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
    if (denied || nativeMode) {
      nativeInputRef.current?.click();
      return;
    }
    setDenied(false);
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
        void uploadCapturedFiles([file]);
      },
      "image/jpeg",
      0.9
    );
  };

  const uploadCapturedFiles = async (files: File[]) => {
    if (!files.length) return;
    setSaving(true);
    try {
      await onCapture(files);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo subir la foto");
    } finally {
      setSaving(false);
    }
  };

  const addNativeShots = (files: FileList | null) => {
    const selected = Array.from(files ?? []);
    if (!selected.length) return;
    stop();
    setDenied(false);
    setNativeMode(true);
    selected.forEach((file) => {
      const url = URL.createObjectURL(file);
      setShots((s) => [...s, { file, url }]);
    });
    void uploadCapturedFiles(selected);
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
    if (saving) return;
    shots.forEach((s) => URL.revokeObjectURL(s.url));
    setShots([]);
    onClose();
  };

  const handleOpenChange = (v: boolean) => {
    if (!v) {
      stop();
      shots.forEach((s) => URL.revokeObjectURL(s.url));
      setShots([]);
      setDenied(false);
      setNativeMode(false);
      onClose();
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl p-0 overflow-hidden" onInteractOutside={(e) => e.preventDefault()}>
        <DialogHeader className="p-4 pb-2">
          <DialogTitle className="flex items-center gap-2">
            <Camera className="h-5 w-5" /> Tomar fotos en vivo
          </DialogTitle>
          <DialogDescription className="sr-only">
            Cámara en vivo para capturar varias fotos del vehículo sin salir de la página.
          </DialogDescription>
        </DialogHeader>
        <div className="relative bg-black">
          <video
            ref={videoRef}
            playsInline
            muted
            autoPlay
            className={`w-full max-h-[60vh] object-contain bg-black ${denied || nativeMode ? "hidden" : ""}`}
          />
          {starting && !denied && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/50">
              <Loader2 className="h-6 w-6 animate-spin text-white" />
            </div>
          )}
          {(denied || nativeMode) && (
            <div className="p-6 bg-muted text-center space-y-3">
              <p className="text-sm text-foreground">
                {shots.length > 0
                  ? saving
                    ? "Foto tomada. Subiendo..."
                    : "Foto tomada y subida. Puedes tomar otra o finalizar."
                  : "La cámara en vivo está bloqueada en este navegador."}
              </p>
              <p className="text-xs text-muted-foreground">
                Usaremos la cámara del dispositivo para tomar fotos en vivo sin seleccionar archivos guardados.
              </p>
              <div className="flex gap-2 justify-center flex-wrap">
                <Button type="button" variant="outline" size="sm" onClick={start}>
                  <RefreshCw className="h-4 w-4 mr-1" /> Reintentar
                </Button>
                <Button type="button" size="sm" onClick={() => nativeInputRef.current?.click()}>
                  <Camera className="h-4 w-4 mr-1" /> Tomar foto
                </Button>
              </div>
            </div>
          )}
          <input
            ref={nativeInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => {
              addNativeShots(e.currentTarget.files);
              e.currentTarget.value = "";
            }}
          />
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

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 p-4">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setFacing((f) => (f === "environment" ? "user" : "environment"))}
            disabled={nativeMode}
            className="w-full sm:w-auto"
          >
            <RefreshCw className="h-4 w-4 mr-1" /> Cambiar cámara
          </Button>
          <div className="grid grid-cols-2 gap-2 w-full sm:flex sm:w-auto">
            <Button type="button" size="lg" onClick={takeShot} disabled={starting || saving} className="px-3">
              <Camera className="h-5 w-5 mr-2" /> {nativeMode ? "Tomar foto" : "Capturar"}
            </Button>
            <Button type="button" variant="default" size="lg" onClick={finish} disabled={saving} className="px-3">
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Check className="h-4 w-4 mr-2" />}
              Listo ({shots.length})
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
