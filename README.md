# TaskBoard

Sistema web de control de tareas para equipos de desarrollo. Cada equipo administra su propio tablero Kanban (solo él puede escribir en él) y todos pueden consultar en modo de solo lectura las tareas de los demás desde una vista global.

Proyecto integrador de *Instalación y configuración de clusters* (Universidad de Colima, Facultad de Telemática).

| Servicio | Tecnología | Imagen base |
| --- | --- | --- |
| `frontend` | React 18 + Vite, servido por NGINX sin root | `node:20-alpine` → `nginx:1.27-alpine` |
| `backend` | Node.js 20 + Express, JWT en cookies httpOnly | `node:20-alpine` |
| `db` | PostgreSQL 16 | `postgres:16-alpine` |
| `cache` | Redis 7 | `redis:7-alpine` |

## Requisitos

- Docker Desktop (o Docker Engine + Compose v2).
- Para Kubernetes: Minikube y `kubectl` (ver [docs/despliegue-k8s.md](docs/despliegue-k8s.md)).

## Inicio rápido (Docker Compose)

1. Crea tu archivo de variables a partir de la plantilla:

   ```bash
   cp .env.example .env
   ```

2. Edita `.env` y cambia los valores de ejemplo:

   | Variable | Para qué sirve |
   | --- | --- |
   | `DB_USER`, `DB_PASSWORD` | Credenciales de PostgreSQL |
   | `JWT_SECRET` | Llave para firmar las sesiones; genérala con `openssl rand -hex 32` |
   | `SEED_USER_PASSWORD` | Contraseña común de los usuarios de prueba (solo desarrollo) |

   `.env` está en `.gitignore`: nunca lo subas al repositorio.

3. Levanta todo:

   ```bash
   docker compose up -d --build
   ```

4. Abre http://localhost:8080.

## Iniciar sesión

El backend asigna `SEED_USER_PASSWORD` (guardada como hash bcrypt) a los usuarios de prueba que aún no tienen contraseña. Entra con cualquiera de estos correos y esa contraseña:

| Correo | Equipo |
| --- | --- |
| `hugo.devops@taskboard.local` | DevOps |
| `francisco.backend@taskboard.local` | Backend |
| `carlos.dev@taskboard.local` | Backend |
| `ana.frontend@taskboard.local` | Frontend |

Si la base ya existía y agregaste `SEED_USER_PASSWORD` después, no hace falta borrar el volumen. Basta con reiniciar el backend:

```bash
docker compose up -d backend
```

### Problemas comunes

- **"Credenciales inválidas":** revisa que la contraseña coincida con `.env`. En los logs del backend debe aparecer `Contraseña de desarrollo asignada`:

  ```bash
  docker compose logs backend
  ```

- **"Demasiados intentos fallidos":** tras 5 intentos fallidos en 15 minutos, el correo queda bloqueado 15 minutos. Espera o limpia el bloqueo:

  ```bash
  docker compose exec db sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "DELETE FROM login_intentos"'
  ```

## Puertos

| Servicio | URL / puerto | Nota |
| --- | --- | --- |
| Frontend | http://localhost:8080 | Único punto de entrada |
| Backend | http://localhost:3001 | Solo para depurar la API (`/api/health`, `/api/ready`, `/api/cache`) |
| PostgreSQL y Redis | sin publicar | Solo accesibles desde la red interna |

## Pruebas

```bash
cd backend && npm test
```

Corre las pruebas que no necesitan base de datos. Para la suite completa contra una base temporal:

```bash
docker compose --profile test run --rm backend-test
```

## Comandos útiles

| Acción | Comando |
| --- | --- |
| Ver logs del backend | `docker compose logs -f backend` |
| Validar el compose | `docker compose config` |
| Respaldar la base | `scripts/backup.sh` |
| Restaurar un respaldo | `scripts/restore.sh backups/<archivo>.dump` |
| Tamaño de imágenes (límite 150 MB) | `scripts/image-sizes.sh <imagen>...` |
| Reiniciar desde cero (borra los datos) | `docker compose down -v && docker compose up -d --build` |

## Kubernetes (Minikube)

```bash
minikube start --cni=calico --memory=6g --cpus=4
minikube addons enable ingress
minikube addons enable metrics-server
scripts/k8s-build.sh
scripts/k8s-deploy.sh
```

Antes de desplegar crea `.env.k8s` con las mismas variables de `k8s/secret.example.yaml`. La guía completa, con el acceso por `taskboard.local` y las pruebas de resiliencia, está en [docs/despliegue-k8s.md](docs/despliegue-k8s.md).

## Documentación

- [docs/specs/SPEC.md](docs/specs/SPEC.md): especificación, decisiones y registro de desviaciones respecto a la propuesta.
- [docs/evidencias.md](docs/evidencias.md): evidencias de los criterios de éxito.
- [docs/despliegue-k8s.md](docs/despliegue-k8s.md): despliegue en Minikube.
- [tasks/plan.md](tasks/plan.md) y [tasks/todo.md](tasks/todo.md): plan de trabajo y estado de las tareas.
