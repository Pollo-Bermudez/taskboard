const express = require('express');
const { HttpError } = require('../errors');
const { parseId, validarTarea } = require('../validation');

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

  async function obtenerTarea(id) {
    const { rows } = await pool.query(`${TAREA_SELECT} WHERE t.id = $1`, [id]);
    return rows[0];
  }

  // Un responsable solo puede pertenecer al equipo dueño de la tarea.
  async function validarResponsable(asignadoA, equipoId) {
    if (asignadoA === undefined || asignadoA === null) return;
    const { rowCount } = await pool.query('SELECT 1 FROM usuarios WHERE id = $1 AND equipo_id = $2', [asignadoA, equipoId]);
    if (!rowCount) throw new HttpError(422, 'El responsable debe pertenecer al mismo equipo');
  }

  // Distingue "no existe" (404) de "existe pero es de otro equipo" (403).
  async function rechazarSinPermiso(id) {
    const { rowCount } = await pool.query('SELECT 1 FROM tareas WHERE id = $1', [id]);
    throw rowCount ? new HttpError(403, 'Solo el equipo propietario puede modificar esta tarea') : new HttpError(404, 'Tarea no encontrada');
  }

  // Vista global: todas las tareas de todos los equipos, solo lectura.
  router.get('/global', async (req, res, next) => {
    try {
      const { rows } = await pool.query(`${TAREA_SELECT} ORDER BY e.id, t.creado_en, t.id`);
      res.json(rows);
    } catch (err) {
      next(err);
    }
  });

  // Panel de equipo: lectura permitida para cualquier usuario autenticado.
  router.get('/', async (req, res, next) => {
    try {
      const equipoId = parseId(req.query.equipo_id, 'equipo_id');
      const { rows } = await pool.query(`${TAREA_SELECT} WHERE t.equipo_id = $1 ORDER BY t.creado_en, t.id`, [equipoId]);
      res.json(rows);
    } catch (err) {
      next(err);
    }
  });

  router.post('/', async (req, res, next) => {
    try {
      const datos = validarTarea(req.body, { parcial: false });
      const equipoId = req.body.equipo_id === undefined ? req.user.equipo_id : parseId(req.body.equipo_id, 'equipo_id');
      if (equipoId !== req.user.equipo_id) {
        throw new HttpError(403, 'Solo puedes crear tareas en tu propio equipo');
      }
      await validarResponsable(datos.asignado_a, equipoId);

      const { rows } = await pool.query(
        `INSERT INTO tareas (equipo_id, titulo, descripcion, estado, prioridad, asignado_a)
         VALUES ($1, $2, $3, COALESCE($4::estado_tarea, 'pendiente'), COALESCE($5, 'media'), $6)
         RETURNING id`,
        [equipoId, datos.titulo, datos.descripcion ?? null, datos.estado ?? null, datos.prioridad ?? null, datos.asignado_a ?? null],
      );
      res.status(201).json(await obtenerTarea(rows[0].id));
    } catch (err) {
      next(err);
    }
  });

  router.patch('/:id', async (req, res, next) => {
    try {
      const id = parseId(req.params.id);
      const datos = validarTarea(req.body, { parcial: true });
      const campos = Object.keys(datos);
      if (!campos.length) throw new HttpError(400, 'No hay campos para actualizar');

      // Autorización antes de validar el responsable para no filtrar datos de otros equipos.
      const { rows } = await pool.query('SELECT equipo_id FROM tareas WHERE id = $1', [id]);
      if (!rows.length) throw new HttpError(404, 'Tarea no encontrada');
      if (rows[0].equipo_id !== req.user.equipo_id) {
        throw new HttpError(403, 'Solo el equipo propietario puede modificar esta tarea');
      }
      await validarResponsable(datos.asignado_a, req.user.equipo_id);

      // Las columnas salen de la lista blanca de validarTarea; equipo_id en el WHERE mantiene
      // la autorización aunque la tarea cambie entre la consulta y la actualización.
      const sets = campos.map((c, i) => `${c} = $${i + 3}${c === 'estado' ? '::estado_tarea' : ''}`);
      const { rowCount } = await pool.query(
        `UPDATE tareas SET ${sets.join(', ')} WHERE id = $1 AND equipo_id = $2`,
        [id, req.user.equipo_id, ...campos.map((c) => datos[c])],
      );
      if (!rowCount) await rechazarSinPermiso(id);
      res.json(await obtenerTarea(id));
    } catch (err) {
      next(err);
    }
  });

  router.delete('/:id', async (req, res, next) => {
    try {
      const id = parseId(req.params.id);
      const { rowCount } = await pool.query('DELETE FROM tareas WHERE id = $1 AND equipo_id = $2', [id, req.user.equipo_id]);
      if (!rowCount) await rechazarSinPermiso(id);
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  });

  return router;
}

module.exports = { tareasRouter, TAREA_SELECT };
