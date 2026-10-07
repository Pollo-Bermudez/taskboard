import { useMemo, useState } from 'react';
import { api } from '../api/client.js';
import { usePolling } from '../hooks/usePolling.js';
import { ESTADOS, POLLING_MS } from '../constants.js';
import TaskCard from '../components/TaskCard.jsx';

const cargar = async () => {
  const [equipos, tareas] = await Promise.all([api('/equipos'), api('/tareas/global')]);
  return { equipos, tareas };
};

export default function GlobalPage() {
  const { data, error, updatedAt } = usePolling(cargar, POLLING_MS);
  const [filtroEquipo, setFiltroEquipo] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('');

  const grupos = useMemo(() => {
    if (!data) return [];
    const tareas = data.tareas.filter(
      (t) => (!filtroEquipo || t.equipo_id === Number(filtroEquipo)) && (!filtroEstado || t.estado === filtroEstado),
    );
    return data.equipos
      .filter((e) => !filtroEquipo || e.id === Number(filtroEquipo))
      .map((equipo) => ({ equipo, tareas: tareas.filter((t) => t.equipo_id === equipo.id) }));
  }, [data, filtroEquipo, filtroEstado]);

  return (
    <main className="board-container">
      <div className="board-header">
        <div>
          <h2 className="board-title">Vista global</h2>
          <p className="board-description">
            Tareas de todos los equipos, solo lectura. Se actualiza cada {POLLING_MS / 1000} s
            {updatedAt && ` · última actualización ${updatedAt.toLocaleTimeString()}`}.
          </p>
        </div>
        <div className="board-actions">
          <select className="filter-select" value={filtroEquipo} onChange={(e) => setFiltroEquipo(e.target.value)} aria-label="Filtrar por equipo">
            <option value="">Todos los equipos</option>
            {data?.equipos.map((e) => (
              <option key={e.id} value={e.id}>
                {e.nombre}
              </option>
            ))}
          </select>
          <select className="filter-select" value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value)} aria-label="Filtrar por estado">
            <option value="">Todos los estados</option>
            {ESTADOS.map((e) => (
              <option key={e.key} value={e.key}>
                {e.titulo}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && <div className="alert alert-error">No se pudieron cargar las tareas: {error.message}</div>}
      {!data && !error && <p className="muted">Cargando…</p>}

      {grupos.map(({ equipo, tareas }) => (
        <section key={equipo.id} className="team-section">
          <h3 className="team-section-title">
            <span className="team-dot" style={{ background: equipo.color_hex }}></span>
            {equipo.nombre}
            <span className="column-count">{tareas.length}</span>
          </h3>
          {tareas.length === 0 ? (
            <p className="muted">Sin tareas con estos filtros.</p>
          ) : (
            <div className="card-grid">
              {tareas.map((t) => (
                <TaskCard key={t.id} tarea={t} mostrarEstado />
              ))}
            </div>
          )}
        </section>
      ))}
    </main>
  );
}
