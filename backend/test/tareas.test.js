const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { createApp } = require('../src/app');
const { TEST_CONFIG } = require('./helpers');
const { HAS_DB, USUARIOS, createTestDatabase, loginAgent } = require('./db');

const opts = { skip: !HAS_DB && 'requiere PostgreSQL (docker compose --profile test)' };
let db;
let backend; // equipo 2
let devops; // equipo 1

// IDs de usuarios seed: 1 Hugo (eq. 1), 2 Francisco (eq. 2), 3 Ana (eq. 3), 4 Carlos (eq. 2).
before(async () => {
  if (!HAS_DB) return;
  db = await createTestDatabase();
  const app = createApp({ pool: db.pool, config: TEST_CONFIG });
  backend = await loginAgent(app, USUARIOS.backend);
  devops = await loginAgent(app, USUARIOS.devops);
});
after(async () => { if (db) await db.drop(); });

async function tareaDeEquipo(equipoId) {
  const { rows } = await db.pool.query('SELECT id FROM tareas WHERE equipo_id = $1 ORDER BY id LIMIT 1', [equipoId]);
  return rows[0].id;
}

test('GET /api/tareas?equipo_id filtra por equipo', opts, async () => {
  const res = await devops.get('/api/tareas?equipo_id=2');
  assert.equal(res.status, 200);
  assert.ok(res.body.length > 0);
  assert.ok(res.body.every((t) => t.equipo_id === 2));
});

test('GET /api/tareas con equipo_id inválido responde 400', opts, async () => {
  assert.equal((await backend.get('/api/tareas?equipo_id=abc')).status, 400);
  assert.equal((await backend.get('/api/tareas')).status, 400);
});

test('GET /api/equipos/:id/usuarios lista miembros', opts, async () => {
  const res = await backend.get('/api/equipos/2/usuarios');
  assert.equal(res.status, 200);
  assert.deepEqual(res.body.map((u) => u.id).sort(), [2, 4]);
});

test('POST crea tarea en el equipo propio con valores por defecto', opts, async () => {
  const res = await backend.post('/api/tareas').send({ titulo: '  Nueva tarea  ', asignado_a: 4 });
  assert.equal(res.status, 201);
  assert.equal(res.body.titulo, 'Nueva tarea');
  assert.equal(res.body.equipo_id, 2);
  assert.equal(res.body.estado, 'pendiente');
  assert.equal(res.body.prioridad, 'media');
  assert.equal(res.body.asignado_nombre, 'Carlos Mendoza');
});

test('POST en equipo ajeno responde 403', opts, async () => {
  const res = await backend.post('/api/tareas').send({ titulo: 'Intrusa', equipo_id: 1 });
  assert.equal(res.status, 403);
});

test('POST con datos inválidos responde 400 sin detalles internos', opts, async () => {
  for (const body of [{}, { titulo: '' }, { titulo: 'x', estado: 'borrada' }, { titulo: 'x', prioridad: 'urgente' }, { titulo: 'x'.repeat(201) }]) {
    const res = await backend.post('/api/tareas').send(body);
    assert.equal(res.status, 400, JSON.stringify(body));
    assert.doesNotMatch(JSON.stringify(res.body), /at |stack|pg/i);
  }
});

test('PATCH actualiza estado, descripción y responsable del propio equipo', opts, async () => {
  const id = await tareaDeEquipo(2);
  const res = await backend.patch(`/api/tareas/${id}`).send({ estado: 'en_revision', descripcion: 'Actualizada', asignado_a: 2 });
  assert.equal(res.status, 200);
  assert.equal(res.body.estado, 'en_revision');
  assert.equal(res.body.descripcion, 'Actualizada');
  assert.equal(res.body.asignado_a, 2);
});

test('PATCH permite quitar el responsable', opts, async () => {
  const id = await tareaDeEquipo(2);
  const res = await backend.patch(`/api/tareas/${id}`).send({ asignado_a: null });
  assert.equal(res.status, 200);
  assert.equal(res.body.asignado_a, null);
});

test('PATCH sobre tarea de otro equipo responde 403 y no la modifica', opts, async () => {
  const id = await tareaDeEquipo(1);
  const res = await backend.patch(`/api/tareas/${id}`).send({ estado: 'completada', titulo: 'hackeada' });
  assert.equal(res.status, 403);
  const { rows } = await db.pool.query('SELECT titulo FROM tareas WHERE id = $1', [id]);
  assert.notEqual(rows[0].titulo, 'hackeada');
});

test('PATCH reasignando a usuario de otro equipo responde 422', opts, async () => {
  const id = await tareaDeEquipo(2);
  const res = await backend.patch(`/api/tareas/${id}`).send({ asignado_a: 1 });
  assert.equal(res.status, 422);
});

test('PATCH sin campos válidos responde 400 y tarea inexistente 404', opts, async () => {
  const id = await tareaDeEquipo(2);
  assert.equal((await backend.patch(`/api/tareas/${id}`).send({ equipo_id: 1 })).status, 400);
  assert.equal((await backend.patch('/api/tareas/999999').send({ estado: 'pendiente' })).status, 404);
});

test('DELETE sobre tarea de otro equipo responde 403; propia responde 204', opts, async () => {
  const ajena = await tareaDeEquipo(1);
  assert.equal((await backend.delete(`/api/tareas/${ajena}`)).status, 403);

  const creada = await backend.post('/api/tareas').send({ titulo: 'Para borrar' });
  assert.equal((await backend.delete(`/api/tareas/${creada.body.id}`)).status, 204);
  assert.equal((await backend.delete(`/api/tareas/${creada.body.id}`)).status, 404);
});

test('la vista global refleja los cambios de todos los equipos', opts, async () => {
  const creada = await devops.post('/api/tareas').send({ titulo: 'Visible globalmente' });
  const res = await backend.get('/api/tareas/global');
  assert.ok(res.body.some((t) => t.id === creada.body.id && t.equipo_nombre === 'Equipo DevOps'));
});
