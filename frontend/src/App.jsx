import { NavLink, Navigate, Route, Routes } from 'react-router-dom';
import GlobalPage from './pages/GlobalPage.jsx';
import NotFoundPage from './pages/NotFoundPage.jsx';
import StatusWidget from './components/StatusWidget.jsx';

export default function App() {
  return (
    <div className="app-layout">
      <header className="navbar">
        <div className="navbar-brand">
          <div className="brand-icon">📋</div>
          <div>
            <h1 className="brand-title">TaskBoard</h1>
            <span className="brand-subtitle">Control de Tareas por Equipo</span>
          </div>
        </div>
        <nav className="navbar-links">
          <NavLink to="/global" className="nav-link">
            Vista global
          </NavLink>
        </nav>
      </header>

      <Routes>
        <Route path="/" element={<Navigate to="/global" replace />} />
        <Route path="/global" element={<GlobalPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>

      <StatusWidget />
    </div>
  );
}
