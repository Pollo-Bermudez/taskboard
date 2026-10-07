// Cliente HTTP de la API. Las credenciales viajan en cookies httpOnly (credentials: 'include');
// el frontend nunca lee ni guarda tokens.
export class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const SIN_REINTENTO = ['/auth/login', '/auth/refresh', '/auth/logout'];
let refreshEnCurso = null;
let onSessionExpired = () => {};

export function setSessionExpiredHandler(handler) {
  onSessionExpired = handler;
}

async function request(path, { method = 'GET', body } = {}) {
  return fetch(`/api${path}`, {
    method,
    credentials: 'include',
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

// Un solo refresh a la vez: peticiones simultáneas con 401 esperan el mismo resultado.
function refreshSession() {
  if (!refreshEnCurso) {
    refreshEnCurso = request('/auth/refresh', { method: 'POST' })
      .then((res) => res.ok)
      .catch(() => false)
      .finally(() => {
        refreshEnCurso = null;
      });
  }
  return refreshEnCurso;
}

export async function api(path, options = {}) {
  let res = await request(path, options);

  if (res.status === 401 && !SIN_REINTENTO.includes(path)) {
    if (await refreshSession()) {
      res = await request(path, options);
    } else {
      onSessionExpired();
    }
  }

  if (res.status === 204) return null;
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new ApiError(res.status, data?.error || `Error ${res.status}`);
  }
  return data;
}
