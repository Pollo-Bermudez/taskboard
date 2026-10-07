import { useCallback, useEffect, useRef, useState } from 'react';

// Ejecuta `load` al montar y cada `intervalMs`; omite ciclos con la pestaña oculta.
export function usePolling(load, intervalMs) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [updatedAt, setUpdatedAt] = useState(null);
  const loadRef = useRef(load);
  loadRef.current = load;

  const refresh = useCallback(async () => {
    try {
      setData(await loadRef.current());
      setError(null);
      setUpdatedAt(new Date());
    } catch (err) {
      setError(err);
    }
  }, []);

  useEffect(() => {
    refresh();
    const id = setInterval(() => {
      if (document.visibilityState === 'visible') refresh();
    }, intervalMs);
    // Al volver a la pestaña se actualiza de inmediato en lugar de esperar al siguiente ciclo.
    const onVisible = () => {
      if (document.visibilityState === 'visible') refresh();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [refresh, intervalMs]);

  return { data, error, updatedAt, refresh };
}
