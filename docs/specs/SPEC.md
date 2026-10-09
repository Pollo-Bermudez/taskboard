# Spec: TaskBoard — Sistema de Control de Tareas para Equipos

> Fuente: `TaskBoard_Propuesta.pdf` (25 ago 2026, 21 págs.). Analizado con las skills
> `spec-driven-development`, `security-and-hardening`, `planning-and-task-breakdown`
> y `context-engineering` de [addyosmani/agent-skills](https://github.com/addyosmani/agent-skills).
> **Estado: APROBADO (2026-10-06).** Plan en `tasks/plan.md`, tareas en `tasks/todo.md`.

---

## 0. Scope Check (Fase 0)

El requerimiento agrupa varias capacidades probables de forma independiente. Mapa de capacidades:

| # | Capacidad | Capa(s) | Verificable de forma aislada por |
|---|-----------|---------|-----------------------------------|
| C1 | Modelo de datos + seeds | db | `psql` sobre contenedor limpio |
| C2 | Autenticación (JWT) | backend, frontend | login devuelve token; request sin token → 401 |
| C3 | Lectura de tareas (equipo y global) | backend, frontend | `GET /api/tareas?equipo_id=` y `/api/tareas/global` |
| C4 | Escritura con autorización por equipo | backend, frontend | `PATCH` sobre tarea ajena → 403 |
| C5 | UI: Panel Kanban `/equipo/:id` + Vista global `/global` (polling 15 s) | frontend | navegador en `:8080` |
| C6 | Entorno local Docker Compose | todas | `docker compose up -d` + `:8080` responde |
| C7 | Despliegue K8s (Minikube) | k8s | `kubectl get all -n taskboard` todo Ready |
| C8 | Resiliencia y autoescalado | k8s | borrar pods / carga sintética / HPA |

---

## 1. Objective

**Qué:** aplicación web de tres capas donde cada equipo administra su propio tablero Kanban (escritura exclusiva) y todos ven en solo lectura las tareas de todos los equipos (vista global).

**Por qué:** eliminar fragmentación de información entre equipos (duplicidad de esfuerzo, dependencias detectadas tarde, falta de visión consolidada).

**Usuarios:** miembros de equipos de desarrollo (escriben en su equipo) y coordinación técnica (consulta la vista global).

**Objetivo académico (peso real de la calificación):** demostrar multi-stage builds, Compose con segmentación de redes, orquestación en Minikube (Deployments, StatefulSet, Services, Ingress), ConfigMap/Secret, probes, HPA.

### Requisitos funcionales

| ID | Requisito | Fuente PDF |
|----|-----------|------------|
| RF-1 | `GET /api/health` → 200 si el proceso responde (liveness) | §2.1.2 |
| RF-2 | `GET /api/ready` → 200 solo si hay conexión a PostgreSQL (readiness) | §2.1.2 |
| RF-3 | `GET /api/equipos` → catálogo de equipos | §2.1.2 |
| RF-4 | `GET /api/tareas?equipo_id=N` → tareas del equipo | §2.1.2 |
| RF-5 | `GET /api/tareas/global` → todas las tareas, solo lectura | §2.1.2 |
| RF-6 | `POST /api/tareas` → valida `token.equipo_id === body.equipo_id` | §2.1.2 |
| RF-7 | `PATCH /api/tareas/:id` → estado, responsable, descripción; solo equipo propietario | §2.1.2 |
| RF-8 | `DELETE /api/tareas/:id` → solo equipo propietario | §2.1.2 |
| RF-9 | Sesión stateless con JWT firmado con `JWT_SECRET` | §2.1.2, §5.3 |
| RF-10 | Panel `/equipo/:id`: Kanban 4 columnas (pendiente, en_progreso, en_revision, completada); crear, editar, reasignar, cambiar estado | §2.1.1 |
| RF-11 | Vista `/global`: solo lectura, agrupable y filtrable por equipo y estado, polling cada 15 s | §2.1.1 |
| RF-12 | `POST /api/auth/login` (correo + contraseña) → emite access + refresh token en cookies httpOnly | Decisión P1 |
| RF-13 | `POST /api/auth/refresh` → rota refresh token y emite nuevo access token | Decisión P1 |
| RF-14 | `POST /api/auth/logout` → revoca refresh token y borra cookies | Decisión P1 |
| RF-15 | Reasignación (`asignado_a`) solo a usuarios del mismo equipo de la tarea → si no, 422 | Decisión P5 |

### Modelo de autenticación (decisiones P1/P2)

Modelo inspirado en OAuth 2.0 (access token + refresh token), sin proveedor externo:

| Elemento | Valor |
|----------|-------|
| Access token | JWT HS256 firmado con `JWT_SECRET`; claims `sub` (usuario), `equipo_id`, `rol`; vida corta **15 min** |
| Refresh token | Valor aleatorio opaco (32 bytes); vida **3 días**; se guarda en BD solo su **hash** (tabla `refresh_tokens`), con rotación en cada uso y revocación en logout |
| Transporte | Ambos en cookies `httpOnly`, `SameSite=Strict`, `Secure` controlado por env `COOKIE_SECURE` (true detrás de HTTPS), `Path=/api` (refresh: `Path=/api/auth`) |
| Nunca | Token en `localStorage`/`sessionStorage` ni en el body de respuestas |
| Contraseñas | `usuarios.password_hash` con bcrypt (≥12 rondas) — librería `bcryptjs` (JS puro, sin compilación nativa en Alpine) |
| CSRF | Mitigado por `SameSite=Strict` + mismo origen (frontend y `/api` bajo el mismo host vía proxy/Ingress) |
| Reuso de refresh token revocado | Se revocan todos los refresh tokens del usuario (detección de robo) |
| Frontend | `fetch(..., { credentials: 'include' })`; ante 401 llama a `/api/auth/refresh` una vez y reintenta; si falla → `/login` |

> Supuesto: "duración de 3 días" se aplica al **refresh token**; el access token es corto para limitar el daño si se filtra. Si prefieres access de 3 días, se ajusta solo `ACCESS_TOKEN_TTL`.

Variables nuevas: `JWT_SECRET` (Secret), `ACCESS_TOKEN_TTL=15m`, `REFRESH_TOKEN_TTL_DAYS=3`, `COOKIE_SECURE` (ConfigMap).

### Requisitos no funcionales (infra)

| ID | Requisito | Fuente |
|----|-----------|--------|
| RNF-1 | Multi-stage: frontend `node:20-alpine` → `nginx:1.27-alpine`; backend `node:20-alpine` ×2, usuario no-root | §3.1 |
| RNF-2 | Imágenes finales frontend y backend < 150 MB | §7.2 |
| RNF-3 | Compose: `red-publica` (frontend, backend), `red-interna` `internal: true` (backend, db); db sin puerto publicado | §3.3 |
| RNF-4 | Volumen nombrado `pgdata` → `/var/lib/postgresql/data`; `init.sql` en `/docker-entrypoint-initdb.d/` | §3.2 |
| RNF-5 | Namespace `taskboard`; frontend Deployment 2 réplicas fijas; backend Deployment 2 + HPA 2–6; db StatefulSet 1 | §4.1 |
| RNF-6 | RollingUpdate `maxUnavailable: 0, maxSurge: 1` (Deployments); `OnDelete` (StatefulSet) | §4.1 |
| RNF-7 | PVC `ReadWriteOnce`, 5Gi, `standard`, `reclaimPolicy: Retain` | §4.2 |
| RNF-8 | Services ClusterIP: `frontend-svc:80`, `backend-svc:3000`, `db-svc:5432` headless | §4.3 |
| RNF-9 | Ingress NGINX host `taskboard.local`: `/` → frontend, `/api` → backend | §4.3 |
| RNF-10 | NetworkPolicy: ingreso a postgres solo desde `app: backend` | §4.3, §5.3 |
| RNF-11 | ConfigMap `app-config` + Secret `db-credentials` vía `envFrom`; Secret creado con `kubectl create secret`, solo `secret.example.yaml` versionado | §5 |
| RNF-12 | Probes según Tabla 12; `failureThreshold` 3 (liveness) / 2 (readiness) | §6.1 |
| RNF-13 | Requests/limits según Tabla 13 | §6.2 |
| RNF-14 | HPA: CPU 70 %, memoria 75 %, scaleDown stabilization 300 s; requiere `metrics-server` | §6.3 |

---

## 2. Tech Stack

React 18 + Vite 5 · NGINX 1.27 · Node.js 20 + Express 4 + `pg` · PostgreSQL 16 · Docker Compose · Minikube (addons `ingress`, `metrics-server`).

Dependencias nuevas previstas: `jsonwebtoken`, `bcryptjs`, `cookie-parser` (backend, aprobadas implícitamente por decisión P1); `react-router-dom` (frontend) y `supertest` (dev) — pendientes de confirmar en el plan.

**Puertos (decisión P4):** el puerto 3000 del host está ocupado por otro contenedor Docker, así que se mantiene `3001:3000` para el backend (el contenedor sigue escuchando en 3000; en K8s no cambia nada). Se actualizará `AGENTS.md` para reflejarlo.

## 3. Commands

```
Local:     cp .env.example .env && docker compose up -d --build
Validar:   docker compose config
Logs:      docker compose logs -f backend
Tamaño:    docker images | grep taskboard
NGINX:     docker compose exec frontend nginx -t
Reset BD:  docker compose down -v          # borra pgdata (destructivo)

Minikube:  minikube start --cni=calico     # calico necesario para que NetworkPolicy se aplique
           minikube addons enable ingress
           minikube addons enable metrics-server
           eval $(minikube docker-env) && docker build -t taskboard/backend:1.0.0 ./backend && docker build -t taskboard/frontend:1.0.0 ./frontend
K8s:       kubectl apply -f k8s/namespace.yaml
           kubectl -n taskboard create secret generic db-credentials --from-env-file=.env.k8s
           kubectl apply -f k8s/
Carga HPA: kubectl -n taskboard run load --rm -it --image=busybox -- sh -c 'while true; do wget -qO- http://backend-svc:3000/api/tareas/global >/dev/null; done'
Observar:  kubectl -n taskboard get hpa -w
```

## 4. Project Structure

```
frontend/         React + Vite + Dockerfile multi-stage + nginx.conf
  src/pages/      EquipoPage.jsx (/equipo/:id), GlobalPage.jsx (/global), LoginPage.jsx
  src/api/        cliente fetch hacia /api
backend/
  src/server.js   punto de entrada (solo arranque)
  src/app.js      app Express (exportada para tests)
  src/db.js       Pool pg
  src/routes/     equipos.js, tareas.js, auth.js, health.js
  src/middleware/ auth.js (verifica JWT), errorHandler.js
  test/           pruebas de API (node:test + supertest)
db/init.sql       DDL idempotente + seeds
k8s/              12 manifiestos (ver §7.1 del PDF)
docs/specs/       este spec + specs por módulo
tasks/            plan.md, todo.md (tras aprobación)
```

## 5. Code Style

CommonJS en backend (coincide con `package.json` actual), ES Modules en frontend. Queries **siempre parametrizadas**. Autorización en el servidor, nunca solo en UI:

```js
// backend/src/routes/tareas.js
router.patch('/:id', requireAuth, async (req, res, next) => {
  try {
    const { rows } = await pool.query('SELECT equipo_id FROM tareas WHERE id = $1', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Tarea no encontrada' });
    if (rows[0].equipo_id !== req.user.equipo_id) return res.status(403).json({ error: 'Sin permiso sobre esta tarea' });
    // ...UPDATE ... SET actualizado_en = NOW() ...
  } catch (err) { next(err); }
});
```

## 6. Testing Strategy

No existen pruebas hoy. Propuesta mínima, proporcional al proyecto:

| Nivel | Qué | Herramienta |
|-------|-----|-------------|
| API (integración) | authz: tarea ajena → 403; sin token → 401; global devuelve todos los equipos | `node:test` + `supertest` contra Postgres de Compose |
| Infra estática | `docker compose config`, `nginx -t`, `kubectl apply --dry-run=server -f k8s/` | CLI |
| Criterios §7.2 | 6 escenarios de validación → evidencias (capturas/logs) | manual, guion en `docs/evidencias.md` |

## 7. Boundaries

- **Always:** queries parametrizadas; validar input en rutas; authz por `equipo_id` del token; secretos solo vía env; `docker compose config` antes de commit; inspeccionar solo los archivos del componente en curso (<2 000 líneas).
- **Ask first:** cambios de esquema DB; nuevas dependencias npm; cambios en CORS; cambios de puertos publicados; cualquier desviación respecto al PDF.
- **Never:** commitear `.env` o `k8s/secret.yaml`; exponer puerto de PostgreSQL; devolver `error.message`/stack al cliente; guardar contraseñas en texto plano.

## 8. Success Criteria (de §7.2, reformulados como pruebas)

1. `docker compose up -d --build` en clon limpio → `curl -fsS localhost:8080` 200 y `curl -fsS localhost:8080/api/ready` 200.
2. `docker images` → `taskboard-frontend` y `taskboard-backend` < 150 MB cada una.
3. `kubectl delete pod -l app=backend --wait=false` mientras corre un loop de `curl` a `/api/health` → 0 respuestas fallidas; nuevo pod Ready en < 60 s.
4. Crear tarea → `kubectl delete pod postgres-0` → pod reprogramado → la tarea sigue existiendo.
5. Carga sintética sobre `/api/tareas/global` → `kubectl get hpa` muestra réplicas > 2; al detener carga, vuelve a 2 tras ≥ 300 s.
6. `/global` lista tareas de los 3 equipos; `PATCH /api/tareas/:id` con token de otro equipo → **403** desde el servidor.
7. (adicional, NetworkPolicy) `kubectl run` con label distinto a `app: backend` no puede conectar a `db-svc:5432`.

---

## 9. Análisis de brechas: repo actual vs. PDF

| Área | Estado | Detalle |
|------|--------|---------|
| `db/init.sql` | ✅ casi completo | Esquema coincide con §2.1.3. Faltan: columna de contraseña/credencial en `usuarios` (ver P1); trigger o lógica para `actualizado_en`; `ON CONFLICT DO NOTHING` en `equipos`/`tareas` no tiene constraint único que lo respalde (inofensivo porque init solo corre una vez, pero no es idempotente real). |
| Backend Dockerfile | ✅ | Coincide con §3.1.2. |
| Backend API | ⚠️ 2/8 endpoints | Solo `/api/health` y `/api/ready`. Faltan equipos, tareas (CRUD), JWT, middleware de errores centralizado, estructura modular. |
| Frontend Dockerfile | ✅ | Coincide con §3.1.1. |
| Frontend app | ⚠️ maqueta | `App.jsx` con datos mock + widget de salud. Faltan rutas `/equipo/:id`, `/global`, login, consumo real de API, polling 15 s. |
| `docker-compose.yml` | ⚠️ | Backend publicado en `3001:3000`, PDF y AGENTS.md dicen `3000:3000` (ver P4). Resto conforme. |
| `.env.example` | ✅ | Presente, valores plantilla. |
| `k8s/` | ❌ no existe | 12 manifiestos por crear. |
| Pruebas | ❌ | Ninguna. |
| Evidencias §7.2 | ❌ | Ninguna. |

## 10. Defectos detectados en el propio diseño del PDF

Estos fallarían si se implementan tal cual. Se proponen correcciones; confirmar antes de aplicarlas.

| # | Problema | Impacto | Corrección propuesta |
|---|----------|---------|----------------------|
| D1 | **Ingress** `path: /api/(.*)` + `rewrite-target: /$1` elimina el prefijo: el backend recibe `/tareas` pero sus rutas son `/api/tareas`. Además, rutas regex requieren `pathType: ImplementationSpecific` y `use-regex: "true"`. | Toda la API devuelve 404 en K8s. | Quitar rewrite; `path: /api` → backend-svc y `path: /` → frontend-svc, ambos `pathType: Prefix`. |
| D2 | `nginx.conf` del frontend hace `proxy_pass http://backend:3000`. En K8s el Service se llama `backend-svc`; NGINX **no arranca** si el host del upstream no resuelve. | Pods frontend en CrashLoopBackOff. | Usar `/etc/nginx/templates/default.conf.template` (envsubst nativo de la imagen oficial) con `${BACKEND_HOST}`: `backend` en Compose, `backend-svc` en K8s. |
| D3 | `reclaimPolicy: Retain` se asigna a la StorageClass `standard`, pero la de Minikube es `Delete` y es inmutable. | El requisito no se cumple. | Crear StorageClass propia `standard-retain` (provisioner `k8s.io/minikube-hostpath`, `reclaimPolicy: Retain`) o parchear el PV tras crearlo. |
| D4 | Postgres espera `POSTGRES_USER/POSTGRES_PASSWORD/POSTGRES_DB`; el Secret/ConfigMap usan `DB_USER/DB_PASSWORD/DB_NAME`. `envFrom` no los mapea. | Postgres no inicializa. | En el StatefulSet usar `env` con `valueFrom.secretKeyRef`/`configMapKeyRef` para renombrar. |
| D5 | Probes de db usan `pg_isready -U $DB_USER`; en ese contenedor la variable es `POSTGRES_USER` y `exec` no expande variables sin shell. | Probe siempre falla → reinicios. | `exec: ["sh","-c","pg_isready -U \"$POSTGRES_USER\" -d \"$POSTGRES_DB\""]`. |
| D6 | NetworkPolicy no se aplica con el CNI por defecto de Minikube. | El criterio 7 pasa en papel pero no en la práctica. | `minikube start --cni=calico`. |
| D7 | §5.3: "frontend se ejecuta con usuario sin privilegios", pero el Dockerfile del frontend del PDF corre NGINX como root (puerto 80). | Incumple su propia medida de seguridad. | Ver P3. |
| D8 | `API_BASE_URL` como ConfigMap del frontend: Vite incrusta variables en build; un env en runtime no tiene efecto en el bundle estático. | Variable sin efecto. | Mantener `/api` relativo (ya funciona por Ingress/proxy) y documentar que la variable es informativa, o inyectarla vía `env.js` generado al arrancar NGINX. |
| D9 | Imágenes en Minikube: el PDF no indica cómo llegan `taskboard/*:1.0.0` al cluster. | `ErrImagePull`. | `eval $(minikube docker-env)` antes de build + `imagePullPolicy: IfNotPresent`. |
| D10 | Host `taskboard.local` con driver docker en macOS no es accesible directamente. | Ingress inaccesible. | `/etc/hosts` → `127.0.0.1 taskboard.local` + `minikube tunnel`. |

## 11. Modelo de amenazas (STRIDE, skill `security-and-hardening`)

| Frontera | Amenaza | Estado actual | Mitigación |
|----------|---------|---------------|------------|
| Navegador → API | **E**levation: modificar tarea de otro equipo (IDOR) | No hay endpoints aún | Authz por `equipo_id` del JWT en PATCH/DELETE/POST (RF-6..8) + prueba automatizada |
| Navegador → API | **S**poofing: login sin contraseña | `usuarios` sin credencial | Ver P1 |
| API → cliente | **I**nfo disclosure | `/api/ready` devuelve `error.message` de pg | Respuesta genérica; detalle solo a logs |
| API | Misconfiguración | `cors()` abierto a `*` | Same-origin vía proxy/Ingress → CORS innecesario; restringir o quitar |
| API | **T**ampering: SQL injection | n/a | `pool.query(sql, params)` siempre |
| API | **D**oS | sin límite de body | `express.json({ limit: '100kb' })`; HPA absorbe picos |
| Código | Secretos | `server.js` tiene contraseñas por defecto (`'taskboard_pass'`) | Eliminar defaults de credenciales; fallar al arrancar si falta `DB_PASSWORD`/`JWT_SECRET` |
| Repo | Secretos | `.env` ignorado ✅ | Añadir `k8s/secret.yaml` y `.env.k8s` a `.gitignore` |
| Frontend | Token en `localStorage` | n/a | Skill lo desaconseja; para alcance académico aceptable si se documenta, alternativa: cookie httpOnly. Ver P2 |
| Headers | sin cabeceras de seguridad | — | `X-Content-Type-Options`, `X-Frame-Options` en NGINX (sin agregar `helmet` salvo aprobación) |

## 12. Recomendación de plan (para fase 2, tras aprobación)

El PDF (Tabla 15) ordena el trabajo **horizontalmente** (DB → API → UI → Docker → K8s). La skill `planning-and-task-breakdown` recomienda **cortes verticales** para tener algo funcionando de punta a punta en cada paso y detectar defectos de integración (como D1/D2) pronto:

1. **Slice 0 – Infra base** ya existe (Compose + health). Corregir D2 (template NGINX) y P4 (puerto).
2. **Slice 1 – Vista global de lectura**: `GET /api/equipos`, `GET /api/tareas/global` + `/global` con polling. *Checkpoint: criterio 1.*
3. **Slice 2 – Auth**: login + JWT + middleware. 
4. **Slice 3 – Panel de equipo**: `GET /api/tareas?equipo_id` + Kanban real.
5. **Slice 4 – Escritura con authz**: POST/PATCH/DELETE + prueba 403. *Checkpoint: criterios 2 y 6.*
6. **Slice 5 – K8s mínimo**: namespace, configmap, secret, db StatefulSet+svc, backend, frontend, ingress (con D1, D3–D5, D9, D10). *Checkpoint: app en `taskboard.local`.*
7. **Slice 6 – Resiliencia**: probes, requests/limits, HPA, NetworkPolicy (D6). *Checkpoint: criterios 3, 4, 5, 7 + evidencias.*

Paralelizable: Hugo (DevOps/DB) puede adelantar Slice 5 con la API actual de health mientras Francisco hace Slices 1–4.

---

## Decisiones tomadas (2026-10-06)

| # | Decisión |
|---|----------|
| P1 | Login correo + contraseña; JWT access (15 min) + refresh token (3 días) rotativo, hash en BD. Ver "Modelo de autenticación". |
| P2 | Tokens solo en cookies `httpOnly`; nunca en `localStorage`. |
| P4 | Backend `3001:3000` (3000 ocupado en el host). Frontend `8080`. |
| P5 | Reasignar solo a usuarios del mismo equipo (validado en servidor, 422 si no). |
| P6 | **Incluido, alcance mínimo.** El PDF asigna "respaldos y migraciones" al rol Database Admin (Tabla 1). Además el modelo de auth agrega `password_hash` y `refresh_tokens`: `init.sql` solo corre con volumen vacío, así que sin migraciones cualquier BD ya creada queda desactualizada. Entregables: `db/migrations/NNN_descripcion.sql` + tabla `schema_migrations` aplicadas al arrancar el backend; respaldo con script `pg_dump` (Compose) y `CronJob` diario en K8s hacia un PVC propio. |
| P3 | **Opción B:** NGINX sin root (`USER nginx`, escucha 8080 en el contenedor; Compose `8080:8080`; `frontend-svc` port 80 → targetPort 8080; `runAsNonRoot: true`). |
| P7 | Correcciones D1–D10 aprobadas. Ver "Registro de desviaciones". |
| P8 | Contraseña común de desarrollo para usuarios seed, definida en `.env` (`SEED_USER_PASSWORD`, plantilla en `.env.example`) y aplicada como hash bcrypt por la migración/seed; nunca en texto plano en SQL ni en producción. |
| Proceso | El PDF es guía, no contrato. Cada desviación se registra en la sección "Registro de desviaciones" de este spec. |

## Registro de desviaciones respecto al PDF

| ID | PDF decía | Se hace | Motivo |
|----|-----------|---------|--------|
| DV-01 (D1) | Ingress `/api/(.*)` + `rewrite-target: /$1` | `path: /api` y `path: /`, `pathType: Prefix`, sin rewrite | El rewrite quitaba `/api` → 404 en toda la API |
| DV-02 (D2) | `proxy_pass http://backend:3000` fijo | `default.conf.template` con `${BACKEND_HOST}` (envsubst de la imagen oficial) | En K8s el Service es `backend-svc`; NGINX no arranca si no resuelve el upstream |
| DV-03 (D3) | `Retain` en StorageClass `standard` | StorageClass propia `standard-retain` (`k8s.io/minikube-hostpath`, `Retain`) | La SC de Minikube es `Delete` e inmutable |
| DV-04 (D4) | Postgres vía `envFrom` con `DB_*` | `env` con `secretKeyRef`/`configMapKeyRef` → `POSTGRES_*` | Postgres solo lee `POSTGRES_*` |
| DV-05 (D5) | Probe `pg_isready -U $DB_USER` | `sh -c 'pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB"'` | Variable inexistente y `exec` no expande |
| DV-06 (D6) | NetworkPolicy sin requisitos | `minikube start --cni=calico` | CNI por defecto no aplica NetworkPolicy |
| DV-07 (D7/P3) | Frontend `nginx:1.27-alpine` como root, puerto 80 | `USER nginx`, puerto 8080 en contenedor | Cumplir §5.3 (no-root) |
| DV-08 (D8) | `API_BASE_URL` en ConfigMap del frontend | `/api` relativo en el bundle; variable documentada como informativa | Vite fija variables en build |
| DV-09 (D9) | Sin estrategia de imágenes | `docker build` local + `minikube image load` + `imagePullPolicy: IfNotPresent` | Evitar `ErrImagePull` |
| DV-10 (D10) | `taskboard.local` sin pasos | `/etc/hosts` + `minikube tunnel` | Driver docker en macOS |
| DV-11 (P4) | Backend `3000:3000` | `3001:3000` | Puerto 3000 ocupado en el host |
| DV-12 (P1) | JWT sin login definido; `usuarios` sin contraseña | Login + access 15 min + refresh 3 días rotativo en cookies httpOnly; `password_hash`, tabla `refresh_tokens` | Tabla 2 no cubría autenticación |
| DV-14 | Migraciones en `db/migrations/` | `backend/migrations/`; pruebas con BD en servicio `backend-test` (perfil `test`) | El contexto de build del backend es `./backend`; el backend las aplica al arrancar |
| DV-15 | Runtime backend `FROM node:20-alpine` directo | Etapa `runtime-base` desde `node:20-alpine` sin npm/npx/corepack/yarn, aplanada con `FROM scratch` + `COPY --from` | Con `node:20-alpine` directo la imagen medía 149.6 MB (límite 150); aplanada mide ~125 MB y sin gestores de paquetes en producción |
| DV-16 | Sin límite de intentos de login | Pendiente (ver Open Questions) | Rate limiting es tier "Ask first" en `security-and-hardening` |
| DV-17 | UI sin design system definido (React + CSS nativo) | Design system **Nocturne** (copiado en `frontend/src/styles/nocturne.css`) + capa `app.css` | Interfaz consistente para un gestor de equipo; Inter servida localmente con `@fontsource/inter` para respetar la CSP (`font-src 'self'`) |
| DV-18 | Vista global agrupada por equipo | Matriz equipos × estados en escritorio; lista agrupada en móvil | Lectura de todo el equipo de un vistazo |
| DV-19 | Tres servicios (frontend, backend, db) | Cuarto servicio Redis (`cache`): en Compose en `red-interna`; en K8s Deployment + `cache-svc` + NetworkPolicy solo desde backend; sonda `GET /api/cache` (503 genérico si falla, no afecta readiness) | Aportado por el equipo en `main`; integrado a la arquitectura modular |
| DV-13 (P6) | Respaldos/migraciones solo mencionados en Tabla 1 | `db/migrations/` + `schema_migrations`; `pg_dump` script + CronJob | Necesario para evolucionar el esquema |

## Open Questions

Ninguna bloqueante. Nuevas dudas se agregan aquí durante la implementación.

- **🔍 POR REVISAR – Rate limiting de login (DV-16):** no hay límite de intentos en `POST /api/auth/login`. Un limitador en memoria es por réplica (con HPA 2–6 el límite real se multiplica). Opciones: (a) limitador en memoria por IP (simple, suficiente para el proyecto); (b) contador en PostgreSQL por correo (consistente entre réplicas); (c) dejarlo fuera de alcance y documentarlo. Nota: con `trust proxy` y el backend publicado en `3001` para depuración, `X-Forwarded-For` es falsificable; un limitador por IP solo es fiable detrás de NGINX/Ingress.
- **Resuelto – Refresh concurrente entre pestañas:** un token rotado hace < 30 s responde 401 sin revocar la familia, y el cliente reintenta la petición original con las cookies ya renovadas por la otra pestaña.
