# UNIVERSIDAD DE COLIMA
## Facultad de Telemática

### Requerimientos del Proyecto Integrador: TaskBoard
**Materia:** Ingeniería de Software / Instalación y Configuración de Clusters  
**Presenta:**
* Rodriguez Rosales Hugo Isai
* Francisco Javier Bermúdez Padilla

**Lugar y Fecha:** Colima, Col., México, 25 de Agosto de 2026

---

## 1. Información general

### 1.1 Título del proyecto
**TaskBoard:** Sistema de Control de Tareas para Equipos de Desarrollo de Software.

### 1.2 Integrantes y roles
La distribución de responsabilidades del equipo de trabajo se presenta en la Tabla 1. Cada rol es responsable del diseño, la implementación y la documentación de la capa que le corresponde, así como de la validación cruzada del trabajo de sus compañeros.

| Integrante | Rol | Responsabilidades principales |
| :--- | :--- | :--- |
| Hugo | DevOps Lead | Manifiestos de Kubernetes, Ingress, HPA, integración y despliegue en Minikube. |
| Francisco | Backend Developer | API REST en Node.js, lógica de permisos por equipo, probes de salud. |
| Hugo | Database Admin | Modelo de datos, StatefulSet de PostgreSQL, PVC, respaldos y migraciones. |
| Francisco | Frontend Developer | Interfaz en React, panel por equipo, vista global, empaquetado con NGINX. |

*Tabla 1. Integrantes del equipo y distribución de roles.*

### 1.3 Resumen ejecutivo del problema a resolver
En las organizaciones de desarrollo de software que operan con varios equipos en paralelo, la información sobre el trabajo en curso suele quedar fragmentada en herramientas aisladas, hojas de cálculo o canales de mensajería. Cada equipo conoce con detalle sus propias actividades, pero carece de visibilidad sobre lo que están construyendo los demás. Esta opacidad genera tres problemas recurrentes:

1. Duplicidad de esfuerzo entre equipos que resuelven necesidades similares.
2. Detección tardía de dependencias técnicas entre componentes.
3. Dificultad para que la coordinación técnica obtenga una visión consolidada del avance.

**TaskBoard** resuelve este problema mediante un sistema web en el que cada equipo administra su propio tablero de tareas —con permisos de escritura exclusivos sobre él— mientras que la totalidad de las tareas registradas por todos los equipos permanece visible en modo de solo lectura a través de una vista global. De esta forma se preserva la autonomía operativa de cada equipo y, al mismo tiempo, se garantiza el contexto organizacional compartido.

Desde la perspectiva de la materia, el sistema constituye un caso de estudio representativo porque exige tres servicios independientes con necesidades de despliegue claramente diferenciadas: un cliente web estático, una API con carga variable que justifica el autoescalado, y un motor de base de datos con estado que requiere persistencia garantizada. Esta heterogeneidad permite ejercitar de manera integral los conceptos de contenerización, orquestación, configuración, seguridad, resiliencia y escalado horizontal.

### 1.4 Objetivos

#### Objetivo general
Diseñar, contenerizar y desplegar una aplicación web de tres capas sobre un cluster local de Kubernetes, aplicando buenas prácticas de construcción de imágenes, gestión de configuración, persistencia de datos, alta disponibilidad y autoescalado.

#### Objetivos específicos
* Construir imágenes de contenedor optimizadas mediante *multi-stage builds* e imágenes base ligeras.
* Definir un entorno de desarrollo local reproducible con Docker Compose y segmentación de redes.
* Orquestar el despliegue en Minikube utilizando Deployments, StatefulSets, Services e Ingress.
* Externalizar la configuración mediante ConfigMaps y proteger las credenciales mediante Secrets.
* Garantizar la autorecuperación de los servicios mediante sondas de vitalidad (*liveness*) y disponibilidad (*readiness*).
* Configurar el escalado automático de la API en función del consumo de CPU y memoria.

---

## 2. Definición del sistema y arquitectura

### 2.1 Descripción de los microservicios
El sistema se compone de tres servicios independientes, cada uno empaquetado en su propia imagen de contenedor, con su propio ciclo de vida y escalable de forma autónoma.

