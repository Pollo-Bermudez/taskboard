// Base de datos de prueba aislada por proceso. Solo corre si DB_HOST está definido
// (dentro de `docker compose --profile test run --rm backend-test`).
const fs = require('fs/promises');
const { Pool } = require('pg');
const { runMigrations, seedPasswords } = require('../src/migrate');

const HAS_DB = Boolean(process.env.DB_HOST);
const TEST_PASSWORD = 'password-de-prueba';

function baseConfig(database) {
  return {
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT, 10) || 5432,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database,
  };
}

async function createTestDatabase() {
  const name = `taskboard_test_${process.pid}`;
  const admin = new Pool(baseConfig(process.env.DB_ADMIN_NAME || 'taskboard'));
  await admin.query(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`);
  await admin.query(`CREATE DATABASE ${name}`);
  await admin.end();

  const pool = new Pool(baseConfig(name));
  const initSql = await fs.readFile(process.env.INIT_SQL_PATH || '/db/init.sql', 'utf8');
  await pool.query(initSql);
  const silent = () => {};
  await runMigrations(pool, { log: silent });
  await seedPasswords(pool, TEST_PASSWORD, { rounds: 4, log: silent });

  async function drop() {
    await pool.end();
    const cleanup = new Pool(baseConfig(process.env.DB_ADMIN_NAME || 'taskboard'));
    await cleanup.query(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`);
    await cleanup.end();
  }

  return { pool, drop };
}

module.exports = { HAS_DB, TEST_PASSWORD, createTestDatabase };

const request = require('supertest');

// Usuarios seed: equipo 1 DevOps, equipo 2 Backend, equipo 3 Frontend.
const USUARIOS = {
  devops: 'hugo.devops@taskboard.local',
  backend: 'francisco.backend@taskboard.local',
  backend2: 'carlos.dev@taskboard.local',
  frontend: 'ana.frontend@taskboard.local',
};

async function loginAgent(app, correo) {
  const agent = request.agent(app);
  const res = await agent.post('/api/auth/login').send({ correo, password: TEST_PASSWORD });
  if (res.status !== 200) throw new Error(`login de prueba falló: ${res.status}`);
  return agent;
}

module.exports.USUARIOS = USUARIOS;
module.exports.loginAgent = loginAgent;
