const express = require('express');
const cookieParser = require('cookie-parser');
const { createAuth } = require('./auth');
const { requireAuth } = require('./middleware/auth');
const { healthRouter } = require('./routes/health');
const { authRouter } = require('./routes/auth');
const { equiposRouter } = require('./routes/equipos');
const { tareasRouter } = require('./routes/tareas');
const { notFound, errorHandler } = require('./middleware/errorHandler');

function createApp({ pool, config, isReady }) {
  const app = express();
  const auth = createAuth(config);

  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.use(express.json({ limit: '100kb' }));
  app.use(cookieParser());

  // Públicas: probes y autenticación.
  app.use('/api', healthRouter({ pool, isReady }));
  app.use('/api/auth', authRouter({ pool, auth, bcryptRounds: config.bcryptRounds }));
  app.get('/api', (req, res) => {
    res.status(200).json({ name: 'TaskBoard API', version: '1.0.0' });
  });

  // Protegidas: requieren access token válido.
  app.use('/api/equipos', requireAuth(auth), equiposRouter({ pool }));
  app.use('/api/tareas', requireAuth(auth), tareasRouter({ pool }));

  app.use(notFound);
  app.use(errorHandler);

  return app;
}

module.exports = { createApp };
