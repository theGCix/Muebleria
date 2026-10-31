// src/hooks/useCheckoutPrefill.ts
// Trae "Mis datos" y "Mis direcciones" del cliente para autocompletar el checkout.
// Usa las mismas claves de caché que /perfil/datos y /perfil/direcciones: si el cliente edita
// su cuenta y vuelve al checkout, ve lo último que guardó.
import { useQuery } from "@tanstack/react-query";
import { fetchAddresses, fetchProfile, type Address, type Profile } from "@/lib/perfil.functions";
import { DISTRITOS_ENVIO } from "@/lib/envios";

/** Nombre del distrito tal como está en el tarifario (ignora tildes y mayúsculas), o "" si no hay cobertura. */
export function distritoDeTarifa(distrito?: string | null): string {
  const d = (distrito ?? "").trim();
  if (!d) return "";
  return DISTRITOS_ENVIO.find((x) => x.destino.localeCompare(d, "es", { sensitivity: "base" }) === 0)?.destino ?? "";
}

/** Una dirección sirve para el checkout "Lima y Callao" si su distrito tiene tarifa o es de Lima/Callao. */
export function direccionUsable(a: Address): boolean {
  return distritoDeTarifa(a.distrito) !== "" || /lima|callao/i.test(a.ciudad ?? "");
}

/**
 * Dirección a precargar. Si el cliente ya eligió distrito (p. ej. en "Calcula tu envío" de la ficha),
 * solo se usa una dirección guardada de ese mismo distrito; si no, la predeterminada.
 */
export function elegirDireccion(lista: Address[], distritoActual: string): Address | null {
  const usables = lista.filter(direccionUsable);
  if (distritoActual) return usables.find((a) => distritoDeTarifa(a.distrito) === distritoActual) ?? null;
  return usables[0] ?? null; // fetchAddresses ya ordena: predeterminada primero
}

export function useCheckoutPrefill(userId?: string) {
  const perfilQ = useQuery({
    queryKey: ["mi-perfil", userId],
    queryFn: () => fetchProfile(userId!),
    enabled: !!userId,
    staleTime: 60_000,
  });
  const dirQ = useQuery({
    queryKey: ["mis-direcciones", userId],
    queryFn: () => fetchAddresses(userId!),
    enabled: !!userId,
    staleTime: 60_000,
  });
  return {
    /** true cuando ambas consultas terminaron (con datos, vacías o con error) */
    listo: !!userId && perfilQ.status !== "pending" && dirQ.status !== "pending",
    perfil: (perfilQ.data ?? null) as Profile | null,
    direcciones: (dirQ.data ?? []) as Address[],
  };
}
