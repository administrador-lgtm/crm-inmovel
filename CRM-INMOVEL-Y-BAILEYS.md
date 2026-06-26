# CRM Inmovel + Baileys — arquitectura y operación

> Documentación de cómo se relacionan el CRM (Supabase) y el listener Baileys, y cómo se opera el CRM en vivo. Verificado 25 jun 2026.

## Qué es el CRM Inmovel
- Fork de **Atomic CRM** sobre **Supabase producción** (proyecto `yvowokyomykvntupibpp`).
- Repo (build): `~/crm-inmovel` (React + Supabase, deploy Railway).
- Operación en vivo desde `~/inmovel` (queries, reportes) — ver `~/inmovel/revops/references/crm-inmovel-operacion.md`.
- Conexión: password en `~/crm-inmovel/.supabase-db-password.txt`. Connection string pooler:
  `postgresql://postgres.yvowokyomykvntupibpp:<pw>@aws-1-us-west-1.pooler.supabase.com:5432/postgres`

## Relación CRM ↔ Baileys (arquitectura de canales)

Filosofía (misma del bot de calificación): **no le pidas al asesor que reporte; observa la fuente de verdad.** La conversación real asesor↔lead ES el reporte; un LLM la interpreta y puebla el CRM solo.

| Capa | Herramienta | Rol |
|---|---|---|
| **Lectura / observar (entrante)** | **Baileys** | Companion device del número de trabajo del asesor. LEE asesor↔lead, un LLM interpreta y **escribe al CRM** (stages, notas). **NUNCA manda nada.** |
| **Escritura / saliente** | **WABA oficial (Cloud API)** | Alertas de handoff, asistente que el asesor consulta, follow-ups. Compliant, sin riesgo de ban, templates. |

**Reglas de la arquitectura (decisión `~/inmovel/producto/output/decision-baileys-listener-crm-2026-06-24.md`):**
- Baileys = **read-only**. Técnicamente el companion PODRÍA escribir en el número, pero **por decisión NO escribe** (riesgo de ban). Auto-responder al lead = fuera de scope ("muy lejos").
- Todo outbound (mandar mensajes) = **WABA oficial**, NO Baileys.
- 1 número de trabajo por asesor; el companion es 1 de los 4 devices multi-device permitidos.
- El listener escribe a `wa_listener.contacts` (schema propio del listener).

## Modelo de datos (tablas clave)
- **`public.contacts`** = el lead (Atomic: el contact ES el lead, no hay "deals"). Campos: `id, nombre, telefono, stage, sales_id, asesor_nombre, desarrollo_activo, first_seen, last_seen, stage_changed_at, …`. **OJO: NO tiene `updated_at`.**
- **`wa_listener.contacts`** = tabla del listener Baileys. **SÍ tiene `updated_at`.** No confundir con public.contacts.
- **`conversaciones`** = transcript. `lead_id`(→contacts.id), `rol`(lead/bot/alerta), `texto`, `timestamp`, `nombre_lead`. Append-only.
- **`contact_notes`** = notas del asesor. `contact_id, text, date, sales_id, status`.
- **`sales`** = asesores. `id, first_name, last_name, email, telefono, whatsapp, activo`.
- **`activity_log`** = solo `contact.created` y `contactNote.created`. **NO loguea asignaciones (`sales_id`).**

## Stages
S1-S10 + descartado (mutuamente excluyentes). `stage_changed_at` = última vez que cambió de stage.
S1 Contacto · S2 En conversación · S3 Perfilando · S4 Handoff ready · S5 Handoff enviado · S6 Asesor aceptó · S7 Visita solicitada · S8 Visita realizada · S9 Negociación · S10 Cierre.

## Asignar un lead a un asesor
`update contacts set sales_id=<id>, asesor_nombre='<nombre>' where id=<id>;` — **NO tocar `stage`** al reasignar.
- **sales_id**: Josafat=1, Ana Laura Vargas=5, Luis Gerardo=6, Luis Antonio Solis=9.

## El log de asignaciones NO está en el CRM
- `activity_log` no registra cambios de `sales_id`. No hay auditoría.
- El registro REAL de "quién se asignó a quién y cuándo" vive en:
  1. **Railway logs del bot** → `[HANDOFF] <nombre> → <asesor> (<tel>)` (`~/inmovel/code/src/lib/handoff.js:209`). Retención corta.
  2. **Chat de WhatsApp de Josafat con el bot** (notificaciones de handoff).

## Bugs de producción (25 jun 2026, vía Railway logs)
- **`cargarAsesorTels` falla en cada mensaje** ("Node.js 20 detected without native WebSocket support") → siempre fallback hardcoded. El refactor de leer asesores de Supabase está **roto en prod** (Node 20 sin WebSocket nativo para el cliente Supabase).
- **Template de handoff falla** ("Param text cannot have new-line/tab characters or more than 4 consecutive spaces") → se manda como texto.
- **Handoffs duplicados** (Alex x4, Luz x2).
- **CRM sync gap**: asignaciones hechas solo en el Google Sheet NO llegan a Supabase → el asesor no las encuentra. Migración en curso a Supabase como fuente única (~1 sem desde 25 jun, luego se apaga el Sheet).