#### 2.1.1 Servicio de frontend - Cliente web (React + NGINX)
Aplicación de página única (*Single Page Application*) construida con React y empaquetada con Vite. Es responsable de la totalidad de la experiencia de usuario y consume exclusivamente la API del backend a través del prefijo `/api`. Expone dos vistas principales:
* **Panel del equipo (`/equipo/:id`):** Tablero tipo Kanban organizado en columnas por estado de la tarea (*pendiente, en progreso, en revisión, completada*). Permite crear, editar, reasignar y cambiar el estado de las tareas pertenecientes al equipo del usuario autenticado.
* **Vista global (`/global`):** Consolidado de solo lectura con las tareas de todos los equipos, agrupado y filtrable por equipo y por estado. Su finalidad es proporcionar contexto organizacional sin conceder capacidad de modificación.

Al tratarse de contenido estático servido por NGINX, es un servicio completamente sin estado y, por lo tanto, replicable de forma horizontal sin restricciones. La actualización de la vista global se resuelve mediante sondeo periódico (*polling*) cada quince segundos, evitando la complejidad de una infraestructura de comunicación bidireccional.

#### 2.1.2 Servicio de backend - API REST (Node.js + Express)
Servicio que concentra la lógica de negocio y es el único componente autorizado para comunicarse con la base de datos. Expone una API REST sobre HTTP y aplica las reglas de autorización que sostienen el modelo de visibilidad del sistema: la lectura es global, mientras que la escritura queda restringida al equipo propietario del recurso.

| Endpoint | Método | Descripción |
| :--- | :--- | :--- |
| `/api/health` | GET | Verifica que el proceso responde. Utilizado por `livenessProbe`. |
| `/api/ready` | GET | Verifica el proceso y la conexión activa a PostgreSQL. Usado por `readinessProbe`. |
| `/api/equipos` | GET | Devuelve el catálogo de equipos registrados. |
| `/api/tareas` | GET | Tareas del equipo indicado mediante el parámetro `equipo_id`. |
| `/api/tareas/global` | GET | Consolidado de solo lectura con las tareas de todos los equipos. |
| `/api/tareas` | POST | Alta de una tarea. Valida que el equipo del usuario coincida con el destino. |
| `/api/tareas/:id` | PATCH | Actualiza estado, responsable o descripción. Restringido al equipo propietario. |
| `/api/tareas/:id` | DELETE | Elimina una tarea. Restringido al equipo propietario. |

*Tabla 2. Endpoints expuestos por la API de backend.*

El servicio se diseña sin estado en memoria: la sesión se resuelve mediante un token JWT firmado, de modo que cualquier réplica puede atender cualquier petición. Esta característica es la que habilita tanto la replicación como el autoescalado horizontal.

#### 2.1.3 Servicio de base de datos - PostgreSQL
Motor relacional responsable de la persistencia. Se selecciona PostgreSQL por su soporte nativo de tipos enumerados —empleados para modelar el estado de las tareas— y por la madurez de su integración con StatefulSets y volúmenes persistentes en Kubernetes. El esquema se compone de tres tablas relacionadas:

* `equipos` (`id`, `nombre`, `color_hex`, `creado_en`)
* `usuarios` (`id`, `nombre`, `correo`, `equipo_id` $\rightarrow$ `equipos.id`, `rol`)
* `tareas` (`id`, `equipo_id` $\rightarrow$ `equipos.id`, `titulo`, `descripcion`, `estado` `ENUM('pendiente', 'en_progreso', 'en_revision', 'completada')`, `asignado_a` $\rightarrow$ `usuarios.id`, `prioridad`, `creado_en`, `actualizado_en`)

El aislamiento por equipo se resuelve íntegramente mediante la columna `equipo_id`: la vista global corresponde a una consulta sin filtro, mientras que el panel de equipo aplica el filtro correspondiente. La base de datos no se expone fuera del cluster bajo ninguna circunstancia.

### 2.2 Diagrama de arquitectura
El flujo de la arquitectura de despliegue se describe gráficamente a continuación:

