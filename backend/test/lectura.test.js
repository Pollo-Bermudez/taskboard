const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const { createApp } = require('../src/app');
const { TEST_CONFIG } = require('./helpers');
const { HAS_DB, createTestDatabase, loginAgent, USUARIOS } = require('./db');

const opts = { skip: !HAS_DB && 'requiere PostgreSQL (docker compose --profile test)' };
let db;
let app;
let agent;

before(async () => {
  if (!HAS_DB) return;
  db = await createTestDatabase();
  app = createApp({ pool: db.pool, config: TEST_CONFIG });
  agent = await loginAgent(app, USUARIOS.frontend);
});
after(async () => { if (db) await db.drop(); });

test('GET /api/equipos devuelve el catálogo', opts, async () => {
  const res = await agent.get('/api/equipos');
  assert.equal(res.status, 200);
  assert.equal(res.body.length, 3);
  assert.deepEqual(Object.keys(res.body[0]).sort(), ['color_hex', 'id', 'nombre']);
});

test('GET /api/tareas/global incluye tareas de todos los equipos con nombres', opts, async () => {
  const res = await agent.get('/api/tareas/global');
  assert.equal(res.status, 200);
  const equipos = new Set(res.body.map((t) => t.equipo_id));
  assert.equal(equipos.size, 3);
  const tarea = res.body[0];
  assert.ok(tarea.equipo_nombre);
  assert.ok(tarea.equipo_color);
  assert.ok('asignado_nombre' in tarea);
  assert.ok(!('password_hash' in tarea));
});

test('endpoints de lectura requieren sesión', opts, async () => {
  assert.equal((await request(app).get('/api/equipos')).status, 401);
  assert.equal((await request(app).get('/api/tareas/global')).status, 401);
});
