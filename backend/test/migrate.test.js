const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { runMigrations, seedPasswords } = require('../src/migrate');
const { HAS_DB, createTestDatabase } = require('./db');

const opts = { skip: !HAS_DB && 'requiere PostgreSQL (docker compose --profile test)' };
let db;

before(async () => { if (HAS_DB) db = await createTestDatabase(); });
after(async () => { if (db) await db.drop(); });

test('migraciones quedan registradas y son idempotentes', opts, async () => {
  await runMigrations(db.pool, { log: () => {} });
  await Promise.all([runMigrations(db.pool, { log: () => {} }), runMigrations(db.pool, { log: () => {} })]);
  const { rows } = await db.pool.query('SELECT version FROM schema_migrations');
  assert.deepEqual(rows.map((r) => r.version), ['001_auth.sql', '002_correo_unico_insensible.sql', '003_login_intentos.sql']);
});

test('seed asigna hash bcrypt, nunca texto plano', opts, async () => {
  const { rows } = await db.pool.query('SELECT password_hash FROM usuarios');
  assert.ok(rows.length > 0);
  for (const { password_hash: hash } of rows) {
    assert.match(hash, /^\$2[aby]\$/);
  }
  assert.equal(await seedPasswords(db.pool, 'otra', { rounds: 4, log: () => {} }), 0);
});

test('actualizado_en cambia al actualizar una tarea', opts, async () => {
  const { rows: [antes] } = await db.pool.query('SELECT id, actualizado_en FROM tareas ORDER BY id LIMIT 1');
  await db.pool.query("UPDATE tareas SET titulo = titulo || '' WHERE id = $1", [antes.id]);
  const { rows: [despues] } = await db.pool.query('SELECT actualizado_en FROM tareas WHERE id = $1', [antes.id]);
  assert.ok(despues.actualizado_en > antes.actualizado_en);
});