```
                                  [ Usuarios (navegador web) ]
                                               │
                                           HTTPS/HTTP
                                               ▼
┌──────────────────────────────────────────────────────────────────────────────────────────┐
│ Cluster de Kubernetes (Minikube)                                                        │
│                                                                                          │
│                             Ingress Controller (NGINX)                                   │
│                              / ────> frontend                                            │
│                              /api ──> backend                                            │
│                               /             \                                            │
│                              ▼               ▼                                           │
│                 Service frontend-svc          Service backend-svc                        │
│                  (ClusterIP:80)               (ClusterIP:3000)                           │
│                        │                             │                                   │
│                        ▼                             ▼                                   │
│               Deployment frontend            Deployment backend                          │
│                   (2 réplicas)              (2 réplicas - HPA)                           │
│              ┌───────────┬───────────┐     ┌───────────┬───────────┐                     │
│              │    Pod    │    Pod    │     │    Pod    │    Pod    │                     │
│              │React+NGINX│React+NGINX│     │Node.js API│Node.js API│                     │
│              └───────────┴───────────┘     └─────┬─────┴─────┬─────┘                     │
│                                                  │           │                           │
│  ┌────────────────────────────────────────┐      │    ┌──────┴────────────────────────┐  │
│  │ ConfigMap app-config                   │◄─────┼───┤ HorizontalPodAutoscaler        │  │
│  │ DB_HOST, DB_NAME, DB_PORT, NODE_ENV    │      │    │ CPU 70% | min 2 / max 6       │  │
│  └────────────────────────────────────────┘      │    └───────────────────────────────┘  │
│                                                  │                                       │
│  ┌────────────────────────────────────────┐      │                                       │
│  │ Secret db-credentials (Base64)         │◄─────┘                                       │
│  │ DB_USER, DB_PASSWORD, JWT_SECRET       │                                              │
│  └────────────────────────────────────────┘                                              │
│                                                                                          │
│                                              ▼                                           │
│                                    Service db-svc (Headless / ClusterIP:5432)            │
│                                              │                                           │
│                                              ▼                                           │
│                                    StatefulSet postgres (1 réplica)                      │
│                                    ┌────────────────────────┐                            │
│                                    │  Pod PostgreSQL 16     │                            │
│                                    └───────────┬────────────┘                            │
│                                                ▼                                         │
│                                            PVC 5Gi                                       │
│                                      (StorageClass standard)                             │
└──────────────────────────────────────────────────────────────────────────────────────────┘
```

*Figura 1. Arquitectura de despliegue del sistema TaskBoard sobre Kubernetes.*

El flujo de una petición es el siguiente: el usuario accede mediante el navegador al controlador de ingreso NGINX, que actúa como único punto de entrada al cluster. El Ingress enruta las peticiones a la raíz hacia el Service del frontend y las peticiones bajo el prefijo `/api` hacia el Service del backend. Ambos Services son de tipo `ClusterIP` y distribuyen el tráfico entre sus réplicas. El backend se comunica con la base de datos a través de un Service interno, sin exposición externa. La configuración no sensible se inyecta desde un ConfigMap y las credenciales desde un Secret.

### 2.3 Correspondencia entre capas y objetos de Kubernetes

| Capa | Tecnología | Objetos en Kubernetes |
| :--- | :--- | :--- |
| **Frontend** | React 18 + Vite, servido por NGINX | Deployment (2 réplicas) + Service ClusterIP |
| **Backend API** | Node.js 20 + Express | Deployment (2 réplicas) + HPA + Service ClusterIP |
| **Base de datos** | PostgreSQL 16 | StatefulSet (1 réplica) + PersistentVolumeClaim + Service Headless |
| **Enrutamiento** | NGINX Ingress Controller | Ingress: `/` $\rightarrow$ frontend, `/api` $\rightarrow$ backend |
| **Configuración** | Variables de entorno | ConfigMap (no sensible) + Secret (credenciales) |

*Tabla 3. Correspondencia entre las capas del sistema y los objetos de Kubernetes.*

---

