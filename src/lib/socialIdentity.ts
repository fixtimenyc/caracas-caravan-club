import { supabase } from '@/integrations/supabase/client';

export type LinkedIdentity = {
  provider: 'google' | 'apple';
  providerUserId: string;
  name: string;
  email: string;
};

/**
 * Opens an OAuth popup to link a social identity to the current Supabase user.
 * Uses supabase.auth.linkIdentity which requires "Manual Linking" enabled at the
 * Auth server level. The popup redirects to /verificacion/social-callback which
 * postMessages back the linked identity list.
 */
export async function linkSocialInPopup(
  provider: 'google' | 'apple',
): Promise<LinkedIdentity> {
  const redirectTo = `${window.location.origin}/verificacion/social-callback`;

  const { data, error } = await supabase.auth.linkIdentity({
    provider,
    options: { redirectTo, skipBrowserRedirect: true },
  });

  if (error) throw error;
  const url = (data as { url?: string } | null)?.url;
  if (!url) throw new Error('No se pudo iniciar la verificación');

  const popup = window.open(
    url,
    'ruedave-social-verify',
    'width=520,height=640,menubar=no,toolbar=no',
  );
  if (!popup) {
    throw new Error(
      'Tu navegador bloqueó la ventana emergente. Habilítala e inténtalo de nuevo.',
    );
  }

  return await new Promise<LinkedIdentity>((resolve, reject) => {
    let settled = false;
    const cleanup = () => {
      settled = true;
      window.removeEventListener('message', onMessage);
      clearInterval(watchdog);
    };
    const onMessage = (ev: MessageEvent) => {
      if (ev.origin !== window.location.origin) return;
      const payload = ev.data as
        | { __socialLink?: boolean; ok?: boolean; error?: string; identities?: unknown[] }
        | undefined;
      if (!payload?.__socialLink) return;
      cleanup();
      if (!payload.ok) {
        reject(new Error(payload.error ?? 'Verificación cancelada'));
        return;
      }
      const identities = (payload.identities ?? []) as Array<{
        provider?: string;
        provider_id?: string;
        id?: string;
        last_sign_in_at?: string;
        created_at?: string;
        identity_data?: Record<string, unknown>;
      }>;
      const match = identities
        .filter((i) => i.provider === provider)
        .sort((a, b) => {
          const at = new Date(a.last_sign_in_at ?? a.created_at ?? 0).getTime();
          const bt = new Date(b.last_sign_in_at ?? b.created_at ?? 0).getTime();
          return bt - at;
        })[0];
      if (!match) {
        reject(new Error('No se recibió la identidad del proveedor'));
        return;
      }
      const idData = (match.identity_data ?? {}) as {
        sub?: string;
        full_name?: string;
        name?: string;
        email?: string;
      };
      resolve({
        provider,
        providerUserId:
          (idData.sub as string | undefined) ??
          match.provider_id ??
          match.id ??
          '',
        name: idData.full_name ?? idData.name ?? '',
        email: idData.email ?? '',
      });
    };
    window.addEventListener('message', onMessage);
    const watchdog = setInterval(() => {
      if (settled) return;
      if (popup.closed) {
        cleanup();
        reject(new Error('Cerraste la ventana antes de completar la verificación'));
      }
    }, 500);
  });
}
