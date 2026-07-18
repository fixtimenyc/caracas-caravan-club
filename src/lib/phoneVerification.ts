/**
 * Phone verification helper.
 *
 * ⚠️ MODO DEMO: por ahora simula el envío de código SMS y acepta cualquier
 * código de 6 dígitos (o el código "123456"). Cuando se contrate Twilio Verify
 * (o similar), reemplazar el cuerpo de `sendVerificationCode` y
 * `checkVerificationCode` por llamadas a edge functions.
 *
 * ── Migración futura a Twilio Verify ───────────────────────────────────────
 * 1. Configurar secrets: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN,
 *    TWILIO_VERIFY_SERVICE_SID.
 * 2. Crear edge functions:
 *    - `phone-verify-send`   → POST https://verify.twilio.com/v2/Services/{sid}/Verifications
 *      body: To=<e164>, Channel=sms
 *    - `phone-verify-check`  → POST https://verify.twilio.com/v2/Services/{sid}/VerificationCheck
 *      body: To=<e164>, Code=<6-digit>
 * 3. Reemplazar las funciones de este archivo por:
 *      supabase.functions.invoke('phone-verify-send',  { body: { phone } })
 *      supabase.functions.invoke('phone-verify-check', { body: { phone, code } })
 * 4. El resto de la UI en RenterVerificationPage no requiere cambios.
 * ───────────────────────────────────────────────────────────────────────────
 */

export const COUNTRY_CODES = [
  { code: '+58', flag: '🇻🇪', label: 'Venezuela', iso: 'VE', example: '4141234567' },
  { code: '+1',  flag: '🇺🇸', label: 'Estados Unidos / Canadá', iso: 'US', example: '5551234567' },
  { code: '+34', flag: '🇪🇸', label: 'España', iso: 'ES', example: '612345678' },
  { code: '+57', flag: '🇨🇴', label: 'Colombia', iso: 'CO', example: '3001234567' },
  { code: '+52', flag: '🇲🇽', label: 'México', iso: 'MX', example: '5512345678' },
  { code: '+54', flag: '🇦🇷', label: 'Argentina', iso: 'AR', example: '91123456789' },
  { code: '+55', flag: '🇧🇷', label: 'Brasil', iso: 'BR', example: '11912345678' },
  { code: '+56', flag: '🇨🇱', label: 'Chile', iso: 'CL', example: '912345678' },
  { code: '+51', flag: '🇵🇪', label: 'Perú', iso: 'PE', example: '912345678' },
  { code: '+593', flag: '🇪🇨', label: 'Ecuador', iso: 'EC', example: '991234567' },
  { code: '+507', flag: '🇵🇦', label: 'Panamá', iso: 'PA', example: '61234567' },
  { code: '+39', flag: '🇮🇹', label: 'Italia', iso: 'IT', example: '3123456789' },
  { code: '+49', flag: '🇩🇪', label: 'Alemania', iso: 'DE', example: '15123456789' },
  { code: '+33', flag: '🇫🇷', label: 'Francia', iso: 'FR', example: '612345678' },
  { code: '+44', flag: '🇬🇧', label: 'Reino Unido', iso: 'GB', example: '7123456789' },
] as const;

export type CountryCode = (typeof COUNTRY_CODES)[number];

/** Une código de país + número local en formato E.164 (+<country><national>). */
export const toE164 = (countryCode: string, local: string): string => {
  const digits = local.replace(/\D/g, '').replace(/^0+/, '');
  return `${countryCode}${digits}`;
};

/** Validación básica E.164: + seguido de 8 a 15 dígitos. */
export const isValidE164 = (e164: string): boolean => /^\+\d{8,15}$/.test(e164);

export interface VerificationResult {
  ok: boolean;
  message?: string;
}

/**
 * MOCK: "envía" el código. En producción llamará a la edge function
 * `phone-verify-send` que usa Twilio Verify.
 */
export const sendVerificationCode = async (
  phoneE164: string,
): Promise<VerificationResult> => {
  if (!isValidE164(phoneE164)) {
    return { ok: false, message: 'Número inválido' };
  }
  // Simula latencia de red.
  await new Promise((r) => setTimeout(r, 600));
  // eslint-disable-next-line no-console
  console.info(
    `[MOCK SMS] Código de verificación enviado a ${phoneE164}. ` +
      `Usa "123456" o cualquier código de 6 dígitos para verificar.`,
  );
  return { ok: true };
};

/**
 * MOCK: acepta "123456" o cualquier código de 6 dígitos.
 * En producción llamará a `phone-verify-check`.
 */
export const checkVerificationCode = async (
  phoneE164: string,
  code: string,
): Promise<VerificationResult> => {
  await new Promise((r) => setTimeout(r, 400));
  const normalized = code.trim();
  if (!/^\d{6}$/.test(normalized)) {
    return { ok: false, message: 'El código debe tener 6 dígitos' };
  }
  // Aceptamos cualquier código de 6 dígitos mientras esté en modo demo.
  return { ok: true };
};
