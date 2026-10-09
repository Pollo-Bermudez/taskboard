const { HttpError } = require('./errors');

const ESTADOS = ['pendiente', 'en_progreso', 'en_revision', 'completada'];
const PRIORIDADES = ['alta', 'media', 'baja'];

function parseId(value, campo = 'id') {
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0 || n > 2147483647) {
    throw new HttpError(400, `${campo} debe ser un entero positivo`);
  }
  return n;
}

function texto(value, campo, { max, requerido = false }) {
  if (value === undefined) {
    if (requerido) throw new HttpError(400, `${campo} es obligatorio`);
    return undefined;
  }
  if (value === null && !requerido) return null;
  if (typeof value !== 'string') throw new HttpError(400, `${campo} debe ser texto`);
  const limpio = value.trim();
  if (requerido && !limpio) throw new HttpError(400, `${campo} es obligatorio`);
  if (limpio.length > max) throw new HttpError(400, `${campo} admite máximo ${max} caracteres`);
  return limpio;
}

function enumeracion(value, campo, opciones) {
  if (value === undefined) return undefined;
  if (!opciones.includes(value)) throw new HttpError(400, `${campo} debe ser uno de: ${opciones.join(', ')}`);
  return value;
}

function idOpcional(value, campo) {
  if (value === undefined || value === null) return value;
  return parseId(value, campo);
}

// Normaliza el cuerpo de alta/edición de tareas. Campos desconocidos se ignoran.
function validarTarea(body, { parcial }) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new HttpError(400, 'Cuerpo inválido');
  }
  const datos = {
    titulo: texto(body.titulo, 'titulo', { max: 200, requerido: !parcial }),
    descripcion: texto(body.descripcion, 'descripcion', { max: 5000 }),
    estado: enumeracion(body.estado, 'estado', ESTADOS),
    prioridad: enumeracion(body.prioridad, 'prioridad', PRIORIDADES),
    asignado_a: idOpcional(body.asignado_a, 'asignado_a'),
  };
  if (parcial && datos.titulo === null) throw new HttpError(400, 'titulo no puede ser nulo');
  return Object.fromEntries(Object.entries(datos).filter(([, v]) => v !== undefined));
}

module.exports = { ESTADOS, PRIORIDADES, parseId, validarTarea };
