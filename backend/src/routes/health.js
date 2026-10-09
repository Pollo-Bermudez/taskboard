const express = require('express');

function healthRouter({ pool, cache, isReady = () => true }) {
  const router = express.Router();

  // Liveness: solo verifica que el proceso responde.
  router.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok' });
  });

  // Readiness: migraciones aplicadas + conexión con PostgreSQL. 503 saca al Pod del balanceo sin reiniciarlo.
  router.get('/ready', async (req, res) => {
    if (!isReady()) {
      return res.status(503).json({ status: 'starting' });
    }
    try {
      await pool.query('SELECT 1');
      res.status(200).json({ status: 'ready' });
    } catch (err) {
      console.error('[ready] Sin conexión con PostgreSQL:', err.message);
      res.status(503).json({ status: 'unavailable' });
    }
  });

  // Caché: PING a Redis. Informativo; no forma parte de la readiness para que una caída
  // de Redis no saque de servicio a la API.
  router.get('/cache', async (req, res) => {
    if (!cache) return res.status(503).json({ status: 'unavailable' });
    try {
      if (!cache.isReady) throw new Error('cliente de Redis no conectado');
      const pong = await cache.ping();
      if (pong !== 'PONG') throw new Error(`respuesta inesperada: ${pong}`);
      res.status(200).json({ status: 'cache-ready' });
    } catch (err) {
      console.error('[cache] PING falló:', err.message);
      res.status(503).json({ status: 'unavailable' });
    }
  });

  return router;
}

module.exports = { healthRouter };
