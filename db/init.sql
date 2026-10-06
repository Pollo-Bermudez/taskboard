-- ==========================================================
-- TaskBoard - Script de Inicialización de Base de Datos
-- PostgreSQL 16
-- ==========================================================

-- 1. Definición del Tipo Enumerado para Estado de Tarea
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'estado_tarea') THEN
        CREATE TYPE estado_tarea AS ENUM (
            'pendiente',
            'en_progreso',
            'en_revision',
            'completada'
        );
    END IF;
END $$;

-- 2. Tabla: equipos
CREATE TABLE IF NOT EXISTS equipos (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    color_hex VARCHAR(7) NOT NULL DEFAULT '#3B82F6',
    creado_en TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. Tabla: usuarios
CREATE TABLE IF NOT EXISTS usuarios (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    correo VARCHAR(150) UNIQUE NOT NULL,
    equipo_id INTEGER NOT NULL REFERENCES equipos(id) ON DELETE CASCADE,
    rol VARCHAR(50) NOT NULL DEFAULT 'desarrollador',
    creado_en TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. Tabla: tareas
CREATE TABLE IF NOT EXISTS tareas (
    id SERIAL PRIMARY KEY,
    equipo_id INTEGER NOT NULL REFERENCES equipos(id) ON DELETE CASCADE,
    titulo VARCHAR(200) NOT NULL,
    descripcion TEXT,
    estado estado_tarea NOT NULL DEFAULT 'pendiente',
    asignado_a INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
    prioridad VARCHAR(20) NOT NULL DEFAULT 'media',
    creado_en TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    actualizado_en TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Índices para optimizar consultas por equipo, estado y usuarios
CREATE INDEX IF NOT EXISTS idx_tareas_equipo_id ON tareas(equipo_id);
CREATE INDEX IF NOT EXISTS idx_tareas_estado ON tareas(estado);
CREATE INDEX IF NOT EXISTS idx_usuarios_equipo_id ON usuarios(equipo_id);

-- ==========================================================
-- Datos Iniciales de Prueba (Seeds)
-- ==========================================================

-- Insertar Equipos
INSERT INTO equipos (nombre, color_hex) VALUES
('Equipo DevOps', '#F59E0B'),
('Equipo Backend', '#10B981'),
('Equipo Frontend', '#3B82F6')
ON CONFLICT DO NOTHING;

-- Insertar Usuarios
INSERT INTO usuarios (nombre, correo, equipo_id, rol) VALUES
('Hugo Isai Rodriguez', 'hugo.devops@taskboard.local', 1, 'DevOps Lead'),
('Francisco Javier Bermúdez', 'francisco.backend@taskboard.local', 2, 'Backend Developer'),
('Ana García', 'ana.frontend@taskboard.local', 3, 'Frontend Developer'),
('Carlos Mendoza', 'carlos.dev@taskboard.local', 2, 'Backend Developer')
ON CONFLICT (correo) DO NOTHING;

-- Insertar Tareas de Prueba
INSERT INTO tareas (equipo_id, titulo, descripcion, estado, asignado_a, prioridad) VALUES
-- Tareas Equipo DevOps (id: 1)
(1, 'Configurar Minikube y Namespace', 'Crear el namespace taskboard y verificar addons de ingress y metrics-server', 'completada', 1, 'alta'),
(1, 'Crear Manifiestos de Kubernetes', 'Definir Deployments, Services, Ingress, StatefulSet y HPA', 'en_progreso', 1, 'alta'),
(1, 'Definir NetworkPolicy de PostgreSQL', 'Restringir acceso entrante a la base de datos únicamente a los Pods de backend', 'pendiente', 1, 'media'),

-- Tareas Equipo Backend (id: 2)
(2, 'Implementar Endpoints de Salud', 'Crear /api/health (liveness) y /api/ready con verificación de PostgreSQL (readiness)', 'completada', 2, 'alta'),
(2, 'Controlador de Tareas y Permisos', 'Validar que las operaciones de escritura correspondan al equipo propietario', 'en_progreso', 2, 'alta'),
(2, 'Endpoint de Vista Global', 'Crear GET /api/tareas/global para consulta consolidada de solo lectura', 'en_revision', 4, 'media'),

-- Tareas Equipo Frontend (id: 3)
(3, 'Diseñar Panel de Equipo (Kanban)', 'Implementar columnas por estado (pendiente, en progreso, en revisión, completada)', 'en_progreso', 3, 'alta'),
(3, 'Implementar Vista Global con Polling', 'Consultar /api/tareas/global cada 15 segundos para actualización en tiempo real', 'pendiente', 3, 'media'),
(3, 'Configurar NGINX para SPA y Proxy', 'Servir el bundle estático de React y enrutar /api hacia el backend', 'completada', 3, 'alta')
ON CONFLICT DO NOTHING;
