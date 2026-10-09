#!/bin/sh
# Carga sintética sobre /api/tareas/global para validar el HPA (criterio de éxito 5).
# Uso: scripts/load-test.sh [workers] [segundos]   — observar con: kubectl -n taskboard get hpa -w
set -eu
WORKERS=${1:-20}
SECONDS_TOTAL=${2:-300}
NS=taskboard
J=/tmp/tb-cookies

# Inicia sesión dentro del cluster y lanza N workers que consultan la vista global.
kubectl -n "$NS" delete pod tb-load --ignore-not-found >/dev/null
kubectl -n "$NS" run tb-load --rm -i --restart=Never --image=curlimages/curl:8.10.1 -- sh -c "
  curl -s -c $J -H 'Content-Type: application/json' \
    -d '{\"correo\":\"hugo.devops@taskboard.local\",\"password\":\"'\"\${SEED_PASSWORD:-TaskBoard-dev-2026}\"'\"}' \
    http://backend-svc:3000/api/auth/login >/dev/null
  end=\$((\$(date +%s) + $SECONDS_TOTAL))
  for i in \$(seq 1 $WORKERS); do
    ( while [ \$(date +%s) -lt \$end ]; do curl -s -b $J -o /dev/null http://backend-svc:3000/api/tareas/global; done ) &
  done
  wait
  echo 'Carga finalizada'
"
