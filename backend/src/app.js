const express = require('express');
const { healthRouter } = require('./routes/health');
const { equiposRouter } = require('./routes/equipos');
const { tareasRouter } = require('./routes/tareas');
const { notFound, errorHandler } = require('./middleware/errorHandler');

function createApp({ pool, config, isReady }) {
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.use(express.json({ limit: '100kb' }));

  app.use('/api', healthRouter({ pool, isReady }));
  app.use('/api/equipos', equiposRouter({ pool }));
  app.use('/api/tareas', tareasRouter({ pool }));

  app.get('/api', (req, res) => {
    res.status(200).json({ name: 'TaskBoard API', version: '1.0.0' });
  });

  app.use(notFound);
  app.use(errorHandler);

  app.locals.config = config;
  return app;
}

module.exports = { createApp };
