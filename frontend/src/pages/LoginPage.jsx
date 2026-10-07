import { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.jsx';

export default function LoginPage() {
  const { usuario, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [correo, setCorreo] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [enviando, setEnviando] = useState(false);

  if (usuario) return <Navigate to={`/equipo/${usuario.equipo_id}`} replace />;

  const onSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setEnviando(true);
    try {
      const u = await login(correo, password);
      navigate(location.state?.from || `/equipo/${u.equipo_id}`, { replace: true });
    } catch (err) {
      setError(err.message);
      setEnviando(false);
    }
  };

  return (
    <main className="login-container">
      <form className="login-card" onSubmit={onSubmit}>
        <div className="brand-icon">📋</div>
        <h2 className="board-title">Iniciar sesión</h2>
        <p className="board-description">Accede al tablero de tu equipo.</p>

        {error && <div className="alert alert-error">{error}</div>}

        <label className="field">
          <span>Correo</span>
          <input type="email" autoComplete="username" value={correo} onChange={(e) => setCorreo(e.target.value)} required />
        </label>
        <label className="field">
          <span>Contraseña</span>
          <input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </label>
        <button className="btn-primary" type="submit" disabled={enviando}>
          {enviando ? 'Entrando…' : 'Entrar'}
        </button>
      </form>
    </main>
  );
}
