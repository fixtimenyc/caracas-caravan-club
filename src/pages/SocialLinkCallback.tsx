import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

/**
 * Popup callback for supabase.auth.linkIdentity.
 * Reads the current user's identities and postMessages the list back to the
 * opener window, then closes itself.
 */
const SocialLinkCallback = () => {
  const [message, setMessage] = useState('Verificando tu identidad...');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // Give supabase-js a moment to finalize any auth exchange in this popup.
      await new Promise((r) => setTimeout(r, 300));
      // @ts-expect-error getUserIdentities available at runtime
      const { data, error } = await supabase.auth.getUserIdentities();
      if (cancelled) return;

      if (window.opener) {
        window.opener.postMessage(
          {
            __socialLink: true,
            ok: !error,
            error: error?.message,
            identities: (data as { identities?: unknown[] } | null)?.identities ?? [],
          },
          window.location.origin,
        );
        setMessage('Listo, puedes cerrar esta ventana');
        setTimeout(() => window.close(), 400);
      } else {
        setMessage(
          error
            ? 'No se pudo verificar tu identidad. Cierra esta pestaña.'
            : 'Verificación completada. Cierra esta pestaña.',
        );
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-background text-foreground p-6 text-center">
      <Loader2 className="w-8 h-8 animate-spin text-primary" />
      <p className="text-sm text-muted-foreground max-w-xs">{message}</p>
    </div>
  );
};

export default SocialLinkCallback;
