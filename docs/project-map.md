# Project Map: TaskBoard

Usa este mapa para cargar contexto de forma selectiva según el componente en el que estés trabajando.

## 1. Frontend (`frontend/`)
Aplicación SPA en React 18 empaquetada con Vite y servida en producción mediante NGINX 1.27.
- **Tecnologías**: React 18, Vite, JavaScript puro (JSX), CSS estándar.
- **Archivos Clave**:
  - `frontend/package.json`: Scripts y dependencias del cliente.
  - `frontend/vite.config.js`: Configuración del bundler Vite.
  - `frontend/nginx.conf`: Configuración del servidor web y proxy reverso hacia el backend.
  - `frontend/Dockerfile`: Multi-stage build (`node:20-alpine` -> `nginx:1.27-alpine`).
  - `frontend/.dockerignore`: Exclusión de artefactos locales (`node_modules`, `dist`, etc.).
  - `frontend/src/`: Código fuente de la interfaz (componentes, vistas, estilos).

## 2. Backend (`backend/`)
API REST construida con Node.js 20 y Express para la lógica de negocio y persistencia en base de datos.
- **Tecnologías**: Node.js 20, Express, JavaScript puro, driver `pg`.
- **Archivos Clave**:
  - `backend/package.json`: Dependencias y scripts (`start`: `node src/server.js`).
  - `backend/src/server.js`: Punto de entrada de la aplicación Express y configuración de rutas.
  - `backend/src/db.js`: Configuración del pool de conexiones a PostgreSQL.
  - `backend/Dockerfile`: Multi-stage build (`node:20-alpine`).
  - `backend/.dockerignore`: Exclusión de `node_modules`, logs y `.env`.

## 3. Base de Datos (`db/`)
Capa de almacenamiento persistente basada en PostgreSQL 16.
- **Archivos Clave**:
  - `db/init.sql`: Script DDL para creación de tablas (tareas, columnas/estados) y datos iniciales de prueba. Se monta en `/docker-entrypoint-initdb.d/init.sql`.

## 4. Orquestación Local (`docker-compose.yml`)
Define los 3 servicios con sus políticas de red y volúmenes:
- **Servicios**: `frontend`, `backend`, `db`.
- **Redes**: `red-publica` (frontend y backend) y `red-interna` (`internal: true` para backend y db).
- **Volúmenes**: `db_data` (Named volume montado en `/var/lib/postgresql/data`).
- **Mapeo de Puertos**: `8080:80` (frontend), `3000:3000` (backend), db sin puertos hacia el host.
- **Salud**: `pg_isready` en servicio `db`, `depends_on: condition: service_healthy` en backend.

## 5. Manifiestos de Kubernetes (`k8s/`)
Despliegue para clúster Kubernetes:
- `k8s/namespace.yaml`
- `k8s/configmap.yaml`
- `k8s/secret.example.yaml`
- `k8s/frontend-deployment.yaml` & `k8s/frontend-service.yaml`
- `k8s/backend-deployment.yaml` & `k8s/backend-service.yaml`
- `k8s/backend-hpa.yaml`
- `k8s/db-statefulset.yaml` & `k8s/db-service.yaml`
- `k8s/networkpolicy.yaml`
- `k8s/ingress.yaml`
