const REQUIRED = ['DB_HOST', 'DB_NAME', 'DB_USER', 'DB_PASSWORD', 'JWT_SECRET'];

function loadConfig(env = process.env) {
  const missing = REQUIRED.filter((key) => !env[key]);
  if (missing.length) {
    throw new Error(`Faltan variables de entorno obligatorias: ${missing.join(', ')}`);
  }

  return {
    nodeEnv: env.NODE_ENV || 'production',
    port: parseInt(env.PORT, 10) || 3000,
    db: {
      host: env.DB_HOST,
      port: parseInt(env.DB_PORT, 10) || 5432,
      database: env.DB_NAME,
      user: env.DB_USER,
      password: env.DB_PASSWORD,
    },
    jwtSecret: env.JWT_SECRET,
    accessTokenTtl: env.ACCESS_TOKEN_TTL || '15m',
    refreshTokenTtlDays: parseInt(env.REFRESH_TOKEN_TTL_DAYS, 10) || 3,
    cookieSecure: env.COOKIE_SECURE === 'true',
    seedUserPassword: env.SEED_USER_PASSWORD || null,
  };
}

module.exports = { loadConfig };