## 3. Estrategia de despliegue con Docker

### 3.1 Definición y justificación de las imágenes base
La construcción de las imágenes se rige por dos criterios: reducir al mínimo la superficie de ataque y minimizar el tamaño final del artefacto. Para ello, los servicios de frontend y backend emplean *multi-stage builds*, de modo que las herramientas de compilación y las dependencias de desarrollo permanecen en etapas intermedias que no forman parte de la imagen final.

| Servicio | Imagen de construcción | Imagen final | Justificación |
| :--- | :--- | :--- | :--- |
| **Frontend** | `node:20-alpine` | `nginx:1.27-alpine` | La etapa de construcción genera los archivos estáticos; la imagen final solo contiene NGINX y el bundle, sin Node.js ni `node_modules`. |
| **Backend** | `node:20-alpine` | `node:20-alpine` | Alpine reduce la imagen frente a la variante Debian; la segunda etapa instala únicamente dependencias de producción. |
| **Base de datos** | N/A | `postgres:16-alpine` | Imagen oficial mantenida por el proyecto, con scripts de inicialización y verificación de salud integrados. |

*Tabla 4. Imágenes base seleccionadas y justificación técnica.*

#### 3.1.1 Dockerfile del frontend
```dockerfile
# ---------- Etapa 1: construcción ----------
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# ---------- Etapa 2: ejecución ----------
FROM nginx:1.27-alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

#### 3.1.2 Dockerfile del backend
```dockerfile
# ---------- Etapa 1: dependencias ----------
FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev

# ---------- Etapa 2: ejecución ----------
FROM node:20-alpine
WORKDIR /app
RUN addgroup -S app && adduser -S app -G app
COPY --from=deps /app/node_modules ./node_modules
COPY --chown=app:app . .
USER app
EXPOSE 3000
CMD ["node", "src/server.js"]
```
*El backend ejecuta su proceso bajo un usuario sin privilegios creado explícitamente en la imagen, práctica que limita el impacto de una eventual vulnerabilidad en las dependencias.*

### 3.2 Persistencia y volúmenes en el entorno local
En el entorno de desarrollo local, la persistencia de PostgreSQL se resuelve mediante un volumen nombrado de Docker montado sobre el directorio de datos del motor. Esto permite detener y reconstruir los contenedores sin pérdida de información.

| Volumen | Punto de montaje | Propósito |
| :--- | :--- | :--- |
| `pgdata` | `/var/lib/postgresql/data` | Directorio de datos de PostgreSQL. Garantiza la persistencia entre reinicios. |
| `./db/init.sql` | `/docker-entrypoint-initdb.d/init.sql` | Script de creación del esquema y carga de datos de prueba. Solo se ejecuta en la primera inicialización. |

*Tabla 5. Volúmenes definidos en el entorno de desarrollo local.*

Los servicios de frontend y backend no requieren volúmenes persistentes, ya que no almacenan estado en el sistema de archivos del contenedor.

### 3.3 Configuración de redes y exposición de puertos
Se definen dos redes de tipo *bridge* con el objetivo de aplicar el principio de mínimo privilegio a nivel de red. La base de datos únicamente pertenece a la red interna, de modo que resulta inalcanzable desde el exterior del entorno.

| Red | Servicios conectados | Función |
| :--- | :--- | :--- |
| `red-publica` | frontend, backend | Comunicación del navegador con el frontend y de este con la API. |
| `red-interna` | backend, db | Comunicación exclusiva entre la API y PostgreSQL. Marcada como `internal`. |

*Tabla 6. Segmentación de redes en Docker Compose.*

| Servicio | Puerto interno | Puerto publicado | Observación |
| :--- | :--- | :--- | :--- |
| **frontend** | 80 | 8080 | Único punto de acceso del usuario en desarrollo. |
| **backend** | 3000 | 3000 | Publicado solo para depuración; no se expone en producción. |
| **db** | 5432 | No publicado | Accesible únicamente desde la red interna. |

*Tabla 7. Exposición de puertos en el entorno local.*

#### 3.3.1 Archivo `docker-compose.yml`
```yaml
version: '3.8'

