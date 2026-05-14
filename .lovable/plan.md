# Fase 4 — Detalle de Auto y Wizard de Alta/Edición (Admin)

Esta fase amplía `/admin/flota` con dos piezas mayores. Por volumen, propongo dividirla en **dos sub-fases** entregables por separado.

---

## Sub-fase 4A — Página de Detalle de Auto (`/admin/flota/:vehicleId`)

### Layout
- Header: carrusel de fotos (con miniaturas), info básica (marca/modelo/año/placa/VIN), badge de estado actual y rating resumido.
- 7 tabs según especificación.

### Tabs y origen de datos
1. **Información General** — datos del dueño (`profiles` + `owner_applications`), specs (color/combustible/transmisión desde `owner_applications`), ubicación (`vehicles.location`), notas internas.
2. **Tarifas & Financiero** — tarifa diaria (`vehicles.price_per_day`), revenue mensual (agregado de `reservations`), comisión 10%, payout estimado, gráfico de revenue (Recharts ya en uso).
3. **Calendario de Reservas** — vista mensual con bloques por estado, click en día → detalle con acciones (aprobar/rechazar/activar/completar/cancelar) reutilizando el patrón de `AdminReservationsPage`.
4. **Inspecciones & Mantenimiento** — tabla de `vehicle_maintenance` + botones “Programar mantenimiento” y “Solicitar inspección urgente” (crea registro tipo `inspection`).
5. **Calificaciones & Reviews** — promedio, conteo y distribución 1–5★ desde `reviews`, últimos 5 comentarios, destacados con rating ≤ 2.
6. **Documentación & Permisos** — SOAT/permiso/seguro desde `owner_applications` (signed URLs en `owner-documents`), alertas de vencimiento (campo nuevo `documents_meta` opcional, ver más abajo).
7. **Acciones** — editar (link a wizard), cambiar estado, contactar dueño (WhatsApp/email/tel), desactivar permanentemente, exportar reporte PDF/print.

### Cambios de datos
Para soportar vencimientos de documentos sin romper lo existente, agrego columnas opcionales a `vehicles`:
- `vin TEXT`
- `plate TEXT`
- `color TEXT`, `fuel_type TEXT`, `transmission TEXT`, `seats INT`
- `soat_doc_url TEXT`, `soat_expiry DATE`
- `circulation_doc_url TEXT`, `circulation_expiry DATE`
- `insurance_doc_url TEXT`, `insurance_expiry DATE`
- `weekend_price NUMERIC`, `weekly_price NUMERIC`, `monthly_price NUMERIC`
- `zone TEXT`, `gps_lat NUMERIC`, `gps_lng NUMERIC`
- `internal_notes TEXT` (solo admin)

Todos `NULL` por defecto; se rellenan desde `owner_applications` para los autos existentes mediante un backfill.

### Routing
- Añadir `/admin/flota/:vehicleId` en `App.tsx`.
- En `AdminFleetPage`, click en fila → navegar al detalle.

---

## Sub-fase 4B — Wizard “Agregar/Editar Auto” (`/admin/flota/nuevo` y `/admin/flota/:id/editar`)

Wizard de 6 pasos con estado local y validación zod por paso:

1. **Información Básica** — marca, modelo, año, VIN, placa, color, combustible, transmisión, asientos.
2. **Documentación** — upload SOAT, permiso, póliza (bucket `owner-documents`, prefijo `vehicles/{id}/`), fechas de vencimiento, notas.
3. **Ubicación & Disponibilidad** — zona (dropdown Caracas), dirección, GPS (pin en mapa simple — usaremos input lat/lng + Leaflet ligero o por ahora link a Google Maps; dejaré pin con Leaflet si caben créditos), disponibilidad inmediata/1-2 semanas/1 mes, horario.
4. **Tarificación** — diaria, fin de semana, semanal, mensual, comisión (10% calculada), payout estimado.
5. **Fotos** — hasta 20 fotos al bucket `vehicle-photos`, drag&drop reorden, marcar principal.
6. **Revisión & Activación** — resumen + checklist + botón “Activar Auto”.

Reutilizable para edición (precarga datos existentes).

---

## Entregable propuesto ahora

Para que cada cambio sea revisable, **empiezo por Sub-fase 4A** (detalle + migración de columnas + backfill desde `owner_applications`). Cuando lo apruebes, sigo con 4B (wizard).

¿Procedo con 4A?
