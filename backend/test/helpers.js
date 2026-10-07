const TEST_CONFIG = {
  nodeEnv: 'test',
  port: 0,
  db: {},
  jwtSecret: 'test-secret-solo-para-pruebas',
  accessTokenTtl: '15m',
  refreshTokenTtlDays: 3,
  cookieSecure: false,
  seedUserPassword: null,
  bcryptRounds: 4,
};

function fakePool({ fail = false } = {}) {
  return {
    query: async () => {
      if (fail) throw new Error('connect ECONNREFUSED 10.0.0.1:5432');
      return { rows: [] };
    },
    connect: async () => {
      if (fail) throw new Error('timeout exceeded when trying to connect');
      throw new Error('fakePool.connect no implementado');
    },
  };
}

module.exports = { TEST_CONFIG, fakePool };