services:
  frontend:
    build: ./frontend
    ports:
      - "8080:80"
    depends_on:
      - backend
    networks:
      - red-publica

  backend:
    build: ./backend
    environment:
      DB_HOST: db
      DB_PORT: 5432
      DB_NAME: taskboard
      DB_USER: ${DB_USER}
      DB_PASSWORD: ${DB_PASSWORD}
    ports:
      - "3000:3000"
    depends_on:
      db:
        condition: service_healthy
    networks:
      - red-publica
      - red-interna

  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: taskboard
      POSTGRES_USER: ${DB_USER}
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - pgdata:/var/lib/postgresql/data
      - ./db/init.sql:/docker-entrypoint-initdb.d/init.sql
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${DB_USER} -d taskboard"]
      interval: 10s
      timeout: 5s
      retries: 5
    networks:
      - red-interna

volumes:
  pgdata:

networks:
  red-publica:
  red-interna:
    internal: true
```

---

## 4. Diseño de orquestación en Kubernetes

El despliegue se ejecuta sobre un cluster local de Minikube. Todos los objetos se agrupan en el namespace `taskboard` con el fin de aislar los recursos del proyecto del resto del cluster.

### 4.1 Definición de los Deployments
Existe una correspondencia directa entre los contenedores definidos en Docker Compose y los objetos de carga de trabajo de Kubernetes.

| Servicio Docker | Objeto K8s | Réplicas | Motivo de la elección |
| :--- | :--- | :--- | :--- |
| **frontend** | Deployment | 2 (fijas) | Servicio sin estado; dos réplicas aseguran disponibilidad durante actualizaciones. |
| **backend** | Deployment + HPA | 2 a 6 | Servicio sin estado con carga variable; se escala según el consumo de recursos. |
| **db** | StatefulSet | 1 | Servicio con estado; requiere identidad de red estable y volumen dedicado. |

*Tabla 8. Correspondencia entre contenedores y objetos de carga de trabajo.*

Los Deployments emplean la estrategia de actualización *RollingUpdate* con `maxUnavailable` igual a cero, garantizando que siempre exista al menos una réplica atendiendo peticiones durante un despliegue. El StatefulSet de PostgreSQL utiliza, en cambio, la estrategia *OnDelete*, de modo que la actualización del motor de base de datos requiera una acción deliberada del administrador.

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: backend
  namespace: taskboard
spec:
  replicas: 2
  selector:
    matchLabels:
      app: backend
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxUnavailable: 0
      maxSurge: 1
  template:
    metadata:
      labels:
        app: backend
    spec:
      containers:
      - name: backend
        image: taskboard/backend:1.0.0
        ports:
        - containerPort: 3000
        envFrom:
        - configMapRef:
            name: app-config
        - secretRef:
            name: db-credentials
```

### 4.2 Persistencia y volúmenes
La persistencia de la base de datos se resuelve mediante un `PersistentVolumeClaim` declarado en la sección `volumeClaimTemplates` del StatefulSet. Este mecanismo garantiza que el volumen conserve su vínculo con el Pod incluso si este es reprogramado en otro nodo, y que no se elimine al borrar el Pod.

| Parámetro | Valor | Objeto | Justificación |
| :--- | :--- | :--- | :--- |
| `StorageClass` | `standard` | PVC | Aprovisionador dinámico predeterminado de Minikube. |
| `accessModes` | `ReadWriteOnce` | PVC | PostgreSQL no admite múltiples escritores sobre el mismo directorio de datos. |
| `storage` | `5Gi` | PVC | Capacidad suficiente para el volumen de datos previsto en el proyecto. |
| `mountPath` | `/var/lib/postgresql/data` | StatefulSet | Directorio de datos del motor, coherente con el entorno local. |
| `reclaimPolicy` | `Retain` | StorageClass | Evita la pérdida de información ante la eliminación accidental del PVC. |

*Tabla 9. Parámetros de persistencia de la base de datos.*

```yaml
volumeClaimTemplates:
- metadata:
    name: pgdata
  spec:
    accessModes: ["ReadWriteOnce"]
    storageClassName: standard
    resources:
      requests:
        storage: 5Gi
```

