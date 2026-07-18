# Verificación por red social + referido de usuario

## Objetivo

Reemplazar en el paso "Redes y referencia" del cuestionario de verificación de arrendatario:

1. La declaración manual de plataforma/URL/antigüedad → **login OAuth real** que devuelva un token verificado. Solo cuenta si el proveedor expone antigüedad ≥ **6 meses** (Facebook / Instagram / LinkedIn). Google/Apple se aceptan como capa extra pero **no cumplen** el requisito de antigüedad por sí solos.
2. La referencia personal libre → **referencia opcional a otro usuario ya registrado** en RuedaVe, verificada por email y con notificación al referente para que confirme.

## Cambios

### 1. Base de datos (1 migración)

Nuevas columnas en `renter_verifications`:
- `own_social_provider` (text) — `facebook`, `instagram`, `linkedin`, `google`, `apple`
- `own_social_provider_user_id` (text) — id devuelto por el proveedor
- `own_social_verified_at` (timestamptz)
- `own_social_verified_name`, `own_social_verified_email` (text) — payload firmado que se cruza con lo que declaró el usuario
- `own_social_account_created_at` (timestamptz, nullable) — solo si el proveedor la expone
- `own_social_age_verified` (boolean) — true solo si `account_created_at ≤ now() - 6 months`
- `personal_reference_user_id` (uuid → auth.users, nullable) — reemplaza los campos de nombre/parentesco/redes del referente
- `personal_reference_confirmed_at` (timestamptz)
- Se mantienen los antiguos campos como legacy para no romper solicitudes en curso.

Nueva tabla `renter_reference_requests` (referente confirma o rechaza):
- `verification_id`, `requester_user_id`, `referent_user_id`, `referent_email`, `status` (`pending`/`confirmed`/`declined`), `responded_at`.
- RLS: requester y referent ven su propia fila; admin ve todo.
- Trigger: al crear, inserta notificación in-app al referent con acción `/perfil/referencias/{id}`.

Nueva función `request_personal_reference(_verification_id, _email)`:
- Valida que el email pertenezca a un usuario existente (`auth.users`) y distinto del solicitante.
- Crea la fila `renter_reference_requests` y devuelve el `referent_user_id`.

Nueva función `confirm_personal_reference(_request_id, _accept)`:
- Solo el `referent_user_id = auth.uid()` puede llamarla.
- Marca `confirmed` / `declined` y, si `confirmed`, actualiza `renter_verifications.personal_reference_user_id` y `personal_reference_confirmed_at`.

Ajuste a `get_renter_profile_for_owner`: expone `social_verified`, `social_provider`, `social_age_verified`, `personal_reference_confirmed` para que el aliado vea la señal.

### 2. Auth social (Google + Apple + Facebook)

- Google y Apple ya están soportados por Lovable Cloud → activar ambos con `configure_social_auth` (`providers: ["google","apple"]`).
- Facebook/Instagram **no** están soportados nativamente por Lovable Cloud. Se conecta vía **App User Connector** (`connector_app_user--list_connectors` → cliente Facebook/Instagram Basic Display). El builder deberá crear una app en Meta y añadir el redirect del gateway de Lovable.
- LinkedIn queda disponible como fallback vía connector (opcional, se puede activar en el mismo paso si el usuario lo pide después).

### 3. Frontend — Paso 5 "Redes y referencia" en `RenterVerificationPage.tsx`

Nuevo bloque **"Verifica tu identidad con una red social"**:
- 4 botones: *Continuar con Facebook*, *Continuar con Instagram*, *Continuar con Google*, *Continuar con Apple*.
- Al aprobar, se llama:
  - Google/Apple → `lovable.auth.signInWithOAuth` en un popup lateral que no toca la sesión principal (usa `redirect_uri` a `/verificacion/social-callback`). Guardamos payload como capa adicional, con badge "Identidad verificada" pero **advertencia** de que no cuenta como antigüedad ≥6 meses.
  - Facebook/Instagram → hook `useSocialAgeVerification` que abre el OAuth del connector, lee `me?fields=id,name,email,account_created_time` en un edge function (`verify-social-age`) y actualiza `renter_verifications`.
- Muestra estado en vivo: proveedor, nombre devuelto, fecha estimada de creación, badge verde si ≥6 meses, badge amarillo si no.
- Bloquea "Continuar" hasta tener al menos una red con `own_social_age_verified = true` **o** hasta que el usuario marque explícitamente "No dispongo de redes con esa antigüedad" (queda pendiente de revisión manual del admin).

Nuevo bloque **"Referencia personal (opcional)"**:
- Sustituye los campos previos por un solo input de correo + botón "Enviar solicitud".
- Antes de enviar, hint claro: *"Debe ser el correo de alguien ya registrado en RuedaVe. Es opcional, pero acelera tu verificación."*
- Al enviar, llama `request_personal_reference`. Feedback:
  - "Usuario no encontrado" si el email no existe → sugiere invitarlo por WhatsApp.
  - "Solicitud enviada, esperando confirmación" si existe → muestra estado en vivo con `useReferenceRequests`.
- El bloque de "Continuar" no depende de la referencia (es opcional).

Nueva página `/perfil/referencias` (para el referente):
- Lista de solicitudes pendientes con nombre y foto del solicitante.
- Botones **Confirmar** / **Rechazar** → llaman `confirm_personal_reference`.

### 4. Edge function `verify-social-age`

- Recibe `provider`, `provider_access_token`, `verification_id`.
- Verifica el token con el connector gateway (Facebook Graph `/me?fields=id,name,email` + endpoint de account age; Instagram Basic Display para `account_created_time`).
- Escribe en `renter_verifications` con `service_role`.
- Devuelve `{ verified, account_age_months, meets_threshold }`.

### 5. Compatibilidad y datos legacy

- Formularios ya enviados con red social manual siguen mostrando su información antigua en el bloque de revisión (`own_social_platform`, `own_social_url`, `own_social_age_months`) pero con badge "Método antiguo — pendiente de revisión manual".
- Las nuevas solicitudes solo se aprueban si `own_social_age_verified = true` o si el admin sube una anotación manual (mantiene poder de excepción).

## Preguntas para el usuario tras aprobar el plan

- **Facebook/Instagram OAuth app**: necesitas crear la app en Meta Developers y darme las credenciales (Client ID + Secret) cuando llegue el momento. Puedo indicarte el redirect URI exacto del gateway de Lovable cuando activemos el connector.
- **Apple Sign In**: se activa con el modo gestionado por defecto (sin credenciales propias). ¿Ok?

## Notas técnicas

- Todos los OAuth se hacen en popup separado; no rompen la sesión Supabase del arrendatario.
- El referente recibe notificación in-app + email (via función existente de notificaciones).
- El requisito de ≥6 meses queda en el frontend **y** en un check server-side en la función que aprueba solicitudes (`handle_renter_verification_approved` se amplía para bloquear aprobación automática si el social_age_verified es false y no hay override admin).

## Fuera de alcance

- Verificación por Twitter/X (X connector es solo lectura pública, no hace login como usuario).
- WhatsApp OAuth (no existe).
- Restauración retroactiva de antigüedad para usuarios ya aprobados con método antiguo.
