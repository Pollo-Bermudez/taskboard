import { useEffect, useRef } from 'react';

// Modal accesible con las clases de Nocturne: Escape y clic en el fondo cierran, el foco entra
// al diálogo y vuelve al elemento que lo abrió.
export default function Dialog({ labelledBy, describedBy, onClose, className = '', role = 'dialog', children, as: Tag = 'div', ...rest }) {
  const ref = useRef(null);
  // onClose cambia en cada render del padre (p. ej. el sondeo cada 15 s); se guarda en una ref
  // para que el efecto corra solo al montar y el foco no salte mientras se escribe.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const previo = document.activeElement;
    const inicial = ref.current?.querySelector('[data-autofocus]') || ref.current?.querySelector('input, select, textarea, button');
    inicial?.focus();
    const onKey = (e) => {
      if (e.key === 'Escape') onCloseRef.current();
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      previo?.focus?.();
    };
  }, []);

  return (
    <div className="dialog-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onCloseRef.current()}>
      <Tag ref={ref} className={`dialog ${className}`} role={role} aria-modal="true" aria-labelledby={labelledBy} aria-describedby={describedBy} {...rest}>
        {children}
      </Tag>
    </div>
  );
}
