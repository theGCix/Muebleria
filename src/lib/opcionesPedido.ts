// src/lib/opcionesPedido.ts
// Opciones elegidas en un pedido (order_items.opciones): copia fija que arma el servidor al cobrar.
// Los pedidos antiguos tienen `opciones` nulo: ahí se sigue mostrando el `title` tal cual.

export interface OpcionPedido {
  grupo_id?: string;
  /** color | tapizado | firmeza | patas | otro */
  tipo: string;
  etiqueta: string;
  valor_id?: string;
  valor: string;
  material?: string | null;
  /** Ajuste de lista que tenía la opción al comprar (S/). */
  ajuste_precio?: number;
  /** true si el cliente no eligió: se registró el valor predeterminado. */
  es_default?: boolean;
}

/** Normaliza lo que llegue de la BD (jsonb nulo, objeto suelto, etc.) a una lista segura. */
export function opcionesDe(raw: unknown): OpcionPedido[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (o): o is OpcionPedido => !!o && typeof o === "object" && typeof (o as OpcionPedido).valor === "string" && typeof (o as OpcionPedido).etiqueta === "string",
  );
}

/**
 * El servidor arma el título como "Nombre (Valor1, Valor2)". Si hay opciones y el título termina así,
 * devuelve solo el nombre para no repetir lo que ya muestran las etiquetas. Si no coincide, devuelve el título.
 */
export function tituloBase(title: string, opciones: OpcionPedido[]): string {
  if (!opciones.length) return title;
  const sufijo = ` (${opciones.map((o) => o.valor).join(", ")})`;
  return title.endsWith(sufijo) ? title.slice(0, -sufijo.length) : title;
}

/** Primera opción de un tipo (p. ej. "tapizado"), sin distinguir mayúsculas. */
export const opcionDeTipo = (opciones: OpcionPedido[], tipo: string) =>
  opciones.find((o) => o.tipo.toLowerCase() === tipo.toLowerCase());
