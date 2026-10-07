const express = require('express');

function healthRouter({ pool, isReady = () => true }) {
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

  return router;
}

module.exports = { healthRouter };
