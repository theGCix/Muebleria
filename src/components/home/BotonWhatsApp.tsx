// src/components/home/BotonWhatsApp.tsx
// Círculo verde de WhatsApp del boceto móvil v3 (solo en el home y solo en móvil, < md). Abre el chat con ventas con un mensaje
// de saludo; el número sale de config (VITE_WHATSAPP_NUMBER). Va sobre el botón del asistente, que sigue abajo a la derecha.
// Verde = token `--whatsapp` (regla de WhatsApp: el ícono usa ese token; aquí el fondo del botón, como en el boceto).
import { Phone } from "lucide-react";
import { WHATSAPP_NUMBER } from "@/config";
import { trackLead } from "@/lib/analytics";

export function BotonWhatsApp() {
  if (!WHATSAPP_NUMBER) return null;
  const href = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent("Hola G&M 👋 Quiero información sobre sus muebles.")}`;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() => trackLead("whatsapp")}
      aria-label="Escribir por WhatsApp (se abre en otra pestaña)"
      className="fixed bottom-24 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-[var(--whatsapp)] text-white shadow-xl transition-transform hover:scale-105 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 md:hidden"
    >
      <Phone className="h-6 w-6" aria-hidden />
    </a>
  );
}
