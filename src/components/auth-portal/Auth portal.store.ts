import { create } from "zustand";

type Origin = { x: number; y: number } | null;

interface AuthPortalState {
  open: boolean;
  /** Centro del botón que abrió el portal: de ahí nace la animación. */
  origin: Origin;
  /** Ruta a la que volver tras iniciar sesión (ej. "/checkout"). */
  redirect?: string;
  openPortal: (trigger?: HTMLElement | null, redirect?: string) => void;
  close: () => void;
}

export const useAuthPortal = create<AuthPortalState>((set) => ({
  open: false,
  origin: null,
  redirect: undefined,
  openPortal: (trigger, redirect) => {
    const r = trigger?.getBoundingClientRect();
    set({
      open: true,
      redirect,
      origin: r ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : null,
    });
  },
  close: () => set({ open: false }),
}));