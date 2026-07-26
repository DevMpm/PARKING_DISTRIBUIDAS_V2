import { useEffect, useRef } from 'react';
import type { Espacio, EstadoEspacio } from '../types';

// Eventos que emite el ticket-service en /sse/espacios (cada uno trae {id_espacio, estado}).
const SSE_EVENTS = ['created', 'salida_registrada', 'anulado'] as const;

export interface EspacioSSEEvent {
  type: string;
  id_espacio: string;
  estado: EstadoEspacio;
}

/**
 * Se suscribe al stream SSE de espacios del ticket-service (vía Kong: /sse/espacios)
 * y aplica en vivo los cambios de estado (OCUPADO/DISPONIBLE) sobre la lista de espacios.
 * Reconecta automáticamente si la conexión se cae.
 *
 * @param setEspacios  setter del estado de espacios de la página (identidad estable).
 * @param onEvent      callback opcional para reaccionar al evento (p.ej. recargar tickets).
 */
export function useEspaciosSSE(
  setEspacios: React.Dispatch<React.SetStateAction<Espacio[]>>,
  onEvent?: (evt: EspacioSSEEvent) => void,
) {
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  useEffect(() => {
    let es: EventSource | null = null;
    let closed = false;
    let retry: ReturnType<typeof setTimeout> | null = null;

    const connect = () => {
      es = new EventSource('/sse/espacios');

      const handle = (e: MessageEvent) => {
        let data: { id_espacio?: string; estado?: string };
        try {
          data = JSON.parse(e.data);
        } catch {
          return;
        }
        if (!data.id_espacio || !data.estado) return;
        const estado = data.estado as EstadoEspacio;
        // Actualización local inmediata (sin refetch) por id de espacio.
        setEspacios(prev =>
          prev.map(sp => (sp.id === data.id_espacio ? { ...sp, estado } : sp)),
        );
        onEventRef.current?.({ type: e.type, id_espacio: data.id_espacio, estado });
      };

      SSE_EVENTS.forEach(t => es!.addEventListener(t, handle as EventListener));

      es.onerror = () => {
        es?.close();
        if (!closed) retry = setTimeout(connect, 5000); // reconexión
      };
    };

    connect();

    return () => {
      closed = true;
      if (retry) clearTimeout(retry);
      es?.close();
    };
  }, [setEspacios]);
}
