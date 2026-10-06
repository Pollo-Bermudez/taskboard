import React, { useState, useEffect } from 'react';

// Tareas de ejemplo para la demostración
const INITIAL_TASKS = [
  {
    id: 1,
    titulo: 'Definir NetworkPolicy de PostgreSQL',
    descripcion: 'Restringir acceso entrante a la base de datos únicamente a los Pods del backend.',
    columna: 'pendiente',
    prioridad: 'Media',
    etiqueta: 'Seguridad',
    responsable: 'Hugo R.'
  },
  {
    id: 2,
    titulo: 'Validar autoescalado con HPA',
    descripcion: 'Configurar prueba de carga sintética para verificar escalado de 2 a 6 réplicas.',
    columna: 'pendiente',
    prioridad: 'Baja',
    etiqueta: 'Kubernetes',
    responsable: 'Francisco B.'
  },
  {
    id: 3,
    titulo: 'Crear Manifiestos de Kubernetes',
    descripcion: 'Definir Deployments, Services, Ingress, StatefulSet y HPA en el namespace taskboard.',
    columna: 'en_progreso',
    prioridad: 'Alta',
    etiqueta: 'DevOps',
    responsable: 'Hugo R.'
  },
  {
    id: 4,
    titulo: 'Endpoints de Salud y Conexión DB',
    descripcion: 'Implementar /api/health para liveness y /api/ready para readiness probe con pg.',
    columna: 'en_progreso',
    prioridad: 'Alta',
    etiqueta: 'Backend',
    responsable: 'Francisco B.'
  },
  {
    id: 5,
    titulo: 'Configuración Docker Multi-Stage',
    descripcion: 'Dockerfiles optimizados con node:20-alpine y nginx:1.27-alpine.',
    columna: 'completada',
    prioridad: 'Alta',
    etiqueta: 'Docker',
    responsable: 'Hugo R.'
  },
  {
    id: 6,
    titulo: 'Diseño del Esquema de Datos',
    descripcion: 'Script db/init.sql con tablas equipos, usuarios, tareas y tipos enumerados.',
    columna: 'completada',
    prioridad: 'Media',
    etiqueta: 'Database',
    responsable: 'Hugo R.'
  }
];

