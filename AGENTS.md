# Project: TaskBoard (Proyecto Integrador Académico)

Aplicación web de gestión de tareas (TaskBoard) con arquitectura en tres capas (Frontend, Backend, Base de Datos), contenerizada con Docker y orquestada con Kubernetes.

## Tech Stack
- **Frontend**: React 18 + Vite + NGINX (JavaScript puro JSX, CSS nativo)
- **Backend**: Node.js 20 + Express (JavaScript puro, punto de entrada `node src/server.js`)
- **Base de Datos**: PostgreSQL 16 (StatefulSet con PVC en K8s, Named Volume en Docker Compose)
- **Contenerización**: Docker & Docker Compose (Multi-stage builds, imágenes Alpine, redes bridge aisladas)
- **Orquestación**: Kubernetes (Deployments, Services, StatefulSet, ConfigMap, Secrets, HPA, NetworkPolicy, Ingress)

## Estructura del Repositorio
```
taskboard/
├── frontend/          # React 18 + Vite + Dockerfile multi-stage + .dockerignore
├── backend/           # Node.js 20 + Express + Dockerfile multi-stage + .dockerignore
├── db/
│   └── init.sql       # Esquema DDL y datos iniciales de prueba
├── docker-compose.yml # Orquestación local con redes y volúmenes
└── k8s/               # Manifiestos de Kubernetes
    ├── namespace.yaml
    ├── configmap.yaml
    ├── secret.example.yaml
    ├── frontend-deployment.yaml
    ├── frontend-service.yaml
    ├── backend-deployment.yaml
    ├── backend-service.yaml
    ├── backend-hpa.yaml
    ├── db-statefulset.yaml
    ├── db-service.yaml
    ├── networkpolicy.yaml
    └── ingress.yaml
```

## Docker Standards (Obligatorios para la Entrega)
- **Multi-stage builds**:
  - **Frontend**: Etapa 1 (Build): `node:20-alpine` (compilación con Vite) -> Etapa 2 (Producción): `nginx:1.27-alpine` (sirve estáticos y proxy inverso a API).
  - **Backend**: Etapa 1 (Deps): `node:20-alpine` -> Etapa 2 (Runtime): `node:20-alpine` mínima ejecutando como usuario no-root.
- **Imágenes Base Oficiales**:
  - `node:20-alpine`
  - `nginx:1.27-alpine`
  - `postgres:16-alpine`
- **Archivos `.dockerignore`**: Presentes en `frontend/` y `backend/` excluyendo `node_modules`, `.git`, `.env`, dist, etc.
- **Volumen Persistente (Named Volume)**: Volumen para PostgreSQL montado en `/var/lib/postgresql/data`.
- **Aislamiento de Redes (Bridge)**:
  - `red-publica`: Frontend accesible en puerto host `8080:80`.
  - `red-interna`: Comunicación backend y base de datos con `internal: true`.
- **Puertos**:
  - Frontend: `8080:80` (expuesto al host).
  - Backend: `3000:3000` (expuesto al host).
  - Base de Datos (PostgreSQL): `5432` interno, **SIN exponer puerto al host**.
- **Variables de Entorno**:
  - Gestionadas mediante archivo `.env` (nunca credenciales hardcodeadas en `docker-compose.yml` ni en el código).
  - Mantener un archivo `.env.example` versionado con valores plantilla.
- **Control de Arranque y Healthchecks**:
  - `depends_on` con condición `service_healthy`.
  - PostgreSQL con healthcheck: `pg_isready -U ${POSTGRES_USER} -d ${POSTGRES_DB}`.
  - Backend esperando que la base de datos esté lista y saludable antes de iniciar.

## Convenciones de Código
- **Lenguaje**: JavaScript puro (ES Modules / CommonJS según `package.json`).
- **Frontend**: Componentes funcionales en React con hooks, estilos CSS nativos (`.css`).
- **Backend**:
  - Punto de entrada: `node src/server.js`.
  - Rutas y controladores organizados modularmente con Express.
  - Middleware de manejo de errores centralizado `(err, req, res, next)`.
  - Cliente de base de datos con `pg` (Pool de conexiones).
- **Base de Datos**: Inicialización mediante script SQL idempotente en `db/init.sql` montado en `/docker-entrypoint-initdb.d/`.

## Context Engineering y Salvaguardas
- **Economía de Contexto**: Al trabajar en un componente específico (frontend, backend, db o k8s), inspeccionar únicamente los archivos pertinentes (<2,000 líneas).
- **Secretos**: NUNCA commitear archivos `.env` con contraseñas reales.
- **Verificación**: Validar sintaxis con `docker compose config`, `nginx -t` y pruebas de conectividad de servicios.
