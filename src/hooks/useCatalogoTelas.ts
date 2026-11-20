// src/hooks/useCatalogoTelas.ts
// Catálogo de telas para el selector de tapizado: se lee de Supabase (lo que se edita en /telas).
// Si la consulta falla o viene vacía, se usa el catálogo fijo de src/lib/telas.ts: el selector nunca queda vacío.
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { CATEGORIAS_TELA, TELAS, type CategoriaTela, type Tela } from "@/lib/telas";

interface Catalogo { categorias: CategoriaTela[]; telas: Tela[] }
const FIJO: Catalogo = { categorias: CATEGORIAS_TELA, telas: TELAS };

/** Cloudinary: textura de 512 px (suficiente para el 3D y liviana); las rutas locales quedan igual. */
const img = (u: string) =>
  u.includes("res.cloudinary.com") && u.includes("/upload/") && !/\/upload\/[a-z]_/.test(u) ? u.replace("/upload/", "/upload/w_512,q_auto/") : u;

async function leer(): Promise<Catalogo> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const [cat, tel] = await Promise.all([
    sb.from("tela_categorias").select("id, nombre").order("id", { ascending: true }),
    sb.from("telas").select("id, numero, categoria_id, nombre, descripcion, imagen, hex, patron").eq("activo", true).order("numero", { ascending: true }),
  ]);
  if (cat.error || tel.error || !tel.data?.length || !cat.data?.length) return FIJO;
  const telas: Tela[] = tel.data.map((t: any) => ({
    id: t.id, numero: t.numero, categoria: t.categoria_id, nombre: t.nombre, descripcion: t.descripcion ?? "",
    imagen: img(t.imagen), hex: t.hex, patron: !!t.patron,
  }));
  // Solo categorías que tengan al menos una tela activa
  const categorias: CategoriaTela[] = cat.data.filter((c: CategoriaTela) => telas.some((t) => t.categoria === c.id));
  return categorias.length ? { categorias, telas } : FIJO;
}

export function useCatalogoTelas() {
  const q = useQuery({ queryKey: ["telas-publico"], queryFn: leer, staleTime: 5 * 60_000, placeholderData: FIJO });
  const cat = q.data ?? FIJO;
  return useMemo(() => ({
    categorias: cat.categorias,
    telas: cat.telas,
    buscarTela: (id: string | null | undefined) => cat.telas.find((t) => t.id === id) ?? null,
    telasDeCategoria: (categoria: number) => cat.telas.filter((t) => t.categoria === categoria),
  }), [cat]);
}
