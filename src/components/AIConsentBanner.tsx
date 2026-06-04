import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useConsents } from "@/hooks/useConsents";
import { useAuth } from "@/hooks/useAuth";

const DISMISS_KEY = "ruedave_ai_consent_dismissed";

export default function AIConsentBanner() {
  const { user } = useAuth();
  const { consents, loading, setConsent } = useConsents();
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    setDismissed(localStorage.getItem(DISMISS_KEY) === "1");
  }, []);

  if (!user || loading || dismissed) return null;
  if (consents.ai_training !== null) return null;

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, "1");
    setDismissed(true);
  };

  return (
    <div className="fixed bottom-4 left-1/2 z-50 w-[92vw] max-w-2xl -translate-x-1/2 rounded-xl border border-border bg-card shadow-xl">
      <div className="p-4 md:p-5">
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-primary/10 p-2 text-primary">
            <Sparkles className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-foreground">Mejora la movilidad de Caracas</h3>
            <p className="mt-1 text-sm text-muted-foreground leading-relaxed">
              ¿Autoriza a RuedaVe a utilizar sus datos de viaje anonimizados para mejorar
              la seguridad vial, la planificación urbana y el desarrollo de productos de
              movilidad? <strong>Sus datos nunca serán vendidos de forma identificable.</strong>
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                size="sm"
                onClick={async () => {
                  await setConsent("ai_training", true);
                  dismiss();
                }}
              >
                Autorizar
              </Button>
              <Button size="sm" variant="ghost" onClick={dismiss}>
                Ahora no
              </Button>
              <Button size="sm" variant="link" asChild>
                <Link to="/perfil/privacidad">Ver detalles</Link>
              </Button>
            </div>
          </div>
          <button
            onClick={dismiss}
            aria-label="Cerrar"
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
