## Objetivo

Construir un sistema legal y modular para recolectar datos de uso de la plataforma RuedaVe, organizado en 4 categorías monetizables. Todo se basa en **consentimientos granulares opt-in** alineados con la LOPDP venezolana, ya documentada en `/politica-privacidad`.

## Alcance del cambio

### 1. Esquema de base de datos (1 migración)

Nuevas tablas:

- **`user_data_consents`** — un registro por usuario y por tipo de consentimiento, con timestamp de aceptación/revocación e IP.
  - Tipos: `telemetry`, `dynamic_pricing`, `fraud_prevention`, `ai_training`
  - Permite revocar en cualquier momento (derecho LOPDP)

- **`telemetry_events`** — eventos crudos del móvil durante una reserva activa.
  - Campos: `reservation_id`, `event_type` (harsh_brake, speeding, night_drive, phone_use, trip_segment), `value` numérico, `lat`/`lng` redondeados, `recorded_at`
  - Solo se inserta si el usuario tiene consentimiento `telemetry` activo

- **`trip_summaries`** — resumen agregado por viaje (km, velocidad media, score de riesgo 0-100, eventos contados). Pensado para aseguradoras.

- **`demand_signals`** — agregado horario por zona (vista materializada o tabla incremental) con búsquedas, reservas, ocupación. Alimenta pricing dinámico.

- **`fraud_signals`** — huella digital por sesión de registro/login: `user_id`, `device_fingerprint_hash`, `ip_hash`, `geo_country`, `signal_type` (multi_account, cancel_pattern, identity_mismatch, dispute), `risk_score`.

- **`ai_training_datasets`** — registro de exports anonimizados (no almacena PII): nombre, descripción, filas, hash, fecha.

Funciones SECURITY DEFINER:
- `has_consent(_user_id, _consent_type)` — usada por RLS y triggers
- `compute_trip_risk_score(_reservation_id)` — al cerrar viaje
- `record_consent(_type, _granted, _ip)` — endpoint canónico para grabar/revocar

RLS:
- Usuario ve y revoca sus propios consentimientos
- Usuario ve sus propios eventos y resúmenes de viaje
- Admin ve todo
- Aseguradoras (rol futuro) ven solo `trip_summaries` agregados, nunca eventos crudos

### 2. UI — Pantalla de consentimientos (`/perfil/privacidad`)

Página nueva con 4 tarjetas (una por categoría) — cada una con:
- Descripción en lenguaje claro
- Tabla de datos recolectados (igual a la del brief)
- Para qué se usan, con quién se comparten
- Toggle ON/OFF (revocable)
- Fecha de aceptación / última actualización

El toggle llama `record_consent` y refresca el estado.

### 3. UI — Banner de consentimiento de IA

Modal/banner que aparece una vez después del primer viaje completado, con el texto exacto del brief:
> "¿Autoriza a RuedaVe a utilizar sus datos de viaje anonimizados para mejorar la seguridad vial, la planificación urbana y el desarrollo de productos de movilidad? Sus datos nunca serán vendidos de forma identificable."

Botones: **Autorizar** / **Ahora no** / **Ver detalles** (lleva a `/perfil/privacidad`).

### 4. UI — Captura de telemetría móvil

Hook `useTripTelemetry(reservationId)` que se activa solo durante una reserva `active` y solo si hay consentimiento `telemetry`:
- Usa `navigator.geolocation.watchPosition` (GPS + velocidad)
- Usa `DeviceMotionEvent` (acelerómetro → frenado brusco)
- Usa visibilidad de pantalla + eventos touch para "uso de teléfono"
- Hace batch a `telemetry_events` cada 60s
- Banner persistente "Telemetría activa" con botón para pausar

Disponible solo en la pantalla de viaje activo (no en background — limitación de la web). Se documenta como "captura en primer plano".

### 5. Panel admin — Datos y Monetización

Nueva pestaña en `AdminAnalyticsPage` (o página `/admin/datos`) con:
- KPIs: % usuarios con cada consentimiento, eventos capturados por día, viajes con score de riesgo
- Tabla de `trip_summaries` exportable a CSV (con guard anti-formula-injection que ya existe)
- Mapa de calor de `demand_signals` por zona/hora
- Lista de `fraud_signals` con score y acciones (marcar revisado, bloquear cuenta)
- Botón "Generar dataset anonimizado para IA" → crea registro en `ai_training_datasets`

### 6. Actualización legal

Añadir sección a `PrivacyPage.tsx`:
- **17. Datos opcionales y monetización** — describe las 4 categorías, derecho a revocar, garantía de anonimización para terceros, prohibición de venta identificable.

### 7. Huella de fraude (registro/login)

En `useAuth` y formulario de registro: calcular `device_fingerprint_hash` (canvas + user-agent + zona horaria → SHA-256) e insertar en `fraud_signals` si:
- Mismo fingerprint con > 1 `user_id`
- Mismo IP con > 3 cuentas en 24h
Trigger en backend evalúa y asigna `risk_score`.

## Resumen técnico

- Frontend: React + nuevos hooks (`useTripTelemetry`, `useConsents`, `useFraudFingerprint`), nuevas páginas (`PrivacySettingsPage`, ampliación de `AdminAnalyticsPage`), nuevo componente `AIConsentBanner`.
- Backend: 1 migración con 5 tablas, 3 funciones, RLS estricta. Sin edge functions nuevas (todo via PostgREST).
- Seguridad: consentimientos granulares revocables, hashing de IP/device, anonimización de coordenadas (3 decimales ≈ 100m), RLS impide acceso cruzado.
- Sin proveedores externos por ahora; preparado para integrar con aseguradoras vía export de `trip_summaries`.

## Lo que NO incluye este plan

- App móvil nativa (la telemetría web es en primer plano solamente).
- Integración real con aseguradoras o ad-networks (solo dejamos el dataset listo).
- Pricing dinámico automático sobre `vehicles.price_per_day` — solo capturamos señales; el algoritmo de ajuste lo decides después.

¿Avanzo con esta implementación, o ajustas el alcance (p. ej. dejar telemetría móvil para una fase 2)?
