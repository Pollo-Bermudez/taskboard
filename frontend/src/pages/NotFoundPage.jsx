import { Link } from 'react-router-dom';

export default function NotFoundPage() {
  return (
    <div className="empty-state">
      <span className="big-404" aria-hidden="true">404</span>
      <h4>Este equipo o página no existe</h4>
      <p className="muted" style={{ margin: 0, fontSize: 14 }}>Revisa el enlace o vuelve a la vista global.</p>
      <Link to="/global" className="btn btn-secondary" style={{ minHeight: 36, padding: '0 14px' }}>Ir a la vista global</Link>
    </div>
  );
}
