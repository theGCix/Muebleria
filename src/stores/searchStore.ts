// src/stores/searchStore.ts
// Estado global mínimo para sincronizar la búsqueda del navbar con el
// catálogo (#catalogo) en la home, sin tocar el enrutamiento existente.
import { create } from "zustand";

interface SearchState {
  query: string;
  setQuery: (q: string) => void;
}

export const useSearchStore = create<SearchState>((set) => ({
  query: "",
  setQuery: (q) => set({ query: q }),
}));