# Fase 5 — Reservas & Calendario (Admin)

Mejora `/admin/reservas` y agrega `/admin/reservas/:id` para gestión profesional.

---

## Sub-fase 5A — Calendario y Listado mejorados (`/admin/reservas`)

### Header
- Selector mes/año + flechas.
- Toggle de vista: **Mes / Semana / Día**.
- Filtros: por auto (autocomplete), por zona (Caracas), por estado.
- Búsqueda rápida por ID corto de reserva o nombre del rentador.
- KPIs (mantener los actuales por estado).

### Vista Calendario
- **Mes**: grid 7 columnas con bloques de color por estado (verde=aprobada/activa, amarillo=pendiente, rojo=cancelada/rechazada, azul=mantenimiento del auto), hover muestra tooltip con rentador/auto/precio, click abre detalle.
- **Semana**: filas = días, columna por reserva con barra horizontal según duración.
- **Día**: lista cronológica de reservas activas ese día.
- Leyenda de colores siempre visible.

### Listado (tab "Lista")
Columnas: ID corto, Rentador (nombre+tel), Auto (modelo + thumbnail), Fechas (rango+días), Tarifa diaria, Total, Estado (badge), Última actualización, Acciones (Ver, Confirmar, Cancelar, Contactar).

Filtros: estado, fecha (esta semana/este mes/próximos 30/personalizado), auto, rentador, rango de precio.

Acciones masivas: seleccionar múltiples → Confirmar lote, Enviar recordatorio (notificación), Exportar CSV.

---

## Sub-fase 5B — Detalle de Reserva (`/admin/reservas/:id`)

Página con:
- **Header**: ID, badge de estado, timeline visual (Creada → Aprobada → Activa → Completada), fecha de creación.
- **Rentador**: nombre, tel, rating promedio, # reservas previas, link al perfil admin.
- **Auto**: foto, marca/modelo/año/placa, link al detalle de flota.
- **Fechas & duración**: inicio/fin, total días, botones extender/acortar (modal con fechas).
- **Financiero**: tarifa diaria, días, subtotal, seguro ($8/día), depósito (info), total, comisión 10%, payout estimado, estado de pago (`payments`).
- **Documentos**: lista de archivos asociados (placeholder si no existen).
- **Historial de cambios**: timeline desde un nuevo log table.
- **Acciones**: Confirmar, Cancelar (modal con política de reembolso), Extender, Recordatorio, Contactar rentador (WA/email), Contactar dueño, Marcar completada.

### Modal de Cancelación
- Motivo (dropdown), notas, cálculo automático de reembolso según horas hasta inicio (<24h: 0%, 24–48h: 50%, >48h: 100%), monto sugerido editable, confirmar.
- Registra en `reservation_events` y actualiza `reservations.status='cancelled'` con metadatos.

---

## Cambios en BD

Tablas nuevas:
- `reservation_events`: id, reservation_id, type ('created'|'approved'|'rejected'|'activated'|'completed'|'cancelled'|'note'|'reminder_sent'|'extended'), actor_id, message, metadata jsonb, created_at. RLS: admins manage; participantes (renter/owner) view.

Columnas opcionales en `reservations`:
- `cancellation_reason TEXT`
- `refund_percent INT`
- `refund_amount NUMERIC`
- `cancelled_at TIMESTAMPTZ`
- `cancelled_by UUID`

Trigger: al insertar/actualizar status, auto-loggear en `reservation_events`.

---

## Entregable propuesto

Empiezo por **5A** (calendario mes/semana/día + listado mejorado + filtros + bulk). Cuando lo apruebes, sigo con 5B (detalle + cancelación + eventos + migración).

¿Procedo con 5A?
