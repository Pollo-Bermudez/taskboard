import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client.js';
import { usePolling } from '../hooks/usePolling.js';
import { ESTADOS, ESTADO_TITULO, POLLING_MS } from '../constants.js';
import { ErrorState } from '../components/States.jsx';

const cargar = async () => {
  const [equipos, tareas] = await Promise.all([api('/equipos'), api('/tareas/global')]);
  return { equipos, tareas };
};

const TAG_ESTADO = { pendiente: 'tag-neutral', en_progreso: 'tag-accent', en_revision: 'tag-outline', completada: 'tag-neutral' };

function MiniCard({ tarea, conEstado }) {
  return (
    <article className="card elev-sm mini">
      <div className="task-top">
        <span className={`card-kicker prio-${tarea.prioridad}`}>{tarea.prioridad}</span>
        {conEstado && <span className={`tag ${TAG_ESTADO[tarea.estado]}`}>{ESTADO_TITULO[tarea.estado]}</span>}
      </div>
      <h3 className="card-title">{tarea.titulo}</h3>
      <span className="card-meta">{tarea.asignado_nombre || 'Sin responsable'}</span>
    </article>
  );
}

export default function GlobalPage() {
  const { data, error, updatedAt, refresh } = usePolling(cargar, POLLING_MS);
  const [equipo, setEquipo] = useState('');
  const [estado, setEstado] = useState('');

  const vista = useMemo(() => {
    if (!data) return null;
    const porEquipo = data.tareas.filter((t) => !equipo || t.equipo_id === Number(equipo));
    const columnas = ESTADOS.filter((c) => !estado || c.key === estado);
    const filas = data.equipos
      .filter((e) => !equipo || e.id === Number(equipo))
      .map((e) => {
        const propias = data.tareas.filter((t) => t.equipo_id === e.id);
        return {
          ...e,
          abiertas: propias.filter((t) => t.estado !== 'completada').length,
          total: propias.length,
          celdas: columnas.map((c) => propias.filter((t) => t.estado === c.key)),
          visibles: propias.filter((t) => !estado || t.estado === estado),
        };
      });
    const cuentas = Object.fromEntries([['', porEquipo.length], ...ESTADOS.map((c) => [c.key, porEquipo.filter((t) => t.estado === c.key).length])]);
    return { columnas, filas, cuentas };
  }, [data, equipo, estado]);

  const plantilla = vista ? `200px repeat(${vista.columnas.length}, minmax(0, 1fr))` : undefined;

  return (
    <>
      <div className="page-head">
        <div className="page-head-text">
          <h6 className="muted">Solo lectura</h6>
          <h2>Vista global</h2>
          <p className="muted" style={{ fontSize: 14 }}>
            Lo que está haciendo cada equipo. Se actualiza cada {POLLING_MS / 1000} segundos
            {updatedAt ? `; última actualización ${updatedAt.toLocaleTimeString('es-MX')}` : '.'}
          </p>
        </div>
        <div className="field" style={{ width: 220 }}>
          <label htmlFor="filtro-equipo">Equipo</label>
          <select id="filtro-equipo" className="input" value={equipo} onChange={(e) => setEquipo(e.target.value)}>
            <option value="">Todos los equipos</option>
            {data?.equipos.map((e) => <option key={e.id} value={e.id}>{e.nombre}</option>)}
          </select>
        </div>
      </div>

      <div className="seg" role="radiogroup" aria-label="Filtrar por estado" style={{ alignSelf: 'flex-start', flexWrap: 'wrap' }}>
        {[{ key: '', titulo: 'Todos' }, ...ESTADOS].map((e) => (
          <label key={e.key} className="seg-opt">
            <input type="radio" name="filtro-estado" checked={estado === e.key} onChange={() => setEstado(e.key)} />
            {e.titulo} <span className="muted">{vista?.cuentas[e.key] ?? ''}</span>
          </label>
        ))}
      </div>

      {error && <ErrorState onRetry={refresh} conDatos={Boolean(data)} />}
      {!data && !error && <p className="muted">Cargando tareas…</p>}

      {vista && (
        <>
          <div className="matrix-scroll">
            <div className="matrix">
              <div className="matrix-row head" style={{ gridTemplateColumns: plantilla }}>
                <h6 className="muted">Equipo</h6>
                {vista.columnas.map((c) => (
                  <div key={c.key} className="eyebrow" style={{ gap: 8 }}>
                    <span className={`state-dot state-${c.key}`} />
                    <h6>{c.titulo}</h6>
                  </div>
                ))}
              </div>
              <div className="hr" style={{ margin: '0 0 4px' }} />
              {vista.filas.map((f) => (
                <div key={f.id}>
                  <div className="matrix-row" style={{ gridTemplateColumns: plantilla }}>
                    <div className="matrix-team">
                      <div className="eyebrow" style={{ gap: 8 }}>
                        <span className="team-mark-lg" style={{ background: f.color_hex }} />
                        <h5>{f.nombre}</h5>
                      </div>
                      <span className="muted" style={{ fontSize: 12 }}>{f.abiertas} abiertas de {f.total}</span>
                      <Link to={`/equipo/${f.id}`} className="btn btn-ghost" style={{ alignSelf: 'flex-start', fontSize: 13 }}>Ver tablero</Link>
                    </div>
                    {f.celdas.map((tareas, i) => (
                      <div key={vista.columnas[i].key} className="matrix-cell">
                        {tareas.length === 0 ? (
                          <span className="muted" style={{ fontSize: 12, padding: '6px 2px' }} aria-label="Sin tareas">—</span>
                        ) : (
                          tareas.map((t) => <MiniCard key={t.id} tarea={t} />)
                        )}
                      </div>
                    ))}
                  </div>
                  <div className="hr" style={{ margin: 0 }} />
                </div>
              ))}
            </div>
          </div>

          <div className="global-list">
            {vista.filas.map((f) => (
              <section key={f.id} aria-label={f.nombre} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div className="eyebrow" style={{ gap: 8 }}>
                  <span className="team-mark-lg" style={{ background: f.color_hex }} />
                  <h5 style={{ margin: 0, flex: 1 }}>{f.nombre}</h5>
                  <span className="tag tag-neutral">{f.visibles.length}</span>
                </div>
                {f.visibles.length === 0 && <p className="muted" style={{ margin: 0, fontSize: 13 }}>Nada con este filtro.</p>}
                {f.visibles.map((t) => <MiniCard key={t.id} tarea={t} conEstado />)}
                <div className="hr" style={{ margin: '6px 0 0' }} />
              </section>
            ))}
          </div>
        </>
      )}
    </>
  );
}
