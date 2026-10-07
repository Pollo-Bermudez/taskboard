const express = require('express');

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

  return router;
}

module.exports = { equiposRouter };
