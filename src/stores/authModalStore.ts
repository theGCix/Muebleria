// src/stores/authModalStore.ts
// Estado global para abrir el LoginModal desde cualquier lugar
// (guards de rutas, páginas de perfil, etc.) ahora que no existe la ruta /login.
import { create } from "zustand";

interface AuthModalState {
  open: boolean;
  openLogin: () => void;
  setOpen: (open: boolean) => void;
}

export const useAuthModalStore = create<AuthModalState>((set) => ({
  open: false,
  openLogin: () => set({ open: true }),
  setOpen: (open) => set({ open }),
}));
