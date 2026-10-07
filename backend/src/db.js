const { Pool } = require('pg');

function createPool(dbConfig) {
  const pool = new Pool({ ...dbConfig, connectionTimeoutMillis: 3000 });
  pool.on('error', (err) => {
    console.error('[db] Error inesperado en cliente inactivo del pool:', err.message);
  });
  return pool;
}

module.exports = { createPool };
