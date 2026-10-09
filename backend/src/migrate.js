const fs = require('fs/promises');
const path = require('path');
const bcrypt = require('bcryptjs');

const MIGRATIONS_DIR = path.join(__dirname, '..', 'migrations');
// Identificador arbitrario del advisory lock: con varias réplicas solo una migra a la vez.
const LOCK_ID = 7274201;

async function runMigrations(pool, { dir = MIGRATIONS_DIR, log = console.log } = {}) {
  const client = await pool.connect();
  try {
    await client.query('SELECT pg_advisory_lock($1)', [LOCK_ID]);
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version TEXT PRIMARY KEY,
        aplicada_en TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`);

    const { rows } = await client.query('SELECT version FROM schema_migrations');
    const applied = new Set(rows.map((r) => r.version));
    const files = (await fs.readdir(dir)).filter((f) => /^\d+_.+\.sql$/.test(f)).sort();

    for (const file of files) {
      if (applied.has(file)) continue;
      const sql = await fs.readFile(path.join(dir, file), 'utf8');
      try {
        await client.query('BEGIN');
        await client.query(sql);
        await client.query('INSERT INTO schema_migrations (version) VALUES ($1)', [file]);
        await client.query('COMMIT');
        log(`[migrate] Aplicada ${file}`);
      } catch (err) {
        await client.query('ROLLBACK');
        throw new Error(`Migración ${file} falló: ${err.message}`);
      }
    }
  } finally {
    await client.query('SELECT pg_advisory_unlock($1)', [LOCK_ID]).catch(() => {});
    client.release();
  }
}

// Solo para desarrollo: asigna SEED_USER_PASSWORD a usuarios sin contraseña.
async function seedPasswords(pool, password, { rounds = 12, log = console.log } = {}) {
  if (!password) return 0;
  const { rows } = await pool.query('SELECT id FROM usuarios WHERE password_hash IS NULL');
  for (const { id } of rows) {
    const hash = await bcrypt.hash(password, rounds);
    await pool.query('UPDATE usuarios SET password_hash = $1 WHERE id = $2 AND password_hash IS NULL', [hash, id]);
  }
  if (rows.length) log(`[migrate] Contraseña de desarrollo asignada a ${rows.length} usuario(s)`);
  return rows.length;
}

module.exports = { runMigrations, seedPasswords };
