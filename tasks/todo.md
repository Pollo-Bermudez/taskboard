# TaskBoard — Task List

> Plan: [`tasks/plan.md`](plan.md) · Spec: [`docs/specs/SPEC.md`](../docs/specs/SPEC.md)
> Tamaños: S = 1–2 archivos · M = 3–5 archivos. Ninguna tarea L/XL.

---

## Phase 1: Foundation

### - [ ] T1: Backend modular y endurecido (M)
Separar `app.js` de `server.js`, extraer Pool a `db.js`, rutas de salud a `routes/health.js`, middleware de errores centralizado. Hardening: quitar credenciales por defecto (fallar al arrancar si faltan `DB_PASSWORD`/`JWT_SECRET`), `/api/ready` con error genérico (detalle solo a logs), quitar `cors()` abierto, `express.json({ limit: '100kb' })`. Agregar `node:test` + `supertest`.

**Acceptance:**
- [ ] `/api/health` 200 y `/api/ready` 200/503 sin exponer `error.message`
- [ ] Backend sale con código ≠ 0 y mensaje claro si falta `JWT_SECRET` o `DB_PASSWORD`
- [ ] `npm test` corre y pasa prueba de health

**Verify:** `cd backend && npm test` · `docker compose up -d --build backend && curl -fsS localhost:3001/api/ready`
**Deps:** ninguna
**Files:** `backend/src/{server,app,db}.js`, `backend/src/routes/health.js`, `backend/src/middleware/errorHandler.js`, `backend/package.json`, `backend/test/health.test.js`

### - [ ] T2: Migraciones + 001 auth (M)
Runner en `backend/src/migrate.js`: crea `schema_migrations`, toma `pg_advisory_lock`, aplica `db/migrations/*.sql` pendientes en orden, en transacción. Migración `001_auth.sql`: `usuarios.password_hash`, tabla `refresh_tokens (id, usuario_id, token_hash, familia, expira_en, revocado_en, creado_en)`, trigger `actualizado_en`, `UNIQUE (equipos.nombre)`. Tras migrar, hashear `SEED_USER_PASSWORD` (bcrypt 12) en usuarios sin hash. Copiar `db/migrations` a la imagen del backend.

**Acceptance:**
- [ ] Con volumen nuevo y con volumen existente, la BD queda en la misma versión
- [ ] Arrancar 2 backends a la vez no duplica ni falla migraciones
- [ ] Ninguna contraseña en texto plano en SQL ni en logs

**Verify:** `docker compose down -v && docker compose up -d --build` · `docker compose exec db psql -U $DB_USER -d taskboard -c 'select * from schema_migrations'` · `docker compose up -d --scale backend=2` (sin conflicto de puertos: probar con override temporal)
**Deps:** T1
**Files:** `backend/src/migrate.js`, `backend/src/server.js`, `db/migrations/001_auth.sql`, `backend/Dockerfile`, `.env.example`

### - [ ] T3: NGINX no-root + template + headers (M)
`USER nginx`, permisos sobre `/var/cache/nginx`, `/var/run`/pid, `/etc/nginx/conf.d`; escucha 8080. `nginx.conf` → `templates/default.conf.template` con `${BACKEND_HOST}`. Headers `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`. Compose `8080:8080` + `BACKEND_HOST=backend`. Actualizar `AGENTS.md` (puertos 3001 y 8080 interno). (DV-02, DV-07, DV-11)

**Acceptance:**
- [ ] `docker compose exec frontend whoami` → `nginx`
- [ ] `localhost:8080` sirve SPA y `localhost:8080/api/health` responde vía proxy
- [ ] `nginx -t` OK

**Verify:** comandos anteriores + `curl -I localhost:8080` muestra headers
**Deps:** ninguna
**Files:** `frontend/Dockerfile`, `frontend/templates/default.conf.template` (reemplaza `nginx.conf`), `docker-compose.yml`, `AGENTS.md`

## Checkpoint 1: Foundation
- [ ] `docker compose down -v && docker compose up -d --build` limpio
- [ ] `docker images` → frontend y backend < 150 MB
- [ ] `npm test` pasa
- [ ] Revisión humana

---

## Phase 2: Lectura

### - [ ] T4: API de lectura (S)
`GET /api/equipos`; `GET /api/tareas/global` (join con `equipos.nombre`, `color_hex`, `usuarios.nombre` del asignado). Queries parametrizadas. Pruebas.

