require('dotenv').config();

const { loadConfig } = require('./config');
const { createPool } = require('./db');
const { createApp } = require('./app');

let config;
try {
  config = loadConfig();
} catch (err) {
  console.error(`[TaskBoard Backend] ${err.message}`);
  process.exit(1);
}

const pool = createPool(config.db);
const app = createApp({ pool, config });

const server = app.listen(config.port, '0.0.0.0', () => {
  console.log(`[TaskBoard Backend] Servidor ejecutándose en el puerto ${config.port}`);
});

// Apagado ordenado: Kubernetes envía SIGTERM antes de eliminar el Pod.
function shutdown(signal) {
  console.log(`[TaskBoard Backend] ${signal} recibido, cerrando...`);
  server.close(() => {
    pool.end().finally(() => process.exit(0));
  });
  setTimeout(() => process.exit(1), 10000).unref();
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
