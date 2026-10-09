import { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.jsx';
import { LogoIcon, WarningIcon } from '../components/Icons.jsx';

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
      setError(err.status === 401 ? 'Correo o contraseña incorrectos.' : err.message);
      setEnviando(false);
    }
  };

  return (
    <div className="login">
      <main className="login-main">
        <div className="eyebrow">
          <LogoIcon width={26} height={26} />
          <span className="nav-brand" style={{ margin: 0, fontSize: 20 }}>TaskBoard</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <h1>Inicia sesión</h1>
          <p className="muted" style={{ fontSize: 15, maxWidth: 380 }}>
            Cada equipo trabaja en su propio tablero y todos pueden ver lo que hacen los demás.
          </p>
        </div>
        <form className="login-form" onSubmit={onSubmit}>
          {error && (
            <div className="notice-alert" role="alert">
              <WarningIcon /> {error}
            </div>
          )}
          <div className="field">
            <label htmlFor="correo">Correo</label>
            <input id="correo" className="input" type="email" autoComplete="username" value={correo} onChange={(e) => setCorreo(e.target.value)} required />
          </div>
          <div className="field">
            <label htmlFor="clave">Contraseña</label>
            <input id="clave" className="input" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          <button type="submit" className="btn btn-primary btn-block" style={{ minHeight: 42 }} disabled={enviando}>
            {enviando ? 'Entrando…' : 'Entrar'}
          </button>
          <p className="muted" style={{ margin: 0, fontSize: 12 }}>La sesión dura 3 días y se renueva sola mientras la uses.</p>
        </form>
      </main>
    </div>
  );
}
