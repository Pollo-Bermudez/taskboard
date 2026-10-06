import React, { useState, useEffect } from 'react';

export default function App() {
  const [healthStatus, setHealthStatus] = useState('Verificando...');
  const [readyStatus, setReadyStatus] = useState('Verificando...');
  const [loading, setLoading] = useState(false);

  const checkStatus = async () => {
    setLoading(true);
    try {
      const resHealth = await fetch('/api/health');
      if (resHealth.ok) {
        const dataHealth = await resHealth.json();
        setHealthStatus(dataHealth.status || 'ok');
      } else {
        setHealthStatus(`Error (${resHealth.status})`);
      }
    } catch (err) {
      setHealthStatus('Inalcanzable');
    }

    try {
      const resReady = await fetch('/api/ready');
      if (resReady.ok) {
        const dataReady = await resReady.json();
        setReadyStatus(dataReady.status || 'ready');
      } else {
        setReadyStatus(`Error (${resReady.status})`);
      }
    } catch (err) {
      setReadyStatus('Inalcanzable');
    }
    setLoading(false);
  };

  useEffect(() => {
    checkStatus();
  }, []);

  return (
    <div className="container">
      <header className="header">
        <h1>TaskBoard - Demo</h1>
        <p className="subtitle">
          Sistema de Control de Tareas para Equipos de Desarrollo de Software
        </p>
      </header>

      <main className="content">
        <section className="card">
          <h2>Estado del Sistema</h2>
          <div className="status-grid">
            <div className="status-item">
              <span className="label">Frontend (React + NGINX):</span>
              <span className="badge badge-success">Activo</span>
            </div>
            <div className="status-item">
              <span className="label">API Backend (/api/health):</span>
              <span className={`badge ${healthStatus === 'ok' ? 'badge-success' : 'badge-warning'}`}>
                {healthStatus}
              </span>
            </div>
            <div className="status-item">
              <span className="label">PostgreSQL (/api/ready):</span>
              <span className={`badge ${readyStatus === 'ready' ? 'badge-success' : 'badge-warning'}`}>
                {readyStatus}
              </span>
            </div>
          </div>

          <div className="actions">
            <button onClick={checkStatus} disabled={loading} className="btn">
              {loading ? 'Consultando...' : 'Reintentar Verificación'}
            </button>
          </div>
        </section>

        <section className="card info-card">
          <h3>Arquitectura de Tres Capas</h3>
          <ul>
            <li><strong>Frontend:</strong> React 18 servido mediante NGINX 1.27 en puerto 8080.</li>
            <li><strong>Backend:</strong> Node.js 20 Express en puerto 3000 (red interna y pública).</li>
            <li><strong>Base de Datos:</strong> PostgreSQL 16 con persistencia en volumen nombrado (red interna aislada).</li>
          </ul>
        </section>
      </main>
    </div>
  );
}
