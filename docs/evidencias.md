# Evidencias de validación

Criterios de éxito del spec (`docs/specs/SPEC.md` §8, derivados de §7.2 del PDF).

| # | Criterio | Entorno | Estado |
|---|----------|---------|--------|
| 1 | Entorno local con un comando, app en `:8080` | Docker Compose | ✅ |
| 2 | Imágenes frontend y backend < 150 MB | Docker | ✅ |
| 3 | Borrar Pod backend no interrumpe el servicio | Minikube | ✅ |
| 4 | Borrar Pod PostgreSQL conserva datos | Minikube | ✅ |
| 5 | HPA escala con carga y desescala sin ella | Minikube | ✅ subida · ⏳ bajada (ver abajo) |
| 6 | Vista global con todos los equipos; modificar tarea ajena → rechazado por el servidor | Docker Compose | ✅ |
| 7 | NetworkPolicy aísla PostgreSQL | Minikube | ✅ |

Criterios 3, 4, 5 y 7 ejecutados el 2026-10-07 en Minikube 1.39 (Kubernetes 1.37, containerd, CNI Calico, addons ingress y metrics-server). Comandos en `docs/despliegue-k8s.md` §7.

---

## Criterio 1 — Entorno local con un comando

Se partió de cero, borrando también el volumen:

```bash
docker compose down -v
docker compose up -d --build
```

Resultado (2026-10-06):

```
listo en 15s
GET / -> 200
{"status":"ready"}
```

El backend aplica las migraciones al arrancar; `/api/ready` responde 503 hasta que terminan.

## Criterio 2 — Tamaño de imágenes

Medido con la suma de capas descomprimidas:

```bash
scripts/image-sizes.sh <backend> <frontend>
```

```
backend:  125.2 MB (límite 150 MB) OK
frontend:  54.4 MB (límite 150 MB) OK
```

- **Backend:** con `node:20-alpine` directo medía 149.6 MB. Se aplanó el runtime sin npm/yarn (DV-15).
- **Docker Desktop:** con el almacén containerd, `docker images` muestra un número mayor porque también suma el contenido comprimido.

## Criterio 6 — Vista global y autorización en servidor

Sesión de `francisco.backend@taskboard.local`, que pertenece al Equipo Backend:

```
GET /api/tareas/global      -> 9 tareas de equipos ['Equipo Backend', 'Equipo DevOps', 'Equipo Frontend']
PATCH /api/tareas/1 (DevOps) -> {"error":"Solo el equipo propietario puede modificar esta tarea"} HTTP 403
```

La suite automatizada cubre este y otros casos:

```bash
docker compose --profile test run --rm backend-test
```

```
# tests 37
# pass 37
# fail 0
```

Qué cubre:
- POST, PATCH y DELETE sobre otro equipo → 403.
- Reasignar a un usuario de otro equipo → 422.
- Sin sesión → 401.
- Rotación del refresh token y detección de reuso.
- Migraciones idempotentes.
- Las contraseñas solo se guardan como hash bcrypt.

En la UI, el tablero de otro equipo (`/equipo/:id`) aparece en modo solo lectura, sin controles de edición.

---

## Despliegue en Minikube

`scripts/k8s-deploy.sh` dejó todos los objetos listos:

```
pod/backend-…   1/1 Running   (×2)
pod/frontend-…  1/1 Running   (×2)
pod/postgres-0  1/1 Running
persistentvolumeclaim/pgdata-postgres-0   Bound   5Gi   RWO   standard-retain
persistentvolumeclaim/db-backups          Bound   2Gi   RWO   standard-retain
```

PV con `RECLAIM POLICY = Retain` (DV-03). Por el Ingress (`Host: taskboard.local`, sin rewrite, DV-01):

```
GET /                 -> 200
GET /api/health       -> {"status":"ok"}
GET /api/ready        -> {"status":"ready"}
POST /api/auth/login  -> 200
GET /api/tareas/global -> 9 tareas
PATCH /api/tareas/1 (equipo ajeno) -> 403 {"error":"Solo el equipo propietario puede modificar esta tarea"}
```

## Criterio 3 — Borrar un Pod del backend

Petición a `/api/health` por el Ingress cada 0.1 s durante 30 s; a los 4 s se borró un Pod del backend:

```
borrando backend-558874fcf-hrt9z
peticiones: 202 | no-200: 0
backend-558874fcf-49zpq   1/1 Running   (recreado)
backend-558874fcf-n7vtc   1/1 Running
```

## Criterio 4 — Borrar el Pod de PostgreSQL

```
POST /api/tareas "Evidencia criterio 4: persistencia" -> creada id 10
kubectl delete pod postgres-0  ->  pod/postgres-0 condition met (reprogramado)
GET /api/tareas/global -> ['Evidencia criterio 4: persistencia']
```

## Criterio 5 — Autoescalado

Consumo en reposo: CPU 5–14m y memoria 16 % de la request por Pod del backend, así que no hay escalado en falso.

Carga sintética (`scripts/load-test.sh 30 240`: 30 workers durante 240 s contra `/api/tareas/global`). Eventos del HPA:

```
SuccessfulRescale  New size: 5; reason: cpu resource utilization (percentage of request) above target
SuccessfulRescale  New size: 6; reason: cpu resource utilization (percentage of request) above target
cpu 118% (118m) / 70%   ·   6 current / 6 desired   ·   ScalingLimited: TooManyReplicas (máximo 6)
```

**Bajada:** al hacer este commit (14:12 UTC) seguían 6 réplicas: la carga terminó ~14:07 y la ventana de estabilización es de 300 s. Se completa en un commit posterior con el evento `SuccessfulRescale` de vuelta a 2.

## Criterio 7 — NetworkPolicy

```
pod sin label app=backend:  db-svc:5432 - no response (exit=2)
desde deploy/backend:       backend -> db-svc:5432 CONECTA
```

## Respaldo programado

```
kubectl -n taskboard create job --from=cronjob/db-backup db-backup-manual
Respaldo creado: /backups/taskboard-20261007-140734.dump
```

El Job lleva la etiqueta `app: db-backup`, que la NetworkPolicy también permite.