### 4.3 Configuración de redes y exposición de puertos
La comunicación interna se resuelve mediante Services de tipo `ClusterIP`, que proporcionan un nombre DNS estable y balanceo de carga entre las réplicas. La exposición al exterior se concentra en un único controlador de ingreso NGINX, evitando la proliferación de puertos publicados.

| Service | Tipo | Puerto | Función |
| :--- | :--- | :--- | :--- |
| `frontend-svc` | ClusterIP | 80 | Recibe del Ingress el tráfico de la raíz y lo distribuye entre las réplicas del frontend. |
| `backend-svc` | ClusterIP | 3000 | Recibe del Ingress el tráfico bajo `/api` y lo distribuye entre las réplicas de la API. |
| `db-svc` | ClusterIP (Headless) | 5432 | Proporciona identidad de red estable al Pod de PostgreSQL. Solo accesible desde el backend. |

*Tabla 10. Services definidos en el cluster.*

El controlador de ingreso se habilita en Minikube mediante el complemento correspondiente (`minikube addons enable ingress`). Las reglas de enrutamiento definidas son las siguientes:

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: taskboard-ingress
  namespace: taskboard
  annotations:
    nginx.ingress.kubernetes.io/rewrite-target: /$1
spec:
  ingressClassName: nginx
  rules:
  - host: taskboard.local
    http:
      paths:
      - path: /api/(.*)
        pathType: Prefix
        backend:
          service:
            name: backend-svc
            port:
              number: 3000
      - path: /(.*)
        pathType: Prefix
        backend:
          service:
            name: frontend-svc
            port:
              number: 80
