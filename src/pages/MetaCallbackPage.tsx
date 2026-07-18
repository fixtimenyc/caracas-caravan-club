import { useEffect } from 'react';

/**
 * OAuth redirect target for Meta (Facebook/Instagram) verification.
 * The popup lands here, forwards `code` + `state` to the parent window
 * via postMessage, and closes itself. The parent (linkMetaInPopup) then
 * calls the edge function to exchange the code and finish verification.
 */
export default function MetaCallbackPage() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const state = params.get('state');
    const error = params.get('error') || params.get('error_message');

    const payload = {
      __metaOAuth: true as const,
      ok: !!code && !error,
      code,
      state,
      error,
    };

    try {
      window.opener?.postMessage(payload, window.location.origin);
    } catch (e) {
      console.error('postMessage failed', e);
    }
    // Small delay so the parent handler can run before closing.
    setTimeout(() => window.close(), 100);
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background text-foreground">
      <div className="text-center space-y-2">
        <p className="text-sm text-muted-foreground">
          Completando verificación con Meta…
        </p>
        <p className="text-xs text-muted-foreground">
          Puedes cerrar esta ventana si no se cierra automáticamente.
        </p>
      </div>
    </div>
  );
}
