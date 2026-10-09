# Despliegue en Kubernetes (Minikube)

Guía para levantar TaskBoard en un cluster local de Minikube. Los manifiestos están en `k8s/`; las desviaciones respecto al PDF están registradas en `docs/specs/SPEC.md` (DV-01 a DV-16).

## 1. Requisitos

- Docker Desktop
- `kubectl` 1.29+
- Minikube: `brew install minikube`

## 2. Crear el cluster

```bash
minikube start --cni=calico --memory=6g --cpus=4
```

```bash
minikube addons enable ingress
```

```bash
minikube addons enable metrics-server
```

- `--cni=calico`: el CNI por defecto **no aplica** NetworkPolicy (DV-06).
- `metrics-server`: necesario para el HPA.

## 3. Construir las imágenes dentro de Minikube

```bash
scripts/k8s-build.sh
```

Construye `taskboard/backend:1.0.0` y `taskboard/frontend:1.0.0` con tu Docker local y las carga en el cluster con `minikube image load` (sirve con runtime containerd o docker), así el cluster las usa sin registro (`imagePullPolicy: IfNotPresent`, DV-09). Al final imprime el tamaño de cada imagen (límite 150 MB).

## 4. Credenciales

Crear `.env.k8s` (está en `.gitignore`) con los mismos campos de `k8s/secret.example.yaml`:

```bash
cat > .env.k8s <<EOF
DB_USER=taskboard_user
DB_PASSWORD=$(openssl rand -hex 16)
JWT_SECRET=$(openssl rand -hex 32)
SEED_USER_PASSWORD=TaskBoard-dev-2026
EOF
```

`SEED_USER_PASSWORD` solo para demostración: asigna esa contraseña (como hash bcrypt) a los usuarios de prueba.

## 5. Desplegar

```bash
scripts/k8s-deploy.sh
```

El script, en orden:
1. Crea el namespace `taskboard`.
2. Crea el Secret `db-credentials` desde `.env.k8s` (si no existe).
3. Crea el ConfigMap `db-init` desde `db/init.sql`.
4. Aplica StorageClass `standard-retain`, ConfigMap `app-config`, PostgreSQL (StatefulSet + Service headless + NetworkPolicy) y espera a que esté listo.
5. Aplica backend (Deployment + Service + HPA), frontend (Deployment + Service), Ingress y CronJob de respaldo.

## 6. Acceder por Ingress

Con el driver docker en macOS, el Ingress se expone en `127.0.0.1` mediante un túnel (DV-10):

```bash
echo "127.0.0.1 taskboard.local" | sudo tee -a /etc/hosts
```

```bash
minikube tunnel
```

Dejar el túnel abierto y entrar a http://taskboard.local. Usuarios de prueba: `hugo.devops@taskboard.local`, `francisco.backend@taskboard.local`, `ana.frontend@taskboard.local`, `carlos.dev@taskboard.local` con la contraseña `SEED_USER_PASSWORD`.

Sin túnel, alternativa rápida:

```bash
kubectl -n taskboard port-forward svc/frontend-svc 8080:80
```

## 7. Validaciones (criterios de éxito)

| # | Criterio | Comando |
|---|----------|---------|
| 3 | Borrar un Pod backend no interrumpe el servicio | Terminal A: `while true; do curl -s -o /dev/null -w "%{http_code}\n" http://taskboard.local/api/health; sleep 0.2; done` · Terminal B: `kubectl -n taskboard delete pod -l app=backend --wait=false` (borra uno a la vez si se quiere ver la recreación) |
| 4 | Borrar el Pod de PostgreSQL conserva datos | Crear tarea en la UI → `kubectl -n taskboard delete pod postgres-0` → esperar `Ready` → la tarea sigue |
| 5 | HPA escala y desescala | Terminal A: `kubectl -n taskboard get hpa -w` · Terminal B: `scripts/load-test.sh 20 300` → réplicas > 2; al terminar, vuelven a 2 tras ≥ 300 s |
| — | Caché Redis | `curl -H 'Host: taskboard.local' http://127.0.0.1/api/cache` → `cache-ready`; `kubectl -n taskboard run t --rm -it --image=redis:7-alpine -- redis-cli -h cache-svc ping` → sin respuesta (NetworkPolicy) |
| 7 | NetworkPolicy aísla PostgreSQL | `kubectl -n taskboard run np-test --rm -it --image=postgres:16-alpine --restart=Never -- pg_isready -h db-svc -t 5` → debe fallar (`no response`); el backend sigue `Ready` |
| — | PV con Retain | `kubectl get pv` → `RECLAIM POLICY = Retain` |
| — | Respaldo manual | `kubectl -n taskboard create job --from=cronjob/db-backup db-backup-manual` → `kubectl -n taskboard logs job/db-backup-manual` |

## 8. Limpieza

```bash
kubectl delete namespace taskboard
```

Los PV quedan en estado `Released` por `reclaimPolicy: Retain`; borrarlos explícitamente con `kubectl delete pv <nombre>` si ya no se necesitan los datos.
