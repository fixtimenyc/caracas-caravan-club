
## Objetivo

Añadir Facebook e Instagram como opciones para vincular una identidad social verificada en el Paso 4 de la verificación de arrendatario, junto a Google y Apple que ya existen.

## Limitaciones importantes a decidir antes de empezar

Meta (Facebook/Instagram) no está entre los proveedores nativos de Lovable Cloud (solo Google y Apple), y no existe un App User Connector para Meta. Por lo tanto **hay que implementar OAuth manual con la Graph API de Meta**. Antes de construir, es importante que sepas:

1. **Necesitas una cuenta Meta Developer y crear una App** en https://developers.facebook.com/. Sin eso, no podemos probar el flujo.
2. **Facebook Login para verificar la persona**: devuelve `id`, `name`, `email` (si el usuario lo autoriza) y foto de perfil. Es suficiente para "la cuenta existe y pertenece a la persona".
3. **Instagram**: Meta deprecó la Instagram Basic Display API en diciembre de 2024. Hoy solo se puede acceder vía **Instagram Login (con cuentas Business/Creator)** o via **Facebook Login cuando la cuenta de Instagram está enlazada a una página de Facebook**. Cuentas personales de Instagram (Personal) **no se pueden verificar** por API pública. Propuesta: ofrecer "Instagram" como opción secundaria que use Facebook Login y lea la cuenta de IG conectada; si el usuario no tiene IG-Business enlazado a FB, mostrar mensaje explicando la limitación y sugerir Facebook o Google.
4. **Antigüedad de la cuenta**: Meta **no expone** la fecha de creación de la cuenta por privacidad. La declaración de antigüedad seguirá siendo manual (ya la tienes con `declaredAgeMonths`), sujeta a revisión del admin.
5. **App Review de Meta**: Facebook Login básico (`public_profile`, `email`) funciona en modo desarrollo sin revisión. Para producción pública se requiere App Review de Meta (proceso de 1–2 semanas). Mientras tanto, solo los usuarios agregados como testers en tu Meta App podrán vincular.

Si aceptas estas limitaciones, el plan continúa así.

## Cambios

### 1. Base de datos (migración)

Extender `renter_verifications` para soportar Meta:

- `own_social_provider` ya existe como texto libre; añadir `'facebook'` e `'instagram'` como valores válidos en la app.
- Añadir columna `own_social_verified_picture text` para guardar el avatar devuelto por Meta (útil para revisión visual del admin cuando cruce con la selfie).
- El resto (`own_social_provider_user_id`, `own_social_verified_name`, `own_social_verified_email`, `own_social_verified_at`) se reutiliza tal cual.

### 2. Secretos (workflow con el usuario)

Después de que apruebes el plan, cuando entremos en implementación te pediré vía `add_secret`:

- `META_APP_ID` (público, se puede exponer al cliente)
- `META_APP_SECRET` (secreto, solo en edge function)

Y te daré la URL de callback exacta para que la configures en la Meta App como "Valid OAuth Redirect URI".

### 3. Edge function `meta-oauth-verify`

Función Deno que hace:

1. **Endpoint `POST /start`**: recibe el `user_id` autenticado (via JWT), genera un `state` firmado (nonce + user_id + timestamp) usando `META_APP_SECRET`, y devuelve la URL de autorización de Facebook con `scope=public_profile,email`. Para Instagram usa `scope=public_profile,email,instagram_basic,pages_show_list` (requiere IG-Business).
2. **Endpoint `GET /callback`**: recibe `code` y `state` de Meta:
   - Valida `state` (firma + antigüedad < 5 min).
   - Intercambia `code` por `access_token` (llamada a `graph.facebook.com/v21.0/oauth/access_token`).
   - Llama `graph.facebook.com/me?fields=id,name,email,picture` con el token.
   - (Para Instagram) llama `me/accounts` → toma el primer `instagram_business_account`.
   - Verifica que el `provider_user_id` no esté ya usado por otro `user_id` en `renter_verifications` (unicidad, para evitar reutilización de la misma cuenta social por varias personas).
   - Devuelve un HTML mínimo que hace `window.opener.postMessage({...})` con el resultado y cierra la ventana (mismo patrón que ya usa `SocialLinkCallback.tsx`).
3. CORS estándar, validación de input con Zod, uso de `SUPABASE_SERVICE_ROLE_KEY` para el chequeo de unicidad.

### 4. Cliente — `src/lib/socialIdentity.ts`

Extender `linkSocialInPopup(provider)` para aceptar `'facebook' | 'instagram'` además de `'google' | 'apple'`. Para Meta:

- No usa `supabase.auth.linkIdentity` (Meta no está en Supabase Auth).
- Llama al edge function `meta-oauth-verify/start`, abre popup en la URL devuelta.
- Escucha `postMessage` del callback y resuelve con el mismo shape `LinkedIdentity`.

### 5. UI — `src/pages/RenterVerificationPage.tsx` (Paso 4)

Añadir 2 botones más en el grid de opciones OAuth, debajo de Google y Apple:

- **Continuar con Facebook** (color de marca Meta azul)
- **Continuar con Instagram** (con nota "requiere cuenta Business enlazada a Facebook")

Cuando `linkedSocial` está presente, la tarjeta verde de "Verificado con X" ya muestra el proveedor genéricamente. Añadir el ícono correcto según el provider.

### 6. Panel admin (opcional, mismo turno)

En `AdminRenterVerificationsPage` mostrar el proveedor social y el link al perfil (si Meta devolvió `link`) para que el admin pueda hacer verificación cruzada rápida.

## Detalles técnicos

```text
Flujo:
Usuario clic "Continuar con Facebook"
   │
   ▼
POST /functions/v1/meta-oauth-verify/start
  Body: { provider: "facebook" }
  Auth: sesión Supabase del usuario
   │
   ▼ devuelve { authUrl }
Popup abre authUrl (facebook.com/v21.0/dialog/oauth?...)
   │
   ▼ usuario autoriza
Meta redirige a GET /functions/v1/meta-oauth-verify/callback?code=...&state=...
   │
   ▼ edge function intercambia code → token → me
   ▼ devuelve HTML con postMessage({ ok, identity })
   ▼
Cliente recibe postMessage, guarda linkedSocial, cierra popup
```

**Unicidad**: índice único parcial en `renter_verifications(own_social_provider, own_social_provider_user_id) WHERE own_social_provider IS NOT NULL` para bloquear que dos personas usen la misma cuenta FB.

**Instagram sin Business account**: si `me/accounts` no devuelve ninguna IG-Business, el callback responde con `{ ok: false, reason: "instagram_not_business" }` y el cliente muestra: "Tu cuenta de Instagram debe estar enlazada a una página de Facebook como cuenta Business/Creator. Prueba con Facebook directamente."

**Preservación de sesión**: como es un popup + `postMessage` (mismo patrón actual), la sesión Supabase del usuario nunca se toca; no hay riesgo de log-out.

## Fuera de alcance

- Verificar TikTok/Snapchat/LinkedIn (no lo pediste).
- Automatizar App Review de Meta.
- Estimar la antigüedad real de la cuenta (Meta no lo expone).

## Preguntas antes de implementar

1. ¿Confirmas que ya tienes o vas a crear una Meta App para poder darme `META_APP_ID` y `META_APP_SECRET` cuando lleguemos al paso de secretos?
2. Para Instagram, ¿te parece bien la limitación de "solo cuentas Business/Creator enlazadas a Facebook", o prefieres ocultar el botón de Instagram por ahora y dejar solo Facebook?
