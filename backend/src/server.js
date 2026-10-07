const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const { createClient } = require('redis');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Configuración del Pool de PostgreSQL
const pool = new Pool({
  host: process.env.DB_HOST || 'db',
  port: parseInt(process.env.DB_PORT, 10) || 5432,
  database: process.env.DB_NAME || 'taskboard',
  user: process.env.DB_USER || 'taskboard_user',
  password: process.env.DB_PASSWORD || 'taskboard_pass',
  connectionTimeoutMillis: 3000,
});

// Configuración del Cliente de Redis
const redisHost = process.env.REDIS_HOST || 'cache';
const redisPort = process.env.REDIS_PORT || 6379;
const redisClient = createClient({
  url: `redis://${redisHost}:${redisPort}`
});

redisClient.on('error', (err) => {
  console.error('[Redis Client Error]', err.message);
});

// Conexión inicial a Redis
(async () => {
  try {
    await redisClient.connect();
    console.log(`[TaskBoard Backend] Conectado a Redis en ${redisHost}:${redisPort}`);
  } catch (err) {
    console.error('[TaskBoard Backend] Error conectando a Redis al iniciar:', err.message);
  }
})();

// Endpoint de vitalidad (Liveness Probe)
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// Endpoint de disponibilidad (Readiness Probe para PostgreSQL)
app.get('/api/ready', async (req, res) => {
  try {
    const client = await pool.connect();
    await client.query('SELECT 1');
    client.release();
    res.status(200).json({ status: 'ready' });
  } catch (error) {
    console.error('Error al verificar conexión con PostgreSQL:', error.message);
    res.status(500).json({
      status: 'error',
      message: 'No se pudo conectar a la base de datos',
      error: error.message,
    });
  }
});

// Endpoint de verificación de Caché (Redis PING)
app.get('/api/cache', async (req, res) => {
  try {
    if (!redisClient.isOpen) {
      await redisClient.connect();
    }
    const pong = await redisClient.ping();
    if (pong === 'PONG') {
      return res.status(200).json({ status: 'cache-ready' });
    }
    return res.status(500).json({
      status: 'error',
      message: 'Respuesta inesperada de Redis',
      pong
    });
  } catch (error) {
    console.error('Error al verificar conexión con Redis:', error.message);
    return res.status(500).json({
      status: 'error',
      message: 'No se pudo conectar a Redis Cache',
      error: error.message
    });
  }
});

// Endpoint base informativo
app.get('/api', (req, res) => {
  res.status(200).json({
    name: 'TaskBoard API',
    version: '1.0.0',
    endpoints: ['/api/health', '/api/ready', '/api/cache', '/api/equipos', '/api/tareas']
  });
});

// Iniciar servidor escuchando en todas las interfaces para Docker
app.listen(PORT, '0.0.0.0', () => {
  console.log(`[TaskBoard Backend] Servidor ejecutándose en el puerto ${PORT}`);
});
