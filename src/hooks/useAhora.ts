import { useEffect, useState } from "react";

/** «Ahora» que se actualiza cada `ms` milisegundos (por defecto, 1 minuto). */
export function useAhora(ms = 60_000): Date {
  const [ahora, setAhora] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setAhora(new Date()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return ahora;
}
