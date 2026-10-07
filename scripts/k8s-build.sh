#!/bin/sh
# Construye las imágenes dentro del Docker de Minikube para que el cluster las encuentre
# sin registro (imagePullPolicy: IfNotPresent, DV-09).
set -eu
cd "$(dirname "$0")/.."
TAG=${TAG:-1.0.0}
eval "$(minikube docker-env)"
docker build -t "taskboard/backend:$TAG" ./backend
docker build -t "taskboard/frontend:$TAG" ./frontend
scripts/image-sizes.sh "taskboard/backend:$TAG" "taskboard/frontend:$TAG"
