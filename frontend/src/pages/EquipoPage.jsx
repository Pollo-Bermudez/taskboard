import { useParams } from 'react-router-dom';

// Se completa en T8 (lectura) y T10 (interacción).
export default function EquipoPage() {
  const { id } = useParams();
  return (
    <main className="board-container">
      <h2 className="board-title">Tablero del equipo {id}</h2>
    </main>
  );
}