```

Adicionalmente se define una `NetworkPolicy` que restringe el tráfico entrante al Pod de PostgreSQL, admitiendo únicamente conexiones originadas en Pods con la etiqueta `app: backend`. Con ello se replica en el cluster la segmentación de redes establecida en el entorno local.

---

## 5. Configuración y seguridad

### 5.1 Gestión de credenciales
La configuración del sistema se externaliza por completo de las imágenes de contenedor, de acuerdo con el principio de separación entre código y configuración. Se distinguen dos categorías de parámetros, gestionadas mediante objetos distintos:

* **ConfigMap (`app-config`):** Almacena parámetros no sensibles, como nombres de host, puertos, nombre de la base de datos y modo de ejecución. Su contenido puede versionarse en el repositorio sin riesgo.
* **Secret (`db-credentials`):** Almacena las credenciales de acceso a la base de datos y la llave de firma de los tokens de sesión. Los valores se codifican en Base64 y el objeto se excluye del control de versiones mediante `.gitignore`.

Ambos objetos se inyectan en los contenedores como variables de entorno mediante las directivas `configMapRef` y `secretRef`, de modo que la aplicación no requiere lógica adicional para su lectura. Ningún valor sensible se escribe en los manifiestos de los Deployments ni en los Dockerfiles.

### 5.2 Variables de entorno por contenedor

| Contenedor | Variable | Origen | Descripción |
| :--- | :--- | :--- | :--- |
| **frontend** | `API_BASE_URL` | ConfigMap | Prefijo de la API consumida por el cliente. Valor: `/api` |
| **backend** | `NODE_ENV` | ConfigMap | Modo de ejecución. Valor: `production` |
| **backend** | `PORT` | ConfigMap | Puerto de escucha del servidor HTTP. Valor: `3000` |
| **backend** | `DB_HOST` | ConfigMap | Nombre DNS del Service de la base de datos. Valor: `db-svc` |
| **backend** | `DB_PORT` | ConfigMap | Puerto de PostgreSQL. Valor: `5432` |
| **backend** | `DB_NAME` | ConfigMap | Nombre de la base de datos. Valor: `taskboard` |
| **backend** | `DB_USER` | Secret | Usuario de conexión a PostgreSQL. |
| **backend** | `DB_PASSWORD` | Secret | Contraseña del usuario de conexión. |
| **backend** | `JWT_SECRET` | Secret | Llave de firma de los tokens de sesión. |
| **db** | `POSTGRES_DB` | ConfigMap | Base de datos creada en la inicialización. |
| **db** | `POSTGRES_USER` | Secret | Usuario propietario de la base de datos. |
| **db** | `POSTGRES_PASSWORD` | Secret | Contraseña del usuario propietario. |

*Tabla 11. Variables de entorno por contenedor y su origen.*

### 5.3 Medidas de seguridad complementarias
1. Los contenedores de frontend y backend se ejecutan con un usuario sin privilegios definido en el Dockerfile.
2. La base de datos carece de Service de tipo `NodePort` o `LoadBalancer`, por lo que resulta inalcanzable desde fuera del cluster.
3. Una `NetworkPolicy` limita el tráfico entrante a PostgreSQL a los Pods etiquetados como `app: backend`.
4. El Secret se genera en el cluster mediante `kubectl create secret` y no se almacena en el repositorio; el manifiesto versionado contiene únicamente una plantilla de ejemplo.
5. El acceso de escritura a las tareas se valida en el servidor comparando el equipo del token de sesión con el equipo propietario del recurso, de forma que la restricción no dependa de la interfaz.

---

## 6. Resiliencia y autoescalado

### 6.1 Sondas de vitalidad y disponibilidad
Cada servicio define sondas diferenciadas. La sonda de vitalidad (`livenessProbe`) determina si el proceso debe reiniciarse, mientras que la sonda de disponibilidad (`readinessProbe`) determina si el Pod puede recibir tráfico. La distinción es relevante en el backend: si la conexión a la base de datos se pierde temporalmente, el Pod deja de recibir tráfico pero no se reinicia, permitiendo su recuperación una vez restablecida la conexión.

| Servicio | Sonda | Ruta / Comando | Puerto | InitialDelay | period / timeout |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **frontend** | liveness | `GET /` | 80 | $10\text{ s}$ | $15\text{ s} / 3\text{ s}$ |
| **frontend** | readiness | `GET /` | 80 | $5\text{ s}$ | $10\text{ s} / 2\text{ s}$ |
| **backend** | liveness | `GET /api/health` | 3000 | $15\text{ s}$ | $20\text{ s} / 3\text{ s}$ |
| **backend** | readiness | `GET /api/ready` | 3000 | $10\text{ s}$ | $10\text{ s} / 3\text{ s}$ |
| **db** | liveness | `pg_isready -U $DB_USER` | 5432 | $30\text{ s}$ | $20\text{ s} / 5\text{ s}$ |
| **db** | readiness | `pg_isready -U $DB_USER` | 5432 | $15\text{ s}$ | $10\text{ s} / 3\text{ s}$ |

*Tabla 12. Parámetros de las sondas de vitalidad y disponibilidad por servicio.*

El umbral de fallos consecutivos (`failureThreshold`) se establece en $3$ para las sondas de vitalidad y en $2$ para las de disponibilidad, evitando reinicios provocados por fluctuaciones momentáneas.

```yaml
livenessProbe:
  httpGet:
    path: /api/health
    port: 3000
  initialDelaySeconds: 15
  periodSeconds: 20
  timeoutSeconds: 3
  failureThreshold: 3
readinessProbe:
  httpGet:
    path: /api/ready
    port: 3000
  initialDelaySeconds: 10
  periodSeconds: 10
  timeoutSeconds: 3
  failureThreshold: 2
