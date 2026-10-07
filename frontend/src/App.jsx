import { Navigate, Outlet, Route, Routes, useParams } from 'react-router-dom';
import { AuthProvider, RequireAuth, useAuth } from './auth/AuthContext.jsx';
import Sidebar from './components/Sidebar.jsx';
import LoginPage from './pages/LoginPage.jsx';
import GlobalPage from './pages/GlobalPage.jsx';
import EquipoPage from './pages/EquipoPage.jsx';
import NotFoundPage from './pages/NotFoundPage.jsx';

function Inicio() {
  const { usuario } = useAuth();
  return <Navigate to={`/equipo/${usuario.equipo_id}`} replace />;
}

// key por equipo: al cambiar de /equipo/2 a /equipo/1 se monta una página nueva
// y no se muestran (ni se editan) las tareas del equipo anterior.
function EquipoRoute() {
  const { id } = useParams();
  return <EquipoPage key={id} />;
}

function Shell() {
  return (
    <RequireAuth>
      <div className="shell">
        <Sidebar />
        <main className="shell-main">
          <Outlet />
        </main>
      </div>
    </RequireAuth>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<Shell />}>
          <Route path="/" element={<Inicio />} />
          <Route path="/global" element={<GlobalPage />} />
          <Route path="/equipo/:id" element={<EquipoRoute />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </AuthProvider>
  );
}
