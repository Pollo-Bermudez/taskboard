import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api/client.js';
import { useAuth } from '../auth/AuthContext.jsx';
import { usePolling } from '../hooks/usePolling.js';
import { ESTADOS, POLLING_MS } from '../constants.js';
import TaskCard from '../components/TaskCard.jsx';
import TaskDialog from '../components/TaskDialog.jsx';
import ConfirmDialog from '../components/ConfirmDialog.jsx';
import { ErrorState, LaneSkeleton } from '../components/States.jsx';
import { CaretLeftIcon, CaretRightIcon, CheckIcon, KanbanIcon, LockIcon, PencilIcon, PlusIcon, TrashIcon, WarningIcon } from '../components/Icons.jsx';
import NotFoundPage from './NotFoundPage.jsx';

export default function EquipoPage() {
  const equipoId = Number(useParams().id);
  const { usuario } = useAuth();
  const editable = usuario.equipo_id === equipoId;

  const cargar = useCallback(async () => {
    const [equipos, tareas, usuarios] = await Promise.all([
      api('/equipos'),
      api(`/tareas?equipo_id=${equipoId}`),
      api(`/equipos/${equipoId}/usuarios`),
    ]);
    return { equipo: equipos.find((e) => e.id === equipoId), tareas, usuarios };
  }, [equipoId]);

  const { data, error, refresh, updatedAt } = usePolling(cargar, POLLING_MS);
  const [dialogo, setDialogo] = useState(null); // { tipo: 'tarea' | 'eliminar', tarea? }
  const [accionError, setAccionError] = useState(null);
  const [aviso, setAviso] = useState(null);
  const [arrastrando, setArrastrando] = useState(null);
  const [destino, setDestino] = useState(null);
  const [colMovil, setColMovil] = useState('pendiente');

  useEffect(() => {
    if (!aviso) return undefined;
    const id = setTimeout(() => setAviso(null), 3500);
    return () => clearTimeout(id);
  }, [aviso]);

  if (!Number.isInteger(equipoId) || (data && !data.equipo)) return <NotFoundPage />;

  const ejecutar = async (accion, mensaje) => {
    setAccionError(null);
    try {
      await accion();
      await refresh();
      if (mensaje) setAviso(mensaje);
    } catch (err) {
      setAccionError(err.message);
    }
  };

  const mover = (tarea, estado) => {
    if (tarea.estado === estado) return;
    ejecutar(() => api(`/tareas/${tarea.id}`, { method: 'PATCH', body: { estado } }));
  };

  const guardar = async (datos) => {
    const tarea = dialogo.tarea;
    if (tarea) {
      await api(`/tareas/${tarea.id}`, { method: 'PATCH', body: datos });
    } else {
      await api('/tareas', { method: 'POST', body: datos });
    }
    setDialogo(null);
    await refresh();
    setAviso(tarea ? 'Cambios guardados' : `Tarea creada en ${ESTADOS.find((e) => e.key === datos.estado).titulo}`);
  };

  const eliminar = async () => {
    await api(`/tareas/${dialogo.tarea.id}`, { method: 'DELETE' });
    setDialogo(null);
    await refresh();
    setAviso('Tarea eliminada');
  };

  const equipo = data?.equipo;
  const abiertas = data?.tareas.filter((t) => t.estado !== 'completada').length ?? 0;
  const tableroVacio = data && data.tareas.length === 0;

  return (
    <>
      <div className="page-head">
        <div className="page-head-text">
          <div className="eyebrow">
            {equipo && <span className="team-mark-lg" style={{ background: equipo.color_hex }} />}
            <h6 className="muted">{editable ? 'Tu equipo' : 'Otro equipo'}</h6>
          </div>
          <h2>{equipo?.nombre || 'Cargando…'}</h2>
          {data && (
            <p className="muted" style={{ fontSize: 14 }}>
              {abiertas === 1 ? '1 tarea abierta' : `${abiertas} tareas abiertas`}
              {editable && !tableroVacio && '. Usa las flechas o arrastra una tarjeta para cambiar su estado'}.
            </p>
          )}
        </div>
        {editable ? (
          <button type="button" className="btn btn-primary btn-lg" onClick={() => setDialogo({ tipo: 'tarea' })}>
            <PlusIcon /> Nueva tarea
          </button>
        ) : (
          <Link to={`/equipo/${usuario.equipo_id}`} className="btn btn-secondary btn-lg">Ir a mi equipo</Link>
        )}
      </div>

      {!editable && equipo && (
        <div className="notice" role="note">
          <LockIcon style={{ color: 'var(--color-accent)' }} />
          <span>
            <strong style={{ fontWeight: 500 }}>Solo lectura.</strong>{' '}
            <span className="muted">Únicamente {equipo.nombre} puede crear, mover o editar estas tareas.</span>
          </span>
        </div>
      )}

      {error && <ErrorState onRetry={refresh} conDatos={Boolean(data)} />}
      {accionError && (
        <div className="notice-alert" role="alert">
          <WarningIcon /> {accionError}
        </div>
      )}

      {tableroVacio && editable ? (
        <div className="empty-state">
          <KanbanIcon size={32} strokeWidth={12} style={{ color: 'var(--color-accent)' }} />
          <h4>Tu tablero está vacío</h4>
          <p className="muted" style={{ margin: 0, fontSize: 14 }}>
            Crea la primera tarea de {equipo.nombre}. Los demás equipos la verán en la vista global.
          </p>
          <button type="button" className="btn btn-primary btn-lg" onClick={() => setDialogo({ tipo: 'tarea' })}>Nueva tarea</button>
        </div>
      ) : (
        <>
          <div className="lane-tabs">
            <div className="seg" role="radiogroup" aria-label="Columna">
              {ESTADOS.map((col) => (
                <label key={col.key} className="seg-opt">
                  <input type="radio" name="col-movil" checked={colMovil === col.key} onChange={() => setColMovil(col.key)} />
                  {col.titulo} <span className="muted">{data?.tareas.filter((t) => t.estado === col.key).length ?? ''}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="lanes">
            {ESTADOS.map((col, ci) => {
              const tareas = data?.tareas.filter((t) => t.estado === col.key) || [];
              const soltar = editable
                ? {
                    onDragOver: (e) => {
                      e.preventDefault();
                      setDestino(col.key);
                    },
                    onDragLeave: () => setDestino((d) => (d === col.key ? null : d)),
                    onDrop: (e) => {
                      e.preventDefault();
                      const tarea = data.tareas.find((t) => t.id === Number(e.dataTransfer.getData('text/plain')));
                      setArrastrando(null);
                      setDestino(null);
                      if (tarea) mover(tarea, col.key);
                    },
                  }
                : {};
              return (
                <section key={col.key} aria-label={col.titulo}
                  className={`lane ${destino === col.key && arrastrando ? 'drop-target' : ''} ${colMovil === col.key ? '' : 'oculta-movil'}`} {...soltar}>
                  <div className="lane-head">
                    <div>
                      <span className={`state-dot state-${col.key}`} />
                      <h6>{col.titulo}</h6>
                    </div>
                    <span className="tag tag-neutral">{data ? tareas.length : '–'}</span>
                  </div>
                  {!data && !error && <LaneSkeleton />}
                  {data && tareas.length === 0 && <p className="lane-empty muted">Sin tareas aquí</p>}
                  {tareas.map((t) => (
                    <TaskCard
                      key={t.id}
                      tarea={t}
                      draggable={editable}
                      className={`${editable ? 'draggable' : ''} ${arrastrando === t.id ? 'dragging' : ''}`}
                      onDragStart={(e) => {
                        e.dataTransfer.setData('text/plain', String(t.id));
                        e.dataTransfer.effectAllowed = 'move';
                        setArrastrando(t.id);
                      }}
                      onDragEnd={() => {
                        setArrastrando(null);
                        setDestino(null);
                      }}
                      acciones={
                        editable && (
                          <div className="task-actions">
                            <button type="button" className="btn btn-icon icon-btn" aria-label={`Mover "${t.titulo}" a ${ESTADOS[ci - 1]?.titulo || ''}`}
                              disabled={ci === 0} onClick={() => mover(t, ESTADOS[ci - 1].key)}>
                              <CaretLeftIcon />
                            </button>
                            <button type="button" className="btn btn-icon icon-btn" aria-label={`Mover "${t.titulo}" a ${ESTADOS[ci + 1]?.titulo || ''}`}
                              disabled={ci === ESTADOS.length - 1} onClick={() => mover(t, ESTADOS[ci + 1].key)}>
                              <CaretRightIcon />
                            </button>
                            <button type="button" className="btn btn-icon icon-btn" aria-label={`Editar "${t.titulo}"`} onClick={() => setDialogo({ tipo: 'tarea', tarea: t })}>
                              <PencilIcon />
                            </button>
                            <button type="button" className="btn btn-icon icon-btn" aria-label={`Eliminar "${t.titulo}"`} onClick={() => setDialogo({ tipo: 'eliminar', tarea: t })}>
                              <TrashIcon />
                            </button>
                          </div>
                        )
                      }
                    />
                  ))}
                </section>
              );
            })}
          </div>
        </>
      )}

      {updatedAt && (
        <p className="muted" style={{ margin: 0, fontSize: 12 }}>
          Se actualiza cada {POLLING_MS / 1000} segundos. Última actualización: {updatedAt.toLocaleTimeString('es-MX')}
        </p>
      )}

      {dialogo?.tipo === 'tarea' && (
        <TaskDialog tarea={dialogo.tarea} equipoNombre={equipo?.nombre} usuarios={data?.usuarios || []} onGuardar={guardar} onCancelar={() => setDialogo(null)} />
      )}
      {dialogo?.tipo === 'eliminar' && (
        <ConfirmDialog tarea={dialogo.tarea} equipoNombre={equipo?.nombre} onConfirmar={eliminar} onCancelar={() => setDialogo(null)} />
      )}
      {aviso && (
        <div className="toast" role="status">
          <CheckIcon style={{ color: 'var(--color-accent)' }} /> {aviso}
        </div>
      )}
    </>
  );
}
