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
