#!/bin/sh
# Restaura un respaldo creado con scripts/backup.sh. Reemplaza los datos actuales.
# Uso: scripts/restore.sh backups/taskboard-AAAAMMDD-HHMMSS.dump
set -eu
cd "$(dirname "$0")/.."
FILE=${1:?Uso: scripts/restore.sh <archivo.dump>}
[ -f "$FILE" ] || { echo "No existe: $FILE" >&2; exit 1; }

echo "Se reemplazarán los datos de la base 'taskboard' con $FILE"
# Se detiene el backend para que no haya conexiones abiertas durante la restauración.
docker compose stop backend
docker compose exec -T db sh -c 'pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists --no-owner --single-transaction' < "$FILE"
docker compose start backend
echo "Restauración completada"
