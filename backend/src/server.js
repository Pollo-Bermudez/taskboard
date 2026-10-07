require('dotenv').config();

const { loadConfig } = require('./config');
const { createPool } = require('./db');
const { createApp } = require('./app');
const { runMigrations, seedPasswords } = require('./migrate');

let config;
try {
  config = loadConfig();
} catch (err) {
  console.error(`[TaskBoard Backend] ${err.message}`);
  process.exit(1);
}

const pool = createPool(config.db);
let ready = false;
const app = createApp({ pool, config, isReady: () => ready });

// Se escucha antes de migrar: liveness responde de inmediato y readiness
// devuelve 503 hasta que la base de datos esté migrada.
const server = app.listen(config.port, '0.0.0.0', () => {
  console.log(`[TaskBoard Backend] Servidor ejecutándose en el puerto ${config.port}`);
});

async function prepareDatabase(attempt = 1) {
  try {
    await runMigrations(pool);
    await seedPasswords(pool, config.seedUserPassword, { rounds: config.bcryptRounds });
    ready = true;
    console.log('[TaskBoard Backend] Base de datos lista');
  } catch (err) {
    const delay = Math.min(1000 * 2 ** (attempt - 1), 15000);
    console.error(`[TaskBoard Backend] Preparación de BD falló (intento ${attempt}): ${err.message}. Reintento en ${delay} ms`);
    setTimeout(() => prepareDatabase(attempt + 1), delay).unref();
  }
}
prepareDatabase();

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
