const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const { createApp } = require('../src/app');
const { TEST_CONFIG } = require('./helpers');
const { HAS_DB, TEST_PASSWORD, USUARIOS, createTestDatabase, loginAgent } = require('./db');

const opts = { skip: !HAS_DB && 'requiere PostgreSQL (docker compose --profile test)' };
let db;
let app;

before(async () => {
  if (!HAS_DB) return;
  db = await createTestDatabase();
  app = createApp({ pool: db.pool, config: TEST_CONFIG });
});
after(async () => { if (db) await db.drop(); });

function cookie(res, name) {
  return (res.headers['set-cookie'] || []).find((c) => c.startsWith(`${name}=`));
}

test('login correcto emite cookies httpOnly y no expone tokens en el body', opts, async () => {
  const res = await request(app).post('/api/auth/login').send({ correo: USUARIOS.backend, password: TEST_PASSWORD });
  assert.equal(res.status, 200);
  const access = cookie(res, 'tb_access');
  const refresh = cookie(res, 'tb_refresh');
  assert.match(access, /HttpOnly/);
  assert.match(access, /SameSite=Strict/);
  assert.match(access, /Path=\/api;/);
  assert.match(refresh, /HttpOnly/);
  assert.match(refresh, /Path=\/api\/auth/);
  assert.equal(res.body.usuario.equipo_id, 2);
  assert.doesNotMatch(JSON.stringify(res.body), /eyJ|password/);
});

test('credenciales inválidas responden 401 genérico', opts, async () => {
  const mala = await request(app).post('/api/auth/login').send({ correo: USUARIOS.backend, password: 'incorrecta' });
  const inexistente = await request(app).post('/api/auth/login').send({ correo: 'nadie@x.local', password: 'x' });
  assert.equal(mala.status, 401);
  assert.equal(inexistente.status, 401);
  assert.equal(mala.body.error, inexistente.body.error);
});

test('login sin campos responde 400', opts, async () => {
  const res = await request(app).post('/api/auth/login').send({ correo: 123 });
  assert.equal(res.status, 400);
});

test('GET /api/auth/me devuelve el usuario de la sesión', opts, async () => {
  const agent = await loginAgent(app, USUARIOS.devops);
  const res = await agent.get('/api/auth/me');
  assert.equal(res.status, 200);
  assert.equal(res.body.usuario.correo, USUARIOS.devops);
  assert.equal(res.body.usuario.equipo_nombre, 'Equipo DevOps');
});

test('access token expirado o manipulado responde 401', opts, async () => {
  const expirado = jwt.sign({ equipo_id: 1 }, TEST_CONFIG.jwtSecret, { subject: '1', expiresIn: -10 });
  const otraLlave = jwt.sign({ equipo_id: 1 }, 'otra-llave', { subject: '1', expiresIn: '15m' });
  for (const token of [expirado, otraLlave]) {
    const res = await request(app).get('/api/auth/me').set('Cookie', `tb_access=${token}`);
    assert.equal(res.status, 401);
  }
});

test('reuso inmediato (carrera entre pestañas) responde 401 sin revocar la familia', opts, async () => {
  const login = await request(app).post('/api/auth/login').send({ correo: USUARIOS.devops, password: TEST_PASSWORD });
  const original = cookie(login, 'tb_refresh').split(';')[0];
  const rotado = await request(app).post('/api/auth/refresh').set('Cookie', original);
  const nuevo = cookie(rotado, 'tb_refresh').split(';')[0];

  assert.equal((await request(app).post('/api/auth/refresh').set('Cookie', original)).status, 401);
  assert.equal((await request(app).post('/api/auth/refresh').set('Cookie', nuevo)).status, 200);
});

test('refresh rota el token y detecta reuso revocando la familia', opts, async () => {
  const login = await request(app).post('/api/auth/login').send({ correo: USUARIOS.frontend, password: TEST_PASSWORD });
  const original = cookie(login, 'tb_refresh').split(';')[0];

  const rotado = await request(app).post('/api/auth/refresh').set('Cookie', original);
  assert.equal(rotado.status, 200);
  const nuevo = cookie(rotado, 'tb_refresh').split(';')[0];
  assert.notEqual(nuevo, original);
  assert.ok(cookie(rotado, 'tb_access'));

  // Reusar el token original fuera de la ventana de gracia invalida también el nuevo.
  await db.pool.query("UPDATE refresh_tokens SET revocado_en = NOW() - interval '1 minute' WHERE revocado_en IS NOT NULL");
  const reuso = await request(app).post('/api/auth/refresh').set('Cookie', original);
  assert.equal(reuso.status, 401);
  const despues = await request(app).post('/api/auth/refresh').set('Cookie', nuevo);
  assert.equal(despues.status, 401);
});

test('logout revoca el refresh token y borra cookies', opts, async () => {
  const login = await request(app).post('/api/auth/login').send({ correo: USUARIOS.backend2, password: TEST_PASSWORD });
  const refresh = cookie(login, 'tb_refresh').split(';')[0];
  const out = await request(app).post('/api/auth/logout').set('Cookie', refresh);
  assert.equal(out.status, 204);
  assert.match(cookie(out, 'tb_access'), /Expires=Thu, 01 Jan 1970/);
  const res = await request(app).post('/api/auth/refresh').set('Cookie', refresh);
  assert.equal(res.status, 401);
});

test('sin cookie de refresh responde 401', opts, async () => {
  assert.equal((await request(app).post('/api/auth/refresh')).status, 401);
});

test('tras 5 fallos el correo queda bloqueado (429 + Retry-After) aunque la contraseña sea correcta', opts, async () => {
  const correo = USUARIOS.devops.toUpperCase();
  for (let i = 0; i < 5; i += 1) {
    const res = await request(app).post('/api/auth/login').send({ correo, password: 'mala' });
    assert.equal(res.status, 401, `intento ${i + 1}`);
  }
  const bloqueado = await request(app).post('/api/auth/login').send({ correo: USUARIOS.devops, password: TEST_PASSWORD });
  assert.equal(bloqueado.status, 429);
  assert.ok(Number(bloqueado.headers['retry-after']) > 0);
  assert.match(bloqueado.body.error, /Demasiados intentos/);
  await db.pool.query('DELETE FROM login_intentos');
});

test('un login correcto reinicia el contador de fallos', opts, async () => {
  const correo = USUARIOS.backend2;
  for (let i = 0; i < 4; i += 1) await request(app).post('/api/auth/login').send({ correo, password: 'mala' });
  assert.equal((await request(app).post('/api/auth/login').send({ correo, password: TEST_PASSWORD })).status, 200);
  for (let i = 0; i < 4; i += 1) {
    assert.equal((await request(app).post('/api/auth/login').send({ correo, password: 'mala' })).status, 401);
  }
  assert.equal((await request(app).post('/api/auth/login').send({ correo, password: TEST_PASSWORD })).status, 200);
});

test('correos inexistentes también se limitan (no se revela si la cuenta existe)', opts, async () => {
  const correo = 'nadie-mas@taskboard.local';
  for (let i = 0; i < 5; i += 1) await request(app).post('/api/auth/login').send({ correo, password: 'x' });
  assert.equal((await request(app).post('/api/auth/login').send({ correo, password: 'x' })).status, 429);
});
