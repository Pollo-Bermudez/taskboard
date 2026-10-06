# TaskBoard - Arquitectura del Sistema

## 1. Visión General
TaskBoard es una aplicación web de tres capas para la gestión de tableros y tareas, diseñada como un proyecto integrador académico con prácticas profesionales de contenerización y orquestación.

```
                  ┌───────────────────────────────┐
                  │          Host / Usuario       │
                  └──────────────┬────────────────┘
                                 │ Puerto 8080 (HTTP)
                                 ▼
                    [ red-publica (Bridge) ]
               ┌─────────────────────────────────────┐
               │              Frontend               │
               │   React 18 + Vite + NGINX 1.27      │
               └─────────────────┬───────────────────┘
                                 │ Proxy inverso / API (Puerto 3000)
                                 ▼
┌────────────────────────────────────────────────────────────────────┐
│                    [ red-interna (Bridge, internal: true) ]        │
│                                                                    │
│     ┌─────────────────────┐             ┌─────────────────────┐    │
│     │       Backend       │             │    Base de Datos    │    │
│     │  Node.js 20 Express ├────────────►│    PostgreSQL 16    │    │
│     │   (Puerto 3000)     │  TCP: 5432  │  (Puerto 5432 int)  │    │
│     └─────────────────────┘             └──────────┬──────────┘    │
│                                                    │               │
└────────────────────────────────────────────────────┼───────────────┘
                                                     ▼
                                          [ Named Volume: db_data ]
                                           /var/lib/postgresql/data
```

## 2. Componentes

### Frontend (`frontend/`)
- **Tecnología**: React 18, Vite, JavaScript puro (JSX), CSS nativo.
- **Servidor Web**: NGINX 1.27 Alpine en producción.
- **Función**: Sirve los archivos estáticos de la aplicación y puede actuar como reverse proxy redirigiendo `/api` hacia el backend.
- **Contenerización**: Multi-stage build (`node:20-alpine` para compilar y `nginx:1.27-alpine` para servir).

### Backend (`backend/`)
- **Tecnología**: Node.js 20, Express, JavaScript puro.
- **Punto de Entrada**: `node src/server.js`.
- **Función**: Expone la API REST para operaciones CRUD sobre tareas y tableros. Se conecta a PostgreSQL mediante el driver `pg`.
- **Contenerización**: Multi-stage build con `node:20-alpine` ejecutando como usuario no privilegiado (`node`).

### Base de Datos (`db/`)
- **Tecnología**: PostgreSQL 16 Alpine.
- **Inicialización**: Script DDL y seed de datos en `db/init.sql` montado en `/docker-entrypoint-initdb.d/init.sql`.
- **Persistencia**: Named volume `db_data` montado en `/var/lib/postgresql/data`.
- **Seguridad**: Pertenece exclusivamente a la red interna (`internal: true`) y no publica puertos hacia la máquina host.

## 3. Redes y Seguridad en Docker Compose
1. **`red-publica`**: Red bridge que conecta al frontend (expuesto en puerto 8080 del host) y opcionalmente al backend para depuración directa en puerto 3000.
2. **`red-interna`**: Red bridge aislada con la directiva `internal: true`. Aísla la base de datos PostgreSQL, permitiendo únicamente el tráfico originado desde el backend.

## 4. Orquestación en Kubernetes (`k8s/`)
- **StatefulSet con PersistentVolumeClaim (PVC)** para PostgreSQL con almacenamiento persistente.
- **Deployments** escalables para Frontend y Backend.
- **Services**: ClusterIP para comunicación interna y NodePort/LoadBalancer/Ingress para acceso público.
- **Seguridad y Control**: ConfigMaps para configuración agnóstica, Secrets para contraseñas, NetworkPolicies para control de flujo y Horizontal Pod Autoscaler (HPA) para el backend.