**Acceptance:**
- [ ] `/api/tareas/global` devuelve tareas de los 3 equipos con nombre de equipo y asignado
- [ ] Pruebas de ambos endpoints pasan

**Verify:** `npm test` · `curl localhost:3001/api/tareas/global | jq length`
**Deps:** T1
**Files:** `backend/src/routes/{equipos,tareas}.js`, `backend/src/app.js`, `backend/test/lectura.test.js`

### - [ ] T5: Router + vista global (M)
`react-router-dom`; rutas `/global`, `/equipo/:id`, `/login` (placeholder). `GlobalPage`: agrupar por equipo, filtros por equipo y estado, polling 15 s (limpiar intervalo al desmontar), solo lectura. Cliente `src/api/client.js` con `credentials: 'include'`. Conservar widget de salud.

**Acceptance:**
- [ ] `/global` muestra datos reales y se refresca cada 15 s (visible en Network)
- [ ] Filtros funcionan; sin controles de edición
- [ ] Recargar `/global` directo no da 404 (fallback SPA)

**Verify:** `npm run build` · navegador en `localhost:8080/global`
**Deps:** T3, T4
**Files:** `frontend/package.json`, `frontend/src/main.jsx`, `frontend/src/App.jsx`, `frontend/src/pages/GlobalPage.jsx`, `frontend/src/api/client.js`

---

## Phase 3: Autenticación

### - [ ] T6: Auth API (M)
`POST /api/auth/login` (bcrypt compare, mensaje genérico ante error), `POST /api/auth/refresh` (rota token; reuso de token revocado → revoca familia), `POST /api/auth/logout`, `GET /api/auth/me`. Cookies httpOnly `SameSite=Strict`, `Secure` = `COOKIE_SECURE`; access 15 min (`Path=/api`), refresh 3 días (`Path=/api/auth`). Middleware `requireAuth` → `req.user = { id, equipo_id, rol }`. Proteger todo `/api` salvo health, ready y auth.

**Acceptance:**
- [ ] Login correcto setea 2 cookies httpOnly; body no contiene tokens
- [ ] Sin cookie → 401 en `/api/tareas/global`; access expirado + refresh válido → refresh funciona
- [ ] Reusar un refresh token ya rotado → 401 y toda la familia revocada

**Verify:** `npm test` (pruebas de los 3 escenarios) · `curl -c jar -d ... /api/auth/login` y `curl -b jar /api/auth/me`
**Deps:** T2, T4
**Files:** `backend/src/routes/auth.js`, `backend/src/middleware/auth.js`, `backend/src/app.js`, `backend/package.json`, `backend/test/auth.test.js`

### - [ ] T7: Login UI (M)
`LoginPage`; contexto de sesión (`/api/auth/me` al cargar); cliente API: ante 401 llama `/api/auth/refresh` una sola vez (sin carreras con varias peticiones simultáneas) y reintenta, si falla → `/login`. Guardas de ruta; botón logout; tras login redirige a `/equipo/{equipo_id}`.

**Acceptance:**
- [ ] Nada de tokens en `localStorage`/`sessionStorage` (verificar en DevTools)
- [ ] Sesión sobrevive recarga y expiración del access token
- [ ] Logout lleva a `/login` y rutas protegidas redirigen

**Verify:** `npm run build` · flujo manual en navegador
**Deps:** T5, T6
**Files:** `frontend/src/pages/LoginPage.jsx`, `frontend/src/auth/AuthContext.jsx`, `frontend/src/api/client.js`, `frontend/src/App.jsx`

## Checkpoint 2: Auth
- [ ] `npm test` pasa · build frontend OK
- [ ] Login → `/global` funcional en Compose
- [ ] Revisión humana

---

## Phase 4: Panel de equipo y escritura

### - [ ] T8: Panel de equipo — lectura (M)
`GET /api/tareas?equipo_id=N` (validar entero). `EquipoPage` con 4 columnas Kanban y datos reales; reemplaza maqueta de `App.jsx`. Endpoint `GET /api/equipos/:id/usuarios` para selector de responsable.

**Acceptance:**
- [ ] `/equipo/2` muestra solo tareas del equipo 2 en sus columnas
- [ ] `equipo_id` inválido → 400

