const { ACCESS_COOKIE } = require('../auth');

function requireAuth(auth) {
  return (req, res, next) => {
    const token = req.cookies?.[ACCESS_COOKIE];
    if (!token) return res.status(401).json({ error: 'No autenticado' });
    try {
      req.user = auth.verifyAccessToken(token);
      next();
    } catch {
      res.status(401).json({ error: 'Sesión expirada o inválida' });
    }
  };
}

module.exports = { requireAuth };
