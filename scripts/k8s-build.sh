#!/bin/sh
# Construye las imágenes con el Docker local y las carga en Minikube para que el cluster
# las use sin registro (imagePullPolicy: IfNotPresent, DV-09). `minikube image load`
# funciona con cualquier runtime del cluster (containerd o docker).
set -eu
cd "$(dirname "$0")/.."
TAG=${TAG:-1.0.0}
docker build -t "taskboard/backend:$TAG" ./backend
docker build -t "taskboard/frontend:$TAG" ./frontend
scripts/image-sizes.sh "taskboard/backend:$TAG" "taskboard/frontend:$TAG"
minikube image load "taskboard/backend:$TAG" --overwrite
minikube image load "taskboard/frontend:$TAG" --overwrite
minikube image ls | grep taskboard
