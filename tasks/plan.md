# Implementation Plan: TaskBoard

> Spec: [`docs/specs/SPEC.md`](../docs/specs/SPEC.md) (aprobado 2026-10-06). Tareas: [`tasks/todo.md`](todo.md).
> Generado con la skill `planning-and-task-breakdown`.

## Overview

Llevar el repo desde el esqueleto actual (Compose + health probes + maqueta Kanban) hasta la app completa del spec: auth JWT con cookies httpOnly, panel por equipo con escritura autorizada, vista global con polling, migraciones y respaldos, y despliegue en Minikube con probes, HPA y NetworkPolicy. El trabajo va en **cortes verticales**: cada fase deja la app funcionando de punta a punta en Docker Compose; K8s entra cuando la app ya es funcional.

## Architecture Decisions

- **Backend modular** (`app.js` separado de `server.js`) para poder probar la app con `supertest` sin abrir puerto.
- **Migraciones al arrancar el backend** con `pg_advisory_lock`: con 2–6 réplicas solo una aplica cambios; las demás esperan. `init.sql` queda como esquema base; todo cambio posterior va en `db/migrations/NNN_*.sql`.
- **Seed de contraseñas por código, no por SQL:** el runner hashea `SEED_USER_PASSWORD` con bcrypt para usuarios sin `password_hash`. El SQL nunca contiene la contraseña.
- **Endpoints de lectura se crean públicos (Fase 1) y se protegen en Fase 2** — permite ver datos reales antes de tener auth, sin retrabajo (solo se agrega el middleware).
- **NGINX no-root + template** en una sola tarea: ambos tocan Dockerfile y config del frontend.
- **K8s después de que la app funcione en Compose**, salvo que se paralelice (ver abajo).
- **Probes y requests/limits se escriben junto con cada Deployment** (no en tarea aparte) para no tocar los mismos manifiestos dos veces.

## Dependency Graph

```
T1 backend base ──┬── T2 migraciones ── T6 auth API ── T7 login UI
                  │                        │
                  ├── T4 lectura API ── T5 /global UI
                  │                        │
                  │                     T8 panel lectura ── T9 escritura API ── T10 Kanban UI
                  │
T3 NGINX no-root ─┴──────────── T13 deployments ── T14 ingress ── T15 HPA
                  T12 db K8s ───┘                                  T16 netpol
T2 ── T11 backup Compose ── T17 CronJob                            T18 evidencias (todo)
```

## Task List

Detalle (criterios, verificación, archivos) en `tasks/todo.md`.

### Phase 1: Foundation
- T1 Backend modular, errores centralizados, hardening básico, harness de pruebas
- T2 Runner de migraciones + migración 001 (auth, `actualizado_en`, seed de contraseñas)
- T3 Frontend NGINX no-root + template `BACKEND_HOST` + headers de seguridad

### Checkpoint 1
### Phase 2: Lectura (vista global)
- T4 `GET /api/equipos` y `GET /api/tareas/global`
- T5 Router + página `/global` con filtros y polling 15 s

### Phase 3: Autenticación
- T6 Login / refresh / logout + middleware `requireAuth`
- T7 Login UI, cliente API con refresh automático, guardas de ruta

### Checkpoint 2
### Phase 4: Panel de equipo y escritura
- T8 `GET /api/tareas?equipo_id` + Kanban con datos reales
- T9 POST / PATCH / DELETE con autorización por equipo
- T10 Kanban interactivo (crear, editar, reasignar, mover, borrar)

### Checkpoint 3 (app completa en Compose)
### Phase 5: Respaldos
- T11 Scripts `backup.sh` / `restore.sh` para Compose

### Phase 6: Kubernetes
- T12 Namespace, ConfigMap, Secret de ejemplo, StorageClass Retain, Postgres StatefulSet
- T13 Deployments + Services de backend y frontend, script de build de imágenes
- T14 Ingress `taskboard.local`

### Checkpoint 4
### Phase 7: Resiliencia
- T15 HPA + prueba de carga
- T16 NetworkPolicy + verificación con Calico
- T17 CronJob de respaldo
- T18 Evidencias de los 7 criterios de éxito

### Checkpoint Final

## Risks and Mitigations

| Riesgo | Impacto | Mitigación |
|--------|---------|------------|
| Varias réplicas aplican migraciones a la vez | Alto | `pg_advisory_lock` en el runner (T2) |
| Cookie `Secure` no se envía por HTTP en `taskboard.local` | Alto | `COOKIE_SECURE=false` en Compose/Minikube, documentado; `true` solo con HTTPS |
| Imagen backend > 150 MB al sumar deps | Medio | `bcryptjs` (sin binarios nativos); medir en Checkpoint 1 y 3 |
| HPA memoria 75 % de 128 Mi (~96 Mi) escala sin carga | Medio | Medir consumo idle en T15; si >90 Mi, subir request a 160 Mi y registrar desviación |
| Calico + addons consumen mucha RAM en Minikube (Mac) | Medio | `minikube start --cni=calico --memory=6g --cpus=4` |
| Cambios en `init.sql` no llegan a volúmenes existentes | Medio | Regla: nunca editar `init.sql` para cambios nuevos; solo migraciones |
| Refresh token robado | Medio | Rotación + detección de reuso revoca toda la familia (T6) |

## Parallelization Opportunities

- **Hugo (DevOps/DB):** T2, T11, luego T12–T14 en paralelo con Fase 2–4 (se pueden probar con solo `/api/health` y `/api/ready`). Después T15–T17.
- **Francisco (Backend/Frontend):** T1 primero (contrato base), luego T4–T10.
- **Contrato compartido:** las rutas y formas de respuesta de la API (spec §1, RF-1..15) se fijan en T1/T4 antes de paralelizar UI y API.
- **Secuencial obligatorio:** T1 → T2 → T6 (migraciones y auth dependen del esquema).

## Open Questions

Ninguna bloqueante.
