import { useCallback, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { api } from '../api/client.js';
import { useAuth } from '../auth/AuthContext.jsx';
import { usePolling } from '../hooks/usePolling.js';
import { POLLING_MS } from '../constants.js';
import { iniciales } from './TaskCard.jsx';
import { GridIcon, KanbanIcon, ListIcon, LogoIcon, SignOutIcon } from './Icons.jsx';

async function sondaOk(ruta) {
  try {
    return (await fetch(ruta)).ok;
  } catch {
    return false;
  }
}

export default function Sidebar() {
  const { usuario, logout } = useAuth();
  const navigate = useNavigate();
  const [menuAbierto, setMenuAbierto] = useState(false);

  const cargar = useCallback(async () => {
    const [equipos, tareas, listo, cache] = await Promise.all([api('/equipos'), api('/tareas/global'), sondaOk('/api/ready'), sondaOk('/api/cache')]);
    const abiertas = (id) => tareas.filter((t) => t.equipo_id === id && t.estado !== 'completada').length;
    return { equipos: equipos.map((e) => ({ ...e, abiertas: abiertas(e.id) })), listo, cache };
  }, []);
  const { data, error } = usePolling(cargar, POLLING_MS);
  const operativo = data?.listo && data?.cache && !error;
  const estado = !data
    ? 'Comprobando servicios…'
    : operativo
      ? 'API, base de datos y caché operativas'
      : !data.listo
        ? 'Base de datos no disponible'
        : 'Caché no disponible';

  const salir = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  const cerrarMenu = () => setMenuAbierto(false);

  return (
    <aside className={`sidebar ${menuAbierto ? 'menu-abierto' : ''}`}>
      <div className="sidebar-top">
        <LogoIcon />
        <span className="nav-brand">TaskBoard</span>
        <button type="button" className="btn btn-icon icon-btn sidebar-menu-btn" aria-label={menuAbierto ? 'Cerrar menú' : 'Abrir menú'}
          aria-expanded={menuAbierto} onClick={() => setMenuAbierto(!menuAbierto)}>
          <ListIcon />
        </button>
      </div>

      <nav aria-label="Principal" className="sidebar-section sidebar-nav">
        <NavLink to={`/equipo/${usuario.equipo_id}`} className="side-link" onClick={cerrarMenu}>
          <KanbanIcon /> Mi equipo
        </NavLink>
        <NavLink to="/global" className="side-link" onClick={cerrarMenu}>
          <GridIcon /> Vista global
        </NavLink>
      </nav>

      <div className="sidebar-section sidebar-extra">
        <h6 className="muted">Equipos</h6>
        {data?.equipos.map((e) => (
          <NavLink key={e.id} to={`/equipo/${e.id}`} className="side-link" onClick={cerrarMenu}>
            <span className="team-mark" style={{ background: e.color_hex }} />
            <span className="grow">{e.nombre}</span>
            <span className="count muted" aria-label={`${e.abiertas} tareas abiertas`}>{e.abiertas}</span>
          </NavLink>
        ))}
      </div>

      <div className="sidebar-bottom sidebar-extra">
        <div className="status-line muted" role="status">
          <span className={`status-dot ${operativo ? 'ok' : 'mal'}`} />
          {estado}
        </div>
        <div className="user-chip">
          <span className="avatar avatar-lg" aria-hidden="true">{iniciales(usuario.nombre)}</span>
          <div className="user-chip-text">
            <span>{usuario.nombre}</span>
            <span className="muted">{usuario.rol}</span>
          </div>
          <button type="button" className="btn btn-icon icon-btn" aria-label="Cerrar sesión" style={{ width: 32, height: 32 }} onClick={salir}>
            <SignOutIcon />
          </button>
        </div>
      </div>
    </aside>
  );
}
