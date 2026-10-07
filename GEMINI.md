# Antigravity Rules - TaskBoard

Consulta y sigue [AGENTS.md](./AGENTS.md) para conocer las convenciones del proyecto integrador académico TaskBoard, directrices de arquitectura y estándares de contenerización.

## Directivas Principales para Antigravity
1. **Stack Estricto**:
   - **Frontend**: React 18 + Vite + NGINX (JavaScript puro JSX, CSS nativo).
   - **Backend**: Node.js 20 + Express (JavaScript puro, `node src/server.js`).
   - **Base de Datos**: PostgreSQL 16 (StatefulSet con PVC en K8s, Named Volume en Compose).
2. **Estándares Docker (Obligatorios)**:
   - Multi-stage builds (`node:20-alpine`, `nginx:1.27-alpine`, `postgres:16-alpine`).
   - `.dockerignore` en `frontend/` y `backend/`.
   - Redes `red-publica` y `red-interna` (con `internal: true`).
   - Puerto frontend `8080:8080` (NGINX sin root), backend `3001:3000`, PostgreSQL `5432` sin exponer al host.
   - Named volume para persistencia en `/var/lib/postgresql/data`.
   - Healthcheck con `pg_isready` y orden de arranque con `depends_on: condition: service_healthy`.
   - Variables cargadas desde `.env`.
3. **Estructura del Proyecto**:
   - Estructura de carpetas: `frontend/`, `backend/`, `db/`, `docker-compose.yml`, `k8s/` y `docs/`.
4. **Disciplina de Contexto**:
   - Cargar únicamente archivos relevantes a la tarea activa (<2,000 líneas).
