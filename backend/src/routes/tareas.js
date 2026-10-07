const express = require('express');

// Columnas comunes de una tarea con datos de su equipo y responsable.
const TAREA_SELECT = `
  SELECT t.id, t.equipo_id, e.nombre AS equipo_nombre, e.color_hex AS equipo_color,
         t.titulo, t.descripcion, t.estado, t.prioridad,
         t.asignado_a, u.nombre AS asignado_nombre,
         t.creado_en, t.actualizado_en
    FROM tareas t
    JOIN equipos e ON e.id = t.equipo_id
    LEFT JOIN usuarios u ON u.id = t.asignado_a`;

function tareasRouter({ pool }) {
  const router = express.Router();

  // Vista global: todas las tareas de todos los equipos, solo lectura.
  router.get('/global', async (req, res, next) => {
    try {
      const { rows } = await pool.query(`${TAREA_SELECT} ORDER BY e.id, t.creado_en, t.id`);
      res.json(rows);
    } catch (err) {
      next(err);
    }
  });

  return router;
}

module.exports = { tareasRouter, TAREA_SELECT };