**Verify:** `npm test` · navegador
**Deps:** T7
**Files:** `backend/src/routes/{tareas,equipos}.js`, `backend/test/tareas.test.js`, `frontend/src/pages/EquipoPage.jsx`, `frontend/src/App.jsx`

### - [ ] T9: Escritura con autorización (M)
`POST /api/tareas` (equipo del token = destino, si no 403), `PATCH /api/tareas/:id` (estado, asignado_a, descripcion, titulo, prioridad; propietario o 403; `asignado_a` debe ser del mismo equipo o 422), `DELETE /api/tareas/:id` (propietario o 403). Validación de input (estado ∈ enum, longitudes).

**Acceptance:**
- [ ] PATCH/DELETE sobre tarea de otro equipo → 403 (prueba automatizada — criterio de éxito 6)
- [ ] Reasignar a usuario de otro equipo → 422
- [ ] Inputs inválidos → 400 sin stack trace

**Verify:** `npm test`
**Deps:** T6, T8
**Files:** `backend/src/routes/tareas.js`, `backend/src/validation.js`, `backend/test/tareas-escritura.test.js`

### - [ ] T10: Kanban interactivo (M)
Crear tarea (modal), editar, reasignar (solo usuarios del equipo), cambiar estado (botones o drag & drop nativo), borrar con confirmación. Si `/equipo/:id` ≠ equipo del usuario → modo solo lectura. Errores de API visibles.

**Acceptance:**
- [ ] CRUD completo desde UI en el propio equipo
- [ ] En equipo ajeno no hay controles de edición
- [ ] Error 403/422 se muestra al usuario

**Verify:** `npm run build` · flujo manual
**Deps:** T9
**Files:** `frontend/src/pages/EquipoPage.jsx`, `frontend/src/components/{TaskCard,TaskForm}.jsx`, `frontend/src/index.css`

## Checkpoint 3: App completa en Compose
- [ ] Criterios de éxito 1, 2 y 6 cumplidos
- [ ] `npm test` pasa · imágenes < 150 MB
- [ ] Revisión con `/review` (skill `code-review-and-quality`) + `security-auditor`
- [ ] Revisión humana

---

## Phase 5: Respaldos

### - [ ] T11: Respaldo/restauración en Compose (S)
`scripts/backup.sh` (`docker compose exec -T db pg_dump -Fc` → `backups/taskboard-YYYYmmdd-HHMM.dump`) y `scripts/restore.sh <archivo>`. `backups/` en `.gitignore`.

**Acceptance:**
- [ ] Backup → `down -v` → `up` → restore recupera tareas creadas

**Verify:** ejecutar ese ciclo
**Deps:** T2
**Files:** `scripts/backup.sh`, `scripts/restore.sh`, `.gitignore`

---

## Phase 6: Kubernetes

### - [ ] T12: Base K8s + Postgres (M)
`namespace.yaml`, `configmap.yaml` (`NODE_ENV`, `PORT`, `DB_HOST=db-svc`, `DB_PORT`, `DB_NAME`, `POSTGRES_DB`, `COOKIE_SECURE=false`, `ACCESS_TOKEN_TTL`, `REFRESH_TOKEN_TTL_DAYS`, `BACKEND_HOST=backend-svc`), `secret.example.yaml`, `storageclass.yaml` (`standard-retain`), `db-statefulset.yaml` (OnDelete, PVC 5Gi, env mapeado, probes `sh -c`, recursos 250m/1000m 256Mi/1Gi, `init.sql` vía ConfigMap), `db-service.yaml` headless. `.gitignore`: `k8s/secret.yaml`, `.env.k8s`. (DV-03, DV-04, DV-05)

**Acceptance:**
- [ ] `postgres-0` Running y Ready; PV con `RECLAIM POLICY Retain`
- [ ] Borrar `postgres-0` conserva datos (criterio 4)

**Verify:** `kubectl apply --dry-run=server -f k8s/` · `kubectl -n taskboard get pod,pvc,pv`
**Deps:** T2
**Files:** `k8s/{namespace,configmap,secret.example,storageclass,db-statefulset,db-service}.yaml`, `.gitignore`

