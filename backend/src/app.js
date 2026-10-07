const express = require('express');
const { healthRouter } = require('./routes/health');
const { notFound, errorHandler } = require('./middleware/errorHandler');

function createApp({ pool, config }) {
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.use(express.json({ limit: '100kb' }));

  app.use('/api', healthRouter({ pool }));

  app.get('/api', (req, res) => {
    res.status(200).json({ name: 'TaskBoard API', version: '1.0.0' });
  });

  app.use(notFound);
  app.use(errorHandler);

  app.locals.config = config;
  return app;
}

module.exports = { createApp };
