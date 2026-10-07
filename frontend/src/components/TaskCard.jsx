import { forwardRef } from 'react';

export function iniciales(nombre) {
  return nombre
    .split(' ')
    .filter((p) => p.length > 2)
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase();
}

const fecha = new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short' });

// Tarjeta de tarea de Nocturne (.card): antetítulo de prioridad, título, descripción y responsable.
const TaskCard = forwardRef(function TaskCard({ tarea, acciones, className = '', ...rest }, ref) {
  return (
    <article ref={ref} className={`card elev-sm task ${className}`} {...rest}>
      <div className="task-top">
        <span className={`card-kicker prio-${tarea.prioridad}`}>Prioridad {tarea.prioridad}</span>
        <time className="card-meta" dateTime={tarea.actualizado_en}>{fecha.format(new Date(tarea.actualizado_en))}</time>
      </div>
      <h3 className="card-title">{tarea.titulo}</h3>
      {tarea.descripcion && <p className="card-body">{tarea.descripcion}</p>}
      <div className="task-bottom">
        <div className="card-meta">
          {tarea.asignado_nombre ? (
            <>
              <span className="avatar" aria-hidden="true">{iniciales(tarea.asignado_nombre)}</span>
              <span>{tarea.asignado_nombre}</span>
            </>
          ) : (
            <>
              <span className="avatar avatar-vacio" aria-hidden="true">?</span>
              <span>Sin responsable</span>
            </>
          )}
        </div>
        {acciones}
      </div>
    </article>
  );
});

export default TaskCard;
