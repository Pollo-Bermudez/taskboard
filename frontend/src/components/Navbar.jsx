import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.jsx';

function iniciales(nombre) {
  return nombre.split(' ').slice(0, 2).map((p) => p[0]).join('').toUpperCase();
}

export default function Navbar() {
  const { usuario, logout } = useAuth();
  const navigate = useNavigate();

  const onLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <header className="navbar">
      <div className="navbar-brand">
        <div className="brand-icon">📋</div>
        <div>
          <h1 className="brand-title">TaskBoard</h1>
          <span className="brand-subtitle">Control de Tareas por Equipo</span>
        </div>
      </div>

      {usuario && (
        <>
          <nav className="navbar-links">
            <NavLink to={`/equipo/${usuario.equipo_id}`} className="nav-link">
              Mi equipo
            </NavLink>
            <NavLink to="/global" className="nav-link">
              Vista global
            </NavLink>
          </nav>
          <div className="navbar-user">
            <div className="team-pill">
              <span className="team-dot" style={{ background: usuario.equipo_color }}></span>
              <span>{usuario.equipo_nombre}</span>
            </div>
            <div className="user-profile">
              <div className="user-avatar">{iniciales(usuario.nombre)}</div>
              <div className="user-info">
                <span className="user-name">{usuario.nombre}</span>
                <span className="user-role">{usuario.rol}</span>
              </div>
            </div>
            <button className="btn-secondary" onClick={onLogout}>
              Salir
            </button>
          </div>
        </>
      )}
    </header>
  );
}
