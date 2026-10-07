import { Link } from 'react-router-dom';

export default function NotFoundPage() {
  return (
    <main className="board-container">
      <h2 className="board-title">Página no encontrada</h2>
      <p className="board-description">
        <Link to="/global">Ir a la vista global</Link>
      </p>
    </main>
  );
}
