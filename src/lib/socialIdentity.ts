import { supabase } from '@/integrations/supabase/client';

export type SocialProvider = 'google' | 'apple' | 'facebook' | 'instagram';

export type LinkedIdentity = {
  provider: SocialProvider;
  providerUserId: string;
  name: string;
  email: string;
  picture?: string;
};

/**
 * Opens an OAuth popup to link a social identity to the current Supabase user.
 * For Google/Apple, uses supabase.auth.linkIdentity which requires "Manual Linking".
 * For Facebook/Instagram, uses the meta-oauth-verify edge function (Meta is not
 * a native Supabase provider on Lovable Cloud).
 */
export async function linkSocialInPopup(
  provider: SocialProvider,
): Promise<LinkedIdentity> {
  if (provider === 'facebook' || provider === 'instagram') {
    return await linkMetaInPopup(provider);
  }
  return await linkSupabaseIdentityInPopup(provider);
}

async function linkSupabaseIdentityInPopup(
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

  const popup = openPopup(url);

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
        picture?: string;
        avatar_url?: string;
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
        picture: idData.picture ?? idData.avatar_url,
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

async function linkMetaInPopup(
  provider: 'facebook' | 'instagram',
): Promise<LinkedIdentity> {
  const redirectUri = `${window.location.origin}/verificacion/meta-callback`;

  // 1. Ask edge function for the Meta authorize URL (with signed state)
  const { data: startData, error: startErr } = await supabase.functions.invoke(
    'meta-oauth-verify',
    { body: { action: 'start', provider, redirectUri } },
  );
  if (startErr) {
    throw new Error(readInvokeError(startErr) ?? 'No se pudo iniciar Meta OAuth');
  }
  const authUrl = (startData as { authUrl?: string } | null)?.authUrl;
  if (!authUrl) throw new Error('Meta no devolvió la URL de autorización');

  // 2. Open popup with Meta authorize URL
  const popup = openPopup(authUrl);

  // 3. Wait for postMessage from the callback page
  return await new Promise<LinkedIdentity>((resolve, reject) => {
    let settled = false;
    const cleanup = () => {
      settled = true;
      window.removeEventListener('message', onMessage);
      clearInterval(watchdog);
    };
    const onMessage = async (ev: MessageEvent) => {
      if (ev.origin !== window.location.origin) return;
      const payload = ev.data as
        | {
            __metaOAuth?: boolean;
            ok?: boolean;
            code?: string | null;
            state?: string | null;
            error?: string | null;
          }
        | undefined;
      if (!payload?.__metaOAuth) return;
      cleanup();
      if (!payload.ok || !payload.code || !payload.state) {
        reject(new Error(payload.error || 'Autorización cancelada'));
        return;
      }
      try {
        const { data: exData, error: exErr } = await supabase.functions.invoke(
          'meta-oauth-verify',
          {
            body: {
              action: 'exchange',
              provider,
              code: payload.code,
              state: payload.state,
              redirectUri,
            },
          },
        );
        if (exErr) {
          reject(new Error(readInvokeError(exErr) ?? 'Error al verificar con Meta'));
          return;
        }
        const identity = (exData as { identity?: LinkedIdentity } | null)
          ?.identity;
        if (!identity) {
          reject(new Error('Meta no devolvió los datos de identidad'));
          return;
        }
        resolve(identity);
      } catch (e) {
        reject(e instanceof Error ? e : new Error(String(e)));
      }
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

function openPopup(url: string) {
  const popup = window.open(
    url,
    'ruedave-social-verify',
    'width=560,height=680,menubar=no,toolbar=no',
  );
  if (!popup) {
    throw new Error(
      'Tu navegador bloqueó la ventana emergente. Habilítala e inténtalo de nuevo.',
    );
  }
  return popup;
}

function readInvokeError(err: unknown): string | null {
  if (!err) return null;
  const anyErr = err as {
    message?: string;
    context?: { text?: () => Promise<string> };
  };
  return anyErr.message ?? null;
}
