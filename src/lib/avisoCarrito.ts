// src/lib/avisoCarrito.ts
// Aviso de «añadido al carrito» en la parte inferior de la pantalla, igual que el de favoritos
// (src/lib/avisoFavorito.ts). El Toaster (src/routes/__root.tsx) deja libre la barra inferior móvil
// y la barra de compra de la ficha. Todos los avisos de carrito pasan por aquí para que no vuelvan arriba.
import { toast } from "sonner";

export function avisoCarrito(mensaje: string, descripcion?: string) {
  toast.success(mensaje, {
    position: "bottom-center",
    duration: 4000,
    ...(descripcion ? { description: descripcion } : {}),
  });
}
