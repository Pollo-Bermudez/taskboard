#!/bin/sh
# Tamaño descomprimido real de las imágenes (suma de capas).
# Docker Desktop con containerd muestra en `docker images` un valor mayor
# porque suma también el contenido comprimido; este script usa el criterio estándar.
set -eu
LIMIT_MB=${LIMIT_MB:-150}
status=0
for image in "$@"; do
  mb=$(docker history --human=false --format '{{.Size}}' "$image" | awk '{s+=$1} END {printf "%.1f", s/1e6}')
  if awk -v a="$mb" -v b="$LIMIT_MB" 'BEGIN{exit !(a<b)}'; then mark=OK; else mark=EXCEDE; status=1; fi
  echo "$image: ${mb} MB (límite ${LIMIT_MB} MB) $mark"
done
exit $status
