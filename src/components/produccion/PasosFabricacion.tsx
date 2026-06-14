// src/components/produccion/PasosFabricacion.tsx
import type { OrderItem } from "@/types/produccion";

interface Props {
  items: OrderItem[];
}

/**
 * Genera pasos de fabricación a partir de la personalización
 * del ítem. Si el ítem tiene un acabado reconocido, adapta los pasos.
 *
 * En una implementación futura, estos pasos podrían venir de la DB
 * (tabla pasos_fabricacion vinculada al modelo), pero aquí derivamos
 * los más comunes automáticamente para que el carpintero siempre
 * tenga una guía útil.
 */
function generarPasos(item: OrderItem): string[] {
  const p = (item.personalizacion ?? {}) as Record<string, string>;
  const acabado = (p.acabado ?? "").toLowerCase();
  const madera = p.madera ?? "madera";
  const medidas = p.medidas ?? "";

  const usaLaca = acabado.includes("laca");
  const usaBarniz = acabado.includes("barniz");
  const usaTapizado = item.title.toLowerCase().includes("sofá") ||
    item.title.toLowerCase().includes("silla") ||
    item.title.toLowerCase().includes("sillon");

  const pasos: string[] = [
    `Cortar y secar piezas de ${madera}${medidas ? ` según medidas ${medidas}` : ""}`,
    "Lijar todas las piezas con lija 120, luego 220",
    "Armar estructura y verificar escuadra y nivel",
  ];

  if (usaBarniz) {
    pasos.push("Aplicar fondo sellador, dejar secar 4 h");
    pasos.push(`Aplicar 2 manos de ${acabado}, respetando tiempo de secado entre capas`);
  } else if (usaLaca) {
    pasos.push("Aplicar fondo sellador, dejar secar 4 h");
    pasos.push(`Aplicar ${acabado} en cabina, 2 manos`);
  } else {
    pasos.push("Aplicar acabado superficial según especificación del cliente");
  }

  if (usaTapizado) {
    pasos.push("Cortar y pegar espuma en asiento y respaldo");
    pasos.push("Tapizar y fijar con grapas tapiceras");
  }

  pasos.push("Control de calidad: estabilidad, nivel y acabado visual");
  pasos.push("Embalar con film stretch para protección en despacho");

  return pasos;
}

export function PasosFabricacion({ items }: Props) {
  // Tomamos el primer ítem como referencia para los pasos.
  // Si hay múltiples ítems distintos, se puede expandir en el futuro.
  const item = items[0];
  const pasos = item ? generarPasos(item) : [];

  if (!pasos.length) {
    return (
      <p className="text-sm text-muted-foreground">
        No hay pasos disponibles para este ítem.
      </p>
    );
  }

  return (
    <ol className="space-y-2">
      {pasos.map((paso, i) => (
        <li key={i} className="flex items-start gap-3">
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-800 text-[11px] font-semibold mt-0.5">
            {i + 1}
          </span>
          <p className="text-sm leading-relaxed">{paso}</p>
        </li>
      ))}
    </ol>
  );
}