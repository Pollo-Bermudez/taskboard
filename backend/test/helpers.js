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
  };
}

module.exports = { TEST_CONFIG, fakePool };
