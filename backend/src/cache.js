const { createClient } = require('redis');

// Cliente de Redis (servicio de caché). La conexión es perezosa y se reintenta sola:
// si Redis no está disponible, la API sigue funcionando y /api/cache lo informa.
function createCache({ host, port }) {
  const client = createClient({
    url: `redis://${host}:${port}`,
    socket: { connectTimeout: 3000, reconnectStrategy: (intentos) => Math.min(intentos * 500, 5000) },
  });
  client.on('error', (err) => {
    console.error('[cache] Error de Redis:', err.message);
  });
  client.connect().then(
    () => console.log(`[cache] Conectado a Redis en ${host}:${port}`),
    (err) => console.error('[cache] No se pudo conectar a Redis al iniciar:', err.message),
  );
  return client;
}

module.exports = { createCache };
