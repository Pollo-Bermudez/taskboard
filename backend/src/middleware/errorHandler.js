// Middleware centralizado: el detalle interno va a logs, el cliente recibe un mensaje seguro.
function notFound(req, res) {
  res.status(404).json({ error: 'Recurso no encontrado' });
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'JSON inválido' });
  }
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ error: 'Cuerpo de la petición demasiado grande' });
  }

  const status = err.status || 500;
  if (status >= 500) {
    console.error(`[error] ${req.method} ${req.originalUrl}:`, err);
  }
  res.status(status).json({ error: err.expose ? err.message : 'Error interno del servidor' });
}

module.exports = { notFound, errorHandler };