### - [ ] T13: Backend + frontend en K8s (M)
`backend-deployment.yaml` (2 réplicas, RollingUpdate 0/1, envFrom, probes Tabla 12, recursos 100m/500m 128Mi/512Mi, `runAsNonRoot`), `backend-service.yaml`; `frontend-deployment.yaml` (2 réplicas, puerto 8080, probes en 8080, recursos 50m/200m 64Mi/128Mi, `runAsNonRoot`), `frontend-service.yaml` (80 → 8080). `scripts/k8s-build.sh` (minikube docker-env + build tags `1.0.0`). `imagePullPolicy: IfNotPresent`. (DV-07, DV-09)

**Acceptance:**
- [ ] 2 pods backend y 2 frontend Ready
- [ ] Borrar un pod backend no interrumpe un loop de `curl` (criterio 3)

**Verify:** `kubectl -n taskboard get pods` · `kubectl port-forward svc/frontend-svc 8080:80`
**Deps:** T3, T12
**Files:** `k8s/{backend-deployment,backend-service,frontend-deployment,frontend-service}.yaml`, `scripts/k8s-build.sh`

### - [ ] T14: Ingress (S)
`ingress.yaml` sin rewrite, `/api` → backend-svc:3000, `/` → frontend-svc:80, host `taskboard.local`. Documentar `/etc/hosts` + `minikube tunnel` en `docs/despliegue-k8s.md`. (DV-01, DV-10)

**Acceptance:**
- [ ] `http://taskboard.local` carga la app, login y CRUD funcionan

**Verify:** `curl -H 'Host: taskboard.local' http://127.0.0.1/api/health`
**Deps:** T13
**Files:** `k8s/ingress.yaml`, `docs/despliegue-k8s.md`

## Checkpoint 4: App en Minikube
- [ ] App completa en `taskboard.local`
- [ ] Criterios 3 y 4 cumplidos
- [ ] Revisión humana

---

## Phase 7: Resiliencia

### - [ ] T15: HPA (S)
`backend-hpa.yaml` (2–6, CPU 70 %, memoria 75 %, scaleDown 300 s). Medir memoria idle del backend antes; ajustar request si hace falta (registrar desviación). Script de carga.

**Acceptance:**
- [ ] Bajo carga réplicas > 2; tras parar, vuelve a 2 después de ≥ 300 s (criterio 5)

**Verify:** `kubectl -n taskboard get hpa -w`
**Deps:** T14
**Files:** `k8s/backend-hpa.yaml`, `scripts/load-test.sh`

### - [ ] T16: NetworkPolicy (S)
`networkpolicy.yaml`: ingreso a `app: postgres` solo desde `app: backend` en 5432. Requiere `minikube start --cni=calico` (documentar). (DV-06)

**Acceptance:**
- [ ] Pod sin label `app: backend` no conecta a `db-svc:5432`; backend sigue Ready (criterio 7)

**Verify:** `kubectl -n taskboard run t --rm -it --image=postgres:16-alpine -- pg_isready -h db-svc` → falla
**Deps:** T12
**Files:** `k8s/networkpolicy.yaml`, `docs/despliegue-k8s.md`

### - [ ] T17: CronJob de respaldo (S)
`db-backup-cronjob.yaml` diario `pg_dump -Fc` a PVC `db-backups` (StorageClass `standard-retain`), retiene últimos 7. Etiqueta `app: backend`-equivalente permitida por NetworkPolicy (agregar regla para `app: db-backup`).

**Acceptance:**
- [ ] `kubectl create job --from=cronjob/db-backup manual` genera dump en el PVC

**Verify:** logs del job + listar archivos del PVC
**Deps:** T12, T16
**Files:** `k8s/db-backup-cronjob.yaml`, `k8s/networkpolicy.yaml`

### - [ ] T18: Evidencias (M)
`docs/evidencias.md` con comando, salida y captura de cada criterio de éxito (1–7) y del registro de desviaciones.

**Acceptance:**
- [ ] Los 7 criterios documentados con evidencia reproducible

**Verify:** revisión humana
**Deps:** T15, T16, T17
**Files:** `docs/evidencias.md`, `docs/evidencias/*.png`

## Checkpoint Final
- [ ] Criterios 1–7 cumplidos y documentados
- [ ] `/review` + `security-auditor` sin hallazgos críticos
- [ ] Spec actualizado con desviaciones surgidas durante la implementación
- [ ] Listo para entrega
