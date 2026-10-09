#!/bin/sh
# Respaldo de PostgreSQL en Docker Compose (formato custom de pg_dump).
# Uso: scripts/backup.sh [directorio]   (por defecto ./backups)
set -eu
cd "$(dirname "$0")/.."
DIR=${1:-backups}
mkdir -p "$DIR"
FILE="$DIR/taskboard-$(date +%Y%m%d-%H%M%S).dump"

docker compose exec -T db sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' > "$FILE.tmp"
mv "$FILE.tmp" "$FILE"
echo "Respaldo creado: $FILE ($(du -h "$FILE" | cut -f1))"
