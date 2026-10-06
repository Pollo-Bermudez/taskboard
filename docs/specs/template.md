# Especificación de Tarea / Módulo: [Nombre del Módulo]

> **Nota de Contexto para el Asistente**: Cargar únicamente este archivo de especificación y los archivos listados en "Archivos Afectados" al trabajar en esta tarea.

## 1. Objetivo y Alcance
- **Módulo**: [Frontend / Backend / DB / Docker / K8s]
- **Descripción**: [Propósito del cambio o requerimiento]

## 2. Requerimientos Funcionales / Técnicos
- [ ] Requerimiento 1
- [ ] Requerimiento 2
- [ ] Requerimiento 3

## 3. Restricciones Específicas
- Stack: JavaScript puro (React 18 + Vite, Node.js 20 + Express).
- Contenedores: Cumplir estándares Docker multi-stage y redes bridge.

## 4. Archivos Afectados
- `frontend/...`
- `backend/...`
- `db/...`
- `docker-compose.yml`
- `k8s/...`

## 5. Plan de Verificación
- **Prueba de Build**: `docker build ...` o `npm run build`
- **Prueba de Configuración**: `docker compose config`
- **Verificación de Servicio**: Comprobar endpoints HTTP o estado de salud de contenedor
