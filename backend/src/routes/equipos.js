const express = require('express');
const { parseId } = require('../validation');

function equiposRouter({ pool }) {
  const router = express.Router();

  router.get('/', async (req, res, next) => {
    try {
      const { rows } = await pool.query('SELECT id, nombre, color_hex FROM equipos ORDER BY id');
      res.json(rows);
    } catch (err) {
      next(err);
    }
  });

  // Miembros del equipo: opciones de responsable al asignar tareas.
  router.get('/:id/usuarios', async (req, res, next) => {
    try {
      const equipoId = parseId(req.params.id, 'equipo_id');
      const { rows } = await pool.query(
        'SELECT id, nombre, rol FROM usuarios WHERE equipo_id = $1 ORDER BY nombre',
        [equipoId],
      );
      res.json(rows);
    } catch (err) {
      next(err);
    }
  });

  return router;
}

module.exports = { equiposRouter };
