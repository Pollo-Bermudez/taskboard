export const ESTADOS = [
  { key: 'pendiente', titulo: 'Pendiente', badge: 'col-badge-pendiente' },
  { key: 'en_progreso', titulo: 'En progreso', badge: 'col-badge-progreso' },
  { key: 'en_revision', titulo: 'En revisión', badge: 'col-badge-revision' },
  { key: 'completada', titulo: 'Completada', badge: 'col-badge-completada' },
];

export const ESTADO_TITULO = Object.fromEntries(ESTADOS.map((e) => [e.key, e.titulo]));

export const PRIORIDADES = ['alta', 'media', 'baja'];

export const POLLING_MS = 15000;
