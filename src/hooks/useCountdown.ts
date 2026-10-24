// src/hooks/useCountdown.ts
// Cuenta regresiva hacia una fecha (ms epoch). Devuelve null si no hay fecha.
import { useEffect, useState } from "react";

export interface Restante {
  ms: number;
  d: number;
  h: number;
  m: number;
  s: number;
  terminada: boolean;
}

export function useCountdown(targetMs: number | null): Restante | null {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (targetMs == null) return;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [targetMs]);

  if (targetMs == null) return null;
  const ms = Math.max(0, targetMs - now);
  const total = Math.floor(ms / 1000);
  return {
    ms,
    d: Math.floor(total / 86400),
    h: Math.floor((total % 86400) / 3600),
    m: Math.floor((total % 3600) / 60),
    s: total % 60,
    terminada: ms <= 0,
  };
}
