const { test } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const { createApp } = require('../src/app');
const { loadConfig } = require('../src/config');
const { TEST_CONFIG, fakePool } = require('./helpers');

test('GET /api/health responde 200', async () => {
  const app = createApp({ pool: fakePool(), config: TEST_CONFIG });
  const res = await request(app).get('/api/health');
  assert.equal(res.status, 200);
  assert.deepEqual(res.body, { status: 'ok' });
});

test('GET /api/ready responde 200 con base de datos disponible', async () => {
  const app = createApp({ pool: fakePool(), config: TEST_CONFIG });
  const res = await request(app).get('/api/ready');
  assert.equal(res.status, 200);
});

test('GET /api/ready responde 503 sin exponer el error interno', async () => {
  const app = createApp({ pool: fakePool({ fail: true }), config: TEST_CONFIG });
  const res = await request(app).get('/api/ready');
  assert.equal(res.status, 503);
  assert.doesNotMatch(JSON.stringify(res.body), /ECONNREFUSED|10\.0\.0\.1/);
});

test('ruta inexistente responde 404 JSON', async () => {
  const app = createApp({ pool: fakePool(), config: TEST_CONFIG });
  const res = await request(app).get('/api/no-existe');
  assert.equal(res.status, 404);
  assert.ok(res.body.error);
});

test('JSON malformado responde 400', async () => {
  const app = createApp({ pool: fakePool(), config: TEST_CONFIG });
  const res = await request(app).post('/api/health').set('Content-Type', 'application/json').send('{malo');
  assert.equal(res.status, 400);
});

test('loadConfig falla si falta JWT_SECRET', () => {
  assert.throws(
    () => loadConfig({ DB_HOST: 'db', DB_NAME: 'x', DB_USER: 'u', DB_PASSWORD: 'p' }),
    /JWT_SECRET/,
  );
});

test('loadConfig rechaza JWT_SECRET débil en producción', () => {
  const base = { DB_HOST: 'db', DB_NAME: 'x', DB_USER: 'u', DB_PASSWORD: 'p', NODE_ENV: 'production' };
  assert.throws(() => loadConfig({ ...base, JWT_SECRET: 'corta' }), /32/);
  assert.throws(() => loadConfig({ ...base, JWT_SECRET: 'tu_clave_secreta_jwt_aqui_cambiala_en_produccion' }), /32/);
  assert.ok(loadConfig({ ...base, JWT_SECRET: 'a'.repeat(64) }));
});

test('refresh con la base de datos caída responde 500 sin tumbar el proceso', async () => {
  const app = createApp({ pool: fakePool({ fail: true }), config: TEST_CONFIG });
  const res = await request(app).post('/api/auth/refresh').set('Cookie', 'tb_refresh=abc');
  assert.equal(res.status, 500);
  assert.doesNotMatch(JSON.stringify(res.body), /timeout/);
});

test('GET /api/cache responde 200 cuando Redis contesta PONG', async () => {
  const cache = { isReady: true, ping: async () => 'PONG' };
  const app = createApp({ pool: fakePool(), cache, config: TEST_CONFIG });
  const res = await request(app).get('/api/cache');
  assert.equal(res.status, 200);
  assert.deepEqual(res.body, { status: 'cache-ready' });
});

test('GET /api/cache responde 503 sin detalles cuando Redis no está disponible', async () => {
  const cache = { isReady: false, ping: async () => { throw new Error('ECONNREFUSED 10.0.0.2:6379'); } };
  const app = createApp({ pool: fakePool(), cache, config: TEST_CONFIG });
  const res = await request(app).get('/api/cache');
  assert.equal(res.status, 503);
  assert.doesNotMatch(JSON.stringify(res.body), /ECONNREFUSED/);
});
