import { Navigate, Route, Routes, useParams } from 'react-router-dom';
import { AuthProvider, RequireAuth, useAuth } from './auth/AuthContext.jsx';
import Navbar from './components/Navbar.jsx';
import StatusWidget from './components/StatusWidget.jsx';
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

export default function App() {
  return (
    <AuthProvider>
      <div className="app-layout">
        <Navbar />
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={<RequireAuth><Inicio /></RequireAuth>} />
          <Route path="/global" element={<RequireAuth><GlobalPage /></RequireAuth>} />
          <Route path="/equipo/:id" element={<RequireAuth><EquipoRoute /></RequireAuth>} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
        <StatusWidget />
      </div>
    </AuthProvider>
  );
}
