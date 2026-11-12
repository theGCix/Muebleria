// src/lib/avisoFavorito.ts
// D11: aviso de favoritos en la parte inferior de la pantalla, con la opción «Deshacer».
// El Toaster (src/routes/__root.tsx) deja libre la barra inferior móvil y la barra de compra de la ficha.
import { toast } from "sonner";

/**
 * @param agregado  true si el producto quedó guardado; false si se quitó.
 * @param deshacer  acción contraria (quitarlo si se guardó, guardarlo si se quitó).
 */
export function avisoFavorito(nombre: string, agregado: boolean, deshacer: () => Promise<unknown> | void) {
  toast.success(agregado ? `"${nombre}" guardado en favoritos` : `"${nombre}" eliminado de favoritos`, {
    position: "bottom-center",
    duration: 6000,
    action: {
      label: "Deshacer",
      onClick: () => {
        void deshacer();
      },
    },
  });
}
