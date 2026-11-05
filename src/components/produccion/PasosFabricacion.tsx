// src/components/produccion/PasosFabricacion.tsx
import type { OrderItem } from "@/types/produccion";
import { opcionDeTipo, opcionesDe } from "@/lib/opcionesPedido";

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
  // Opciones elegidas al comprar: solo AGREGAN datos; si no hay, rige la deducción por título de siempre.
  const opciones = opcionesDe(item.opciones);
  const opTapiz = opcionDeTipo(opciones, "tapizado");
  const opFirmeza = opcionDeTipo(opciones, "firmeza");
  const opPatas = opcionDeTipo(opciones, "patas");
  const opColor = opcionDeTipo(opciones, "color");
  const usaTapizado = !!opTapiz ||
    item.title.toLowerCase().includes("sofá") ||
    item.title.toLowerCase().includes("silla") ||
    item.title.toLowerCase().includes("sillon");
  const nombreOp = (o: { valor: string; material?: string | null }) =>
    o.material && o.material.toLowerCase() !== o.valor.toLowerCase() ? `${o.valor} (${o.material})` : o.valor;

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
    pasos.push(
      opColor
        ? `Aplicar acabado en color ${opColor.valor}, según especificación del cliente`
        : "Aplicar acabado superficial según especificación del cliente",
    );
  }

  if (opPatas) pasos.push(`Instalar patas: ${nombreOp(opPatas)}`);

  if (usaTapizado) {
    pasos.push(
      opFirmeza
        ? `Cortar y pegar espuma en asiento y respaldo, firmeza ${opFirmeza.valor}`
        : "Cortar y pegar espuma en asiento y respaldo",
    );
    pasos.push(
      opTapiz
        ? `Tapizar con ${nombreOp(opTapiz)} y fijar con grapas tapiceras`
        : "Tapizar y fijar con grapas tapiceras",
    );
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