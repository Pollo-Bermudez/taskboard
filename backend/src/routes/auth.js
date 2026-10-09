const express = require('express');
const bcrypt = require('bcryptjs');
const { hashToken, REFRESH_COOKIE } = require('../auth');
const { requireAuth } = require('../middleware/auth');
const { HttpError } = require('../errors');

// Un token rotado hace menos de esto se considera carrera entre pestañas, no robo.
const REUSE_GRACE_SECONDS = 30;

const USUARIO_PUBLICO = `
  SELECT u.id, u.nombre, u.correo, u.rol, u.equipo_id, e.nombre AS equipo_nombre, e.color_hex AS equipo_color
    FROM usuarios u JOIN equipos e ON e.id = u.equipo_id`;

function authRouter({ pool, auth, bcryptRounds, maxIntentos = 5, ventanaMin = 15 }) {
  const router = express.Router();
  // Hash ficticio con el mismo costo que los reales: un correo inexistente tarda lo mismo
  // que una contraseña incorrecta y no revela qué correos existen.
  const dummyHash = bcrypt.hashSync('dummy-password-no-valida', bcryptRounds);

  async function startSession(res, db, usuario, familia) {
    const refreshToken = await auth.issueRefreshToken(db, usuario.id, familia);
    auth.setSessionCookies(res, auth.signAccessToken(usuario), refreshToken);
  }

  // Límite de intentos (DV-16): el contador vive en PostgreSQL para que sea el mismo en
  // todas las réplicas. Se aplica a cualquier correo, exista o no, para no revelar cuentas.
  async function bloqueoVigente(correo) {
    const { rows } = await pool.query(
      `SELECT CEIL(EXTRACT(EPOCH FROM bloqueado_hasta - NOW()))::int AS segundos
         FROM login_intentos WHERE correo = $1 AND bloqueado_hasta > NOW()`,
      [correo],
    );
    return rows[0]?.segundos || 0;
  }

  async function registrarFallo(correo) {
    const reiniciar = 'login_intentos.primer_fallo < NOW() - make_interval(mins => $2)';
    const fallos = `CASE WHEN ${reiniciar} THEN 1 ELSE login_intentos.fallos + 1 END`;
    await pool.query(
      `INSERT INTO login_intentos (correo, fallos, primer_fallo, bloqueado_hasta)
       VALUES ($1, 1, NOW(), CASE WHEN 1 >= $3 THEN NOW() + make_interval(mins => $2) END)
       ON CONFLICT (correo) DO UPDATE SET
         fallos = ${fallos},
         primer_fallo = CASE WHEN ${reiniciar} THEN NOW() ELSE login_intentos.primer_fallo END,
         bloqueado_hasta = CASE WHEN ${fallos} >= $3 THEN NOW() + make_interval(mins => $2) END`,
      [correo, ventanaMin, maxIntentos],
    );
  }

  function demasiadosIntentos(res, segundos) {
    res.set('Retry-After', String(segundos));
    const minutos = Math.ceil(segundos / 60);
    return res.status(429).json({ error: `Demasiados intentos fallidos. Intenta de nuevo en ${minutos} minuto${minutos === 1 ? '' : 's'}.` });
  }

  async function usuarioPublico(id, db = pool) {
    const { rows } = await db.query(`${USUARIO_PUBLICO} WHERE u.id = $1`, [id]);
    return rows[0];
  }

  router.post('/login', async (req, res, next) => {
    try {
      const { correo, password } = req.body || {};
      if (typeof correo !== 'string' || typeof password !== 'string' || !correo || !password || correo.length > 150 || password.length > 200) {
        throw new HttpError(400, 'Correo y contraseña son obligatorios');
      }

      const clave = correo.trim().toLowerCase();
      const espera = await bloqueoVigente(clave);
      if (espera) return demasiadosIntentos(res, espera);

      const { rows } = await pool.query(
        'SELECT id, equipo_id, rol, password_hash FROM usuarios WHERE lower(correo) = $1',
        [clave],
      );
      const usuario = rows[0];
      const valid = await bcrypt.compare(password, usuario?.password_hash || dummyHash);
      if (!usuario || !usuario.password_hash || !valid) {
        await registrarFallo(clave);
        throw new HttpError(401, 'Credenciales inválidas');
      }
      await pool.query('DELETE FROM login_intentos WHERE correo = $1', [clave]);

      await pool.query('DELETE FROM refresh_tokens WHERE usuario_id = $1 AND expira_en < NOW()', [usuario.id]);
      await startSession(res, pool, usuario);
      res.json({ usuario: await usuarioPublico(usuario.id) });
    } catch (err) {
      next(err);
    }
  });

  router.post('/refresh', async (req, res, next) => {
    const token = req.cookies?.[REFRESH_COOKIE];
    if (!token) return res.status(401).json({ error: 'No autenticado' });

    let client;
    try {
      client = await pool.connect();
      await client.query('BEGIN');
      const { rows } = await client.query(
        `SELECT rt.id, rt.familia, rt.revocado_en, rt.expira_en < NOW() AS expirado,
                rt.revocado_en > NOW() - make_interval(secs => $2) AS rotado_reciente,
                u.id AS usuario_id, u.equipo_id, u.rol
           FROM refresh_tokens rt JOIN usuarios u ON u.id = rt.usuario_id
          WHERE rt.token_hash = $1
          FOR UPDATE OF rt`,
        [hashToken(token), REUSE_GRACE_SECONDS],
      );
      const actual = rows[0];

      if (!actual || actual.expirado) {
        await client.query('COMMIT');
        auth.clearSessionCookies(res);
        return res.status(401).json({ error: 'Sesión expirada' });
      }

      if (actual.revocado_en && actual.rotado_reciente) {
        // Otra pestaña acaba de rotarlo: el navegador ya tiene la cookie nueva. Sin revocar nada.
        await client.query('COMMIT');
        return res.status(401).json({ error: 'Sesión renovada en otra pestaña' });
      }

      if (actual.revocado_en) {
        // Reuso de un token ya rotado: posible robo. Se revoca toda la familia.
        await client.query(
          'UPDATE refresh_tokens SET revocado_en = NOW() WHERE familia = $1 AND revocado_en IS NULL',
          [actual.familia],
        );
        await client.query('COMMIT');
        console.warn(`[auth] Reuso de refresh token detectado para usuario ${actual.usuario_id}; familia revocada`);
        auth.clearSessionCookies(res);
        return res.status(401).json({ error: 'Sesión inválida' });
      }

      await client.query('UPDATE refresh_tokens SET revocado_en = NOW() WHERE id = $1', [actual.id]);
      const usuario = { id: actual.usuario_id, equipo_id: actual.equipo_id, rol: actual.rol };
      await startSession(res, client, usuario, actual.familia);
      const publico = await usuarioPublico(usuario.id, client);
      await client.query('COMMIT');
      res.json({ usuario: publico });
    } catch (err) {
      await client?.query('ROLLBACK').catch(() => {});
      next(err);
    } finally {
      client?.release();
    }
  });

  router.post('/logout', async (req, res, next) => {
    try {
      const token = req.cookies?.[REFRESH_COOKIE];
      if (token) {
        await pool.query(
          `UPDATE refresh_tokens SET revocado_en = NOW()
            WHERE revocado_en IS NULL
              AND familia = (SELECT familia FROM refresh_tokens WHERE token_hash = $1)`,
          [hashToken(token)],
        );
      }
      auth.clearSessionCookies(res);
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  });

  router.get('/me', requireAuth(auth), async (req, res, next) => {
    try {
      const usuario = await usuarioPublico(req.user.id);
      if (!usuario) return res.status(401).json({ error: 'No autenticado' });
      res.json({ usuario });
    } catch (err) {
      next(err);
    }
  });

  return router;
}

module.exports = { authRouter };
