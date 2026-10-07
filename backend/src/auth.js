const crypto = require('crypto');
const jwt = require('jsonwebtoken');

const ACCESS_COOKIE = 'tb_access';
const REFRESH_COOKIE = 'tb_refresh';

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function createAuth(config) {
  const baseCookie = { httpOnly: true, sameSite: 'strict', secure: config.cookieSecure };
  const refreshMaxAgeMs = config.refreshTokenTtlDays * 24 * 60 * 60 * 1000;

  function signAccessToken(usuario) {
    return jwt.sign({ equipo_id: usuario.equipo_id, rol: usuario.rol }, config.jwtSecret, {
      algorithm: 'HS256',
      subject: String(usuario.id),
      expiresIn: config.accessTokenTtl,
    });
  }

  function verifyAccessToken(token) {
    const payload = jwt.verify(token, config.jwtSecret, { algorithms: ['HS256'] });
    return { id: Number(payload.sub), equipo_id: payload.equipo_id, rol: payload.rol };
  }

  // Refresh token opaco: el cliente recibe el valor, la BD solo guarda su hash.
  async function issueRefreshToken(db, usuarioId, familia = crypto.randomUUID()) {
    const token = crypto.randomBytes(32).toString('base64url');
    await db.query(
      `INSERT INTO refresh_tokens (usuario_id, token_hash, familia, expira_en)
       VALUES ($1, $2, $3, NOW() + make_interval(days => $4))`,
      [usuarioId, hashToken(token), familia, config.refreshTokenTtlDays],
    );
    return token;
  }

  function setSessionCookies(res, accessToken, refreshToken) {
    const { exp, iat } = jwt.decode(accessToken);
    res.cookie(ACCESS_COOKIE, accessToken, { ...baseCookie, path: '/api', maxAge: (exp - iat) * 1000 });
    res.cookie(REFRESH_COOKIE, refreshToken, { ...baseCookie, path: '/api/auth', maxAge: refreshMaxAgeMs });
  }

  function clearSessionCookies(res) {
    res.clearCookie(ACCESS_COOKIE, { ...baseCookie, path: '/api' });
    res.clearCookie(REFRESH_COOKIE, { ...baseCookie, path: '/api/auth' });
  }

  return { signAccessToken, verifyAccessToken, issueRefreshToken, setSessionCookies, clearSessionCookies };
}

module.exports = { createAuth, hashToken, ACCESS_COOKIE, REFRESH_COOKIE };
