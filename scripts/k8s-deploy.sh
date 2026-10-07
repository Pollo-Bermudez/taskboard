#!/bin/sh
# Despliega TaskBoard en Minikube. Requisitos previos (ver docs/despliegue-k8s.md):
#   minikube start --cni=calico --memory=6g --cpus=4
#   minikube addons enable ingress && minikube addons enable metrics-server
#   scripts/k8s-build.sh
set -eu
cd "$(dirname "$0")/.."
NS=taskboard

kubectl apply -f k8s/namespace.yaml

# Secret: se crea desde .env.k8s (no versionado) solo si aún no existe.
if ! kubectl -n "$NS" get secret db-credentials >/dev/null 2>&1; then
  [ -f .env.k8s ] || { echo "Falta .env.k8s (copiar campos de k8s/secret.example.yaml)" >&2; exit 1; }
  kubectl -n "$NS" create secret generic db-credentials --from-env-file=.env.k8s
fi

# Script de inicialización de PostgreSQL como ConfigMap (idempotente).
kubectl -n "$NS" create configmap db-init --from-file=init.sql=db/init.sql \
  --dry-run=client -o yaml | kubectl apply -f -

kubectl apply -f k8s/storageclass.yaml -f k8s/configmap.yaml
kubectl apply -f k8s/db-service.yaml -f k8s/db-statefulset.yaml -f k8s/networkpolicy.yaml
kubectl -n "$NS" rollout status statefulset/postgres --timeout=180s

kubectl apply -f k8s/backend-service.yaml -f k8s/backend-deployment.yaml -f k8s/backend-hpa.yaml
kubectl apply -f k8s/frontend-service.yaml -f k8s/frontend-deployment.yaml
kubectl apply -f k8s/ingress.yaml -f k8s/db-backup-cronjob.yaml
kubectl -n "$NS" rollout status deployment/backend --timeout=180s
kubectl -n "$NS" rollout status deployment/frontend --timeout=180s

kubectl -n "$NS" get pods,svc,ingress,hpa,pvc
