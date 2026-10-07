# Evidencias de validación

Criterios de éxito del spec (`docs/specs/SPEC.md` §8, derivados de §7.2 del PDF).

| # | Criterio | Entorno | Estado |
|---|----------|---------|--------|
| 1 | Entorno local con un comando, app en `:8080` | Docker Compose | ✅ |
| 2 | Imágenes frontend y backend < 150 MB | Docker | ✅ |
| 3 | Borrar Pod backend no interrumpe el servicio | Minikube | 🔍 pendiente |
| 4 | Borrar Pod PostgreSQL conserva datos | Minikube | 🔍 pendiente |
| 5 | HPA escala con carga y desescala sin ella | Minikube | 🔍 pendiente |
| 6 | Vista global con todos los equipos; modificar tarea ajena → rechazado por el servidor | Docker Compose | ✅ |
| 7 | NetworkPolicy aísla PostgreSQL | Minikube | 🔍 pendiente |

Los criterios 3, 4, 5 y 7 requieren Minikube. Los comandos están listos en `docs/despliegue-k8s.md` §7.

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

## Criterios en Minikube (pendientes)

Pasos para completarlos:

1. Instalar Minikube: `brew install minikube`.
2. Seguir `docs/despliegue-k8s.md` §2–§6.
3. Ejecutar los comandos de §7 y pegar aquí las salidas o capturas (`docs/evidencias/*.png`).
