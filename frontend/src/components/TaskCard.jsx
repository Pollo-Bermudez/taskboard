import { ESTADO_TITULO } from '../constants.js';

function iniciales(nombre) {
  return nombre
    .split(' ')
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase();
}

export default function TaskCard({ tarea, mostrarEstado = false, children }) {
  return (
    <div className="task-card">
      <div className="card-top">
        {mostrarEstado ? <span className={`card-tag estado-${tarea.estado}`}>{ESTADO_TITULO[tarea.estado]}</span> : <span />}
        <span className={`priority-badge priority-${tarea.prioridad}`}>{tarea.prioridad}</span>
      </div>
      <h4 className="card-title">{tarea.titulo}</h4>
      {tarea.descripcion && <p className="card-desc">{tarea.descripcion}</p>}
      <div className="card-footer">
        <div className="assignee">
          {tarea.asignado_nombre ? (
            <>
              <span className="assignee-avatar">{iniciales(tarea.asignado_nombre)}</span>
              <span className="assignee-name">{tarea.asignado_nombre}</span>
            </>
          ) : (
            <span className="assignee-name muted">Sin asignar</span>
          )}
        </div>
        {children}
      </div>
    </div>
  );
}
