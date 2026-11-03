import { useEffect, useSyncExternalStore } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Session, User } from "@supabase/supabase-js";

export type AppRole = "admin" | "vendedor" | "carpintero" | "cliente";

export interface AuthState {
  user: User | null;
  session: Session | null;
  roles: AppRole[];
  loading: boolean;
}

/**
 * Estado de sesión y roles COMPARTIDO por toda la app.
 *
 * Antes cada componente que llamaba useAuth() tenía su propio estado y su
 * propia consulta a user_roles: una consulta fallida o tardía dejaba un
 * componente con roles = [] o con un valor distinto al de otro. Ahora hay una
 * sola consulta, se vuelve a leer del servidor en cada cambio de sesión y al
 * volver a la pestaña, y una respuesta vieja nunca pisa a una más nueva.
 */
const ORDEN: AppRole[] = ["admin", "vendedor", "carpintero", "cliente"];
const INICIAL: AuthState = { user: null, session: null, roles: [], loading: true };

let state: AuthState = INICIAL;
const listeners = new Set<() => void>();
let iniciado = false;
let secuencia = 0;

function actualizar(parche: Partial<AuthState>) {
  state = { ...state, ...parche };
  listeners.forEach((l) => l());
}

async function cargarRoles(userId: string) {
  const mia = ++secuencia;
  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  if (mia !== secuencia) return; // llegó una lectura más nueva: esta se descarta

  if (error) {
    // No se vacía la lista por un fallo transitorio: se conserva lo último
    // leído del servidor. La RLS/RPC siguen mandando en el servidor.
    console.error("[useAuth] no se pudieron leer los roles:", error.message);
    actualizar({ loading: false });
    return;
  }

  const roles = (data ?? [])
    .map((r) => r.role as AppRole)
    .sort((a, b) => ORDEN.indexOf(a) - ORDEN.indexOf(b));
  actualizar({ roles, loading: false });
}

function aplicarSesion(s: Session | null) {
  if (!s?.user) {
    secuencia++; // invalida lecturas en vuelo
    actualizar({ session: null, user: null, roles: [], loading: false });
    return;
  }
  const cambioDeUsuario = state.user?.id !== s.user.id;
  actualizar(
    cambioDeUsuario
      ? { session: s, user: s.user, roles: [], loading: true } // no mostrar el rol del usuario anterior
      : { session: s, user: s.user },
  );
  void cargarRoles(s.user.id);
}

function iniciar() {
  if (iniciado || typeof window === "undefined") return;
  iniciado = true;

  supabase.auth.onAuthStateChange((_evento, s) => {
    // Diferido: supabase-js no admite llamadas async dentro de este callback.
    setTimeout(() => aplicarSesion(s), 0);
  });
  supabase.auth.getSession().then(({ data }) => aplicarSesion(data.session));

  // Si un admin cambia el rol de alguien, se refleja al volver a la pestaña.
  const refrescar = () => {
    if (state.user && document.visibilityState === "visible") {
      void cargarRoles(state.user.id);
    }
  };
  window.addEventListener("focus", refrescar);
  document.addEventListener("visibilitychange", refrescar);
}

function suscribir(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useAuth(): AuthState {
  useEffect(() => {
    iniciar();
  }, []);
  return useSyncExternalStore(suscribir, () => state, () => INICIAL);
}