export default function App() {
  const [tasks] = useState(INITIAL_TASKS);
  const [healthStatus, setHealthStatus] = useState('Verificando...');
  const [readyStatus, setReadyStatus] = useState('Verificando...');
  const [loading, setLoading] = useState(false);
  const [showStatusDetails, setShowStatusDetails] = useState(false);

  const checkStatus = async () => {
    setLoading(true);
    try {
      const resHealth = await fetch('/api/health');
      if (resHealth.ok) {
        const dataHealth = await resHealth.json();
        setHealthStatus(dataHealth.status || 'ok');
      } else {
        setHealthStatus(`Error (${resHealth.status})`);
      }
    } catch (err) {
      setHealthStatus('Inalcanzable');
    }

    try {
      const resReady = await fetch('/api/ready');
      if (resReady.ok) {
        const dataReady = await resReady.json();
        setReadyStatus(dataReady.status || 'ready');
      } else {
        setReadyStatus(`Error (${resReady.status})`);
      }
    } catch (err) {
      setReadyStatus('Inalcanzable');
    }
    setLoading(false);
  };

  useEffect(() => {
    checkStatus();
  }, []);

  const columnas = [
    { key: 'pendiente', titulo: 'Pendiente', colorBadge: 'col-badge-pendiente' },
    { key: 'en_progreso', titulo: 'En Progreso', colorBadge: 'col-badge-progreso' },
    { key: 'completada', titulo: 'Completada', colorBadge: 'col-badge-completada' }
  ];

  const isSystemHealthy = healthStatus === 'ok' && readyStatus === 'ready';

  return (
    <div className="app-layout">
      {/* Encabezado */}
      <header className="navbar">
        <div className="navbar-brand">
          <div className="brand-icon">📋</div>
          <div>
            <h1 className="brand-title">TaskBoard</h1>
            <span className="brand-subtitle">Control de Tareas por Equipo</span>
          </div>
        </div>

        <div className="navbar-user">
          <div className="team-pill">
            <span className="team-dot"></span>
            <span>Equipo DevOps</span>
          </div>
          <div className="user-profile">
            <div className="user-avatar">HR</div>
            <div className="user-info">
              <span className="user-name">Hugo R.</span>
              <span className="user-role">DevOps Lead</span>
            </div>
          </div>
        </div>
      </header>

      {/* Contenido Principal: Tablero Kanban */}
      <main className="board-container">
        <div className="board-header">
          <div>
            <h2 className="board-title">Tablero de Equipo</h2>
            <p className="board-description">
              Gestión visual de tareas asignadas al sprint actual.
            </p>
          </div>
          <div className="board-actions">
            <button className="btn-secondary">Filtrar</button>
            <button className="btn-primary">+ Nueva Tarea</button>
          </div>
        </div>

        <div className="kanban-grid">
          {columnas.map((col) => {
            const tareasColumna = tasks.filter((t) => t.columna === col.key);
            return (
              <div key={col.key} className="kanban-column">
                <div className="column-header">
                  <div className="column-title-group">
                    <h3 className="column-title">{col.titulo}</h3>
                    <span className={`column-count ${col.colorBadge}`}>
                      {tareasColumna.length}
                    </span>
                  </div>
                </div>

                <div className="column-cards">
                  {tareasColumna.map((task) => (
                    <div key={task.id} className="task-card">
                      <div className="card-top">
                        <span className="card-tag">{task.etiqueta}</span>
                        <span
                          className={`priority-badge priority-${task.prioridad.toLowerCase()}`}
                        >
                          {task.prioridad}
                        </span>
                      </div>
                      <h4 className="card-title">{task.titulo}</h4>
                      <p className="card-desc">{task.descripcion}</p>
                      <div className="card-footer">
                        <div className="assignee">
                          <span className="assignee-avatar">
                            {task.responsable.slice(0, 2).toUpperCase()}
                          </span>
                          <span className="assignee-name">{task.responsable}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </main>

      {/* Indicador flotante de Estado del Sistema en esquina inferior derecha */}
      <div className="system-status-widget">
        {showStatusDetails && (
          <div className="status-popover">
            <div className="status-popover-header">
              <strong>Estado de la Infraestructura</strong>
              <button
                className="close-popover-btn"
                onClick={() => setShowStatusDetails(false)}
              >
                ✕
              </button>
            </div>
            <div className="status-row">
              <span>Frontend (NGINX):</span>
              <span className="status-tag status-ok">Operativo (8080)</span>
            </div>
            <div className="status-row">
              <span>API Backend (/api/health):</span>
              <span
                className={`status-tag ${
                  healthStatus === 'ok' ? 'status-ok' : 'status-warn'
                }`}
              >
                {healthStatus}
              </span>
            </div>
            <div className="status-row">
              <span>PostgreSQL (/api/ready):</span>
              <span
                className={`status-tag ${
                  readyStatus === 'ready' ? 'status-ok' : 'status-warn'
                }`}
              >
                {readyStatus}
              </span>
            </div>
            <button
              className="refresh-status-btn"
              onClick={checkStatus}
              disabled={loading}
            >
              {loading ? 'Comprobando...' : 'Actualizar Estado'}
            </button>
          </div>
        )}

        <button
          className="status-pill-button"
          onClick={() => setShowStatusDetails(!showStatusDetails)}
          title="Ver estado de los servicios"
        >
          <span
            className={`status-indicator-dot ${
              isSystemHealthy ? 'dot-healthy' : 'dot-warning'
            }`}
          ></span>
          <span className="status-pill-text">
            Sistema operativo: {isSystemHealthy ? 'Ok' : 'Verificando'}
          </span>
        </button>
      </div>
    </div>
  );
}