```

### 6.2 Requests y limits de CPU y memoria
La definición de `requests` permite al planificador de Kubernetes ubicar los Pods en nodos con capacidad suficiente, mientras que los `limits` impiden que un contenedor degrade el rendimiento del resto del cluster. Los valores se dimensionan para operar dentro de los recursos disponibles en una instancia estándar de Minikube.

| Contenedor | CPU request | CPU limit | Memoria request | Memoria limit |
| :--- | :--- | :--- | :--- | :--- |
| **frontend** | 50m | 200m | 64 Mi | 128 Mi |
| **backend** | 100m | 500m | 128 Mi | 512 Mi |
| **db** | 250m | 1000m | 256 Mi | 1 Gi |

*Tabla 13. Requests y limits de CPU y memoria por contenedor.*

El frontend recibe la asignación más reducida por tratarse de un servidor de contenido estático. El backend dispone de un margen amplio entre request y limit para absorber picos antes de que se active el autoescalado. La base de datos concentra la mayor asignación de memoria, dado que PostgreSQL depende del caché de páginas para su rendimiento.

### 6.3 Configuración del HorizontalPodAutoscaler
El autoescalado se aplica exclusivamente al backend, que es el componente cuya carga varía en función del número de usuarios concurrentes y de la frecuencia de sondeo de la vista global. El frontend mantiene un número fijo de réplicas y la base de datos no se escala horizontalmente por tratarse de un servicio con estado.

| Parámetro | Valor | Justificación |
| :--- | :--- | :--- |
| `scaleTargetRef` | `Deployment backend` | Único servicio con carga variable y sin estado en memoria. |
| `minReplicas` | 2 | Mantiene disponibilidad ante la caída de una réplica. |
| `maxReplicas` | 6 | Techo compatible con los recursos disponibles en Minikube. |
| **CPU objetivo** | 70% de la request | Activa el escalado antes de la saturación, con margen de reacción. |
| **Memoria objetivo** | 75% de la request | Métrica secundaria; cubre picos de consumo sin aumento de CPU. |
| `stabilizationWindow` | 300 s (reducción) | Evita oscilaciones de réplicas ante picos intermitentes. |

*Tabla 14. Parámetros del HorizontalPodAutoscaler del backend.*

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: backend-hpa
  namespace: taskboard
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: backend
  minReplicas: 2
  maxReplicas: 6
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 75
  behavior:
    scaleDown:
      stabilizationWindowSeconds: 300
```

El funcionamiento del HPA requiere que el servidor de métricas se encuentre activo en el cluster, lo cual se habilita en Minikube mediante el complemento `metrics-server`. La validación del comportamiento se realizará generando carga sintética sobre el endpoint `/api/tareas/global` y observando la evolución del número de réplicas.

---

## 7. Plan de trabajo y entregables

La Tabla 15 presenta la secuencia de trabajo prevista, organizada de forma que cada etapa produzca un entregable verificable de manera independiente.

| Etapa | Actividad | Entregable | Responsable |
| :---: | :--- | :--- | :--- |
| **1** | Modelado de datos y script de inicialización | `init.sql` | Database Admin |
| **2** | Implementación de la API y endpoints de salud | Servicio backend | Backend Developer |
| **3** | Implementación del panel de equipo y la vista global | Servicio frontend | Frontend Developer |
| **4** | Construcción de imágenes y entorno local | `Dockerfiles` y `docker-compose.yml` | DevOps Lead |
| **5** | Manifiestos de Kubernetes y despliegue en Minikube | Directorio `k8s/` | DevOps Lead |
| **6** | Pruebas de resiliencia y validación del autoescalado | Evidencias de ejecución | Equipo completo |

*Tabla 15. Plan de trabajo y asignación de entregables.*

### 7.1 Estructura del repositorio
```text
taskboard/
├── frontend/                  # React + Vite + Dockerfile (multi-stage)
├── backend/                   # Node.js + Express + Dockerfile (multi-stage)
├── db/
│   └── init.sql               # Esquema y datos de prueba
├── docker-compose.yml         # Entorno de desarrollo local
└── k8s/
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

### 7.2 Criterios de validación
1. El entorno local se levanta con un único comando y la aplicación responde en el puerto `8080`.
2. Las imágenes finales de frontend y backend se mantienen por debajo de los 150 MB.
3. La eliminación manual de un Pod del backend no interrumpe el servicio y el Pod es recreado automáticamente.
4. La eliminación del Pod de PostgreSQL conserva íntegramente la información al reprogramarse el Pod.
5. El número de réplicas del backend aumenta ante una carga sostenida y disminuye al cesar esta.
6. La vista global muestra las tareas de todos los equipos, y un intento de modificación sobre una tarea ajena es rechazado por el servidor.