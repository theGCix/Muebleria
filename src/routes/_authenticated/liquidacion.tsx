// src/routes/_authenticated/liquidacion.tsx
// Panel «Liquidación» (Catálogo): banners del home por categoría. Cada uno enlaza un producto, lleva la foto de fondo que
// subes, un descuento REAL (se aplica al producto; reemplaza a su oferta, con aviso), envío gratis o con descuento y,
// opcional, el regalo de cojines. En el home salen los 5 más recientes de cada categoría.
import { useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ImagePlus, Loader2, Pencil, Plus, Tags, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyState, ListSkeleton } from "@/components/states";
import { BannerLiquidacion } from "@/components/home/BannerLiquidacion";
import { uploadImage } from "@/lib/cloudinary";
import { slideImg } from "@/hooks/useCarruselHome";
import { CATEGORIAS } from "@/lib/categories";
import { fmtPEN, ofertaInfo } from "@/lib/pricing";
import { partirNombre } from "@/lib/ofertaBanner";
import {
  DESCUENTO_MAX, DESCUENTO_MIN, MAX_BANNERS_POR_CATEGORIA, descuentoDesdePrecio, precioConDescuento, type EnvioTipo,
} from "@/lib/liquidacion";
import {
  guardarLiquidacion, listLiquidacionesAdmin, listProductosLiquidables, quitarLiquidacion,
  type LiquidacionAdmin, type ProductoLiquidable,
} from "@/lib/liquidaciones.functions";

export const Route = createFileRoute("/_authenticated/liquidacion")({
  head: () => ({ meta: [{ title: "Liquidación — G&M" }] }),
  component: LiquidacionAdminPage,
});

interface Form {
  id?: string;
  categoria: string;
  product_id: string;
  imagen_url: string;
  kicker: string;
  nombre: string;
  detalle: string;
  modo: "pct" | "precio";
  pct: string;
  precio: string;
  envio_tipo: EnvioTipo;
  envio_descuento: string;
  regalo_cojines: boolean;
}
const VACIO: Form = {
  categoria: "", product_id: "", imagen_url: "", kicker: "", nombre: "", detalle: "",
  modo: "pct", pct: "", precio: "", envio_tipo: "ninguno", envio_descuento: "", regalo_cojines: false,
};
const nombreCategoria = (slug: string) => CATEGORIAS.find((c) => c.slug === slug)?.nombre ?? slug;

function LiquidacionAdminPage() {
  const qc = useQueryClient();
  const [form, setForm] = useState<Form | null>(null);
  const [subiendo, setSubiendo] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const lista = useQuery({ queryKey: ["liquidaciones-admin"], queryFn: listLiquidacionesAdmin });
  const items = lista.data ?? [];
  const original = form?.id ? items.find((i) => i.id === form.id) : undefined;

  const productos = useQuery({
    queryKey: ["liquidables", form?.categoria],
    queryFn: () => listProductosLiquidables(form!.categoria),
    enabled: !!form?.categoria,
  });
  const producto: ProductoLiquidable | undefined = productos.data?.find((p) => p.id === form?.product_id);

  // Descuento efectivo: directo (%), o el entero más cercano al precio que escribas (la columna del producto es entera)
  const descuento = !form
    ? null
    : form.modo === "pct"
      ? (Number.isInteger(Number(form.pct)) && Number(form.pct) >= DESCUENTO_MIN && Number(form.pct) <= DESCUENTO_MAX ? Number(form.pct) : null)
      : producto ? descuentoDesdePrecio(producto.precio, Number(form.precio)) : null;
  const precioFinal = producto && descuento ? precioConDescuento(producto.precio, descuento) : null;

  const refrescar = () => {
    qc.invalidateQueries({ queryKey: ["liquidaciones-admin"] });
    qc.invalidateQueries({ queryKey: ["liquidaciones-home"] });
    qc.invalidateQueries({ queryKey: ["liquidables"] });
  };

  const guardar = useMutation({
    mutationFn: (f: Form) =>
      guardarLiquidacion({
        id: f.id,
        categoria: f.categoria,
        product_id: f.product_id,
        imagen_url: f.imagen_url,
        kicker: f.kicker || null,
        nombre: f.nombre,
        detalle: f.detalle || null,
        descuento: descuento ?? 0,
        envio_tipo: f.envio_tipo,
        envio_descuento: f.envio_tipo === "descuento" ? Number(f.envio_descuento) || null : null,
        regalo_cojines: f.regalo_cojines,
      }),
    onSuccess: () => {
      toast.success("Liquidación guardada");
      setForm(null);
      refrescar();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const quitar = useMutation({
    mutationFn: (id: string) => quitarLiquidacion(id),
    onSuccess: (restaurado) => {
      toast.success(restaurado ? "Liquidación quitada: el producto volvió a su precio normal" : "Liquidación quitada");
      refrescar();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const subirFoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!form || !file) return;
    setSubiendo(true);
    try {
      const r = await uploadImage(file, "muebleria/liquidacion");
      setForm((cur) => (cur ? { ...cur, imagen_url: r.secure_url } : cur));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo subir la imagen");
    } finally {
      setSubiendo(false);
    }
  };

  const elegirProducto = (id: string) => {
    if (!form) return;
    const p = productos.data?.find((x) => x.id === id);
    const sugerido = p ? partirNombre(p.nombre) : null;
    setForm({
      ...form,
      product_id: id,
      // solo sugiere los textos si aún están vacíos; se pueden editar
      kicker: form.kicker || (sugerido?.kicker ?? ""),
      nombre: form.nombre || (sugerido?.principal.toUpperCase() ?? ""),
    });
  };

  const editar = (l: LiquidacionAdmin) =>
    setForm({
      id: l.id, categoria: l.categoria, product_id: l.product_id, imagen_url: l.imagen_url,
      kicker: l.kicker ?? "", nombre: l.nombre, detalle: l.detalle ?? "",
      modo: "pct", pct: String(l.descuento_aplicado), precio: "",
      envio_tipo: l.envio_tipo, envio_descuento: l.envio_descuento != null ? String(l.envio_descuento) : "",
      regalo_cojines: l.regalo_cojines,
    });

  const intentarGuardar = () => {
    if (!form) return;
    if (!form.categoria) return toast.error("Elige una categoría");
    if (!producto) return toast.error("Elige el producto en liquidación");
    if (!form.imagen_url) return toast.error("Sube la imagen de fondo");
    if (!form.nombre.trim()) return toast.error("Escribe el nombre que irá en el banner");
    if (!descuento || precioFinal === null) {
      return toast.error(form.modo === "pct" ? `El descuento debe ser un entero entre ${DESCUENTO_MIN} y ${DESCUENTO_MAX} %` : "Ese precio no es válido: debe ser menor al precio regular");
    }
    if (form.envio_tipo === "descuento" && !(Number(form.envio_descuento) > 0)) return toast.error("Indica cuántos soles se descuentan del envío");

    const actual = ofertaInfo(producto);
    const mismoDescuento = !!original && original.product_id === producto.id && producto.descuento_porcentaje === original.descuento_aplicado;
    const vence = producto.oferta_vence_el ? `, vence el ${new Date(producto.oferta_vence_el).toLocaleDateString("es-PE")}` : "";
    const linea = `El precio real en la tienda pasará de ${fmtPEN(actual.precioFinal)} a ${fmtPEN(precioFinal)} (${descuento} % sobre ${fmtPEN(producto.precio)}).`;
    const msg =
      actual.activa && !mismoDescuento
        ? `«${producto.nombre}» está en OFERTA (${producto.descuento_porcentaje} %${vence}).\n\nAl pasarlo a liquidación la oferta deja de existir y la reemplaza la liquidación.\n\n${linea}\n\n¿Estás de acuerdo?`
        : `${linea}\n\n¿Guardar la liquidación?`;
    if (window.confirm(msg)) guardar.mutate(form);
  };

  const enCategoria = (slug: string) => items.filter((i) => i.categoria === slug);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-semibold">Liquidación</h1>
          <p className="mt-0.5 max-w-xl text-sm text-muted-foreground">
            Banners del home por categoría. En la tienda salen los {MAX_BANNERS_POR_CATEGORIA} más recientes de cada una. El
            descuento se aplica de verdad al producto y reemplaza a su oferta. Foto de fondo recomendada: 1600 × 1200 px, sin
            texto, con el mueble al centro.
          </p>
        </div>
        <Button className="h-11 sm:h-9" onClick={() => setForm({ ...VACIO })}>
          <Plus className="mr-1.5 h-4 w-4" /> Agregar liquidación
        </Button>
      </div>

      {lista.isLoading ? (
        <ListSkeleton />
      ) : lista.isError ? (
        <EmptyState title="No se pudo cargar" description="Si es la primera vez, ejecuta la migración 20261118_liquidaciones.sql en Supabase." />
      ) : items.length === 0 ? (
        <EmptyState icon={Tags} title="Aún no hay liquidaciones" description="Agrega la primera: elige la categoría, el producto y la foto de fondo." />
      ) : (
        CATEGORIAS.map((c) => {
          const lis = enCategoria(c.slug);
          if (lis.length === 0) return null;
          return (
            <section key={c.slug} className="space-y-2">
              <h2 className="text-sm font-semibold">
                {c.nombre} <span className="font-normal text-muted-foreground">· {lis.length} {lis.length === 1 ? "liquidación" : "liquidaciones"}
                {lis.length > MAX_BANNERS_POR_CATEGORIA ? ` (en el home salen las ${MAX_BANNERS_POR_CATEGORIA} más recientes)` : ""}</span>
              </h2>
              <ul className="space-y-3">
                {lis.map((l, i) => {
                  const p = l.producto;
                  const info = p ? ofertaInfo({ precio: Number(p.precio), descuento_porcentaje: p.descuento_porcentaje, oferta_vence_el: p.oferta_vence_el }) : null;
                  const desfasada = !!p && (!info?.activa || p.descuento_porcentaje !== l.descuento_aplicado);
                  return (
                    <li key={l.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card p-3">
                      <img src={slideImg(l.imagen_url, 400)} alt="" loading="lazy" className="h-16 w-24 shrink-0 rounded-lg bg-muted object-cover" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">
                          {l.kicker ? `${l.kicker} ` : ""}{l.nombre}{l.detalle ? ` ${l.detalle}` : ""}
                          {i < MAX_BANNERS_POR_CATEGORIA && <span className="ml-2 rounded-full bg-secondary px-2 py-0.5 text-xs font-normal">En el home</span>}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {p ? `${p.nombre} · ` : ""}
                          {info ? `${fmtPEN(info.precioFinal)} (regular ${fmtPEN(Number(p!.precio))})` : "producto no encontrado"}
                          {l.envio_tipo === "gratis" ? " · Delivery gratis" : l.envio_tipo === "descuento" ? ` · Envío −S/ ${l.envio_descuento}` : ""}
                          {l.regalo_cojines ? " · Cojines" : ""}
                        </p>
                        {desfasada && (
                          <p className="text-xs font-medium text-destructive">
                            El descuento del producto ya no coincide con la liquidación (cambió en Productos o venció): este banner no se muestra hasta que lo guardes de nuevo.
                          </p>
                        )}
                      </div>
                      <div className="flex">
                        <Button size="icon" variant="ghost" className="h-11 w-11 sm:h-8 sm:w-8" aria-label="Editar" onClick={() => editar(l)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-11 w-11 text-destructive sm:h-8 sm:w-8" aria-label="Quitar liquidación"
                          onClick={() => {
                            if (window.confirm("¿Quitar esta liquidación?\n\nSe retira el descuento de liquidación del producto y vuelve a su precio normal (si ya lo habías cambiado desde Productos, no se toca).")) quitar.mutate(l.id);
                          }}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })
      )}

      <Dialog open={!!form} onOpenChange={(o) => !o && setForm(null)}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
          {form && (
            <>
              <DialogHeader>
                <DialogTitle>{form.id ? "Editar liquidación" : "Nueva liquidación"}</DialogTitle>
              </DialogHeader>

              <div className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label>Categoría</Label>
                    <Select value={form.categoria} onValueChange={(v) => setForm({ ...form, categoria: v, product_id: "" })}>
                      <SelectTrigger><SelectValue placeholder="Elige una categoría" /></SelectTrigger>
                      <SelectContent>
                        {CATEGORIAS.map((c) => <SelectItem key={c.slug} value={c.slug}>{c.nombre}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Producto en liquidación</Label>
                    <Select value={form.product_id} onValueChange={elegirProducto} disabled={!form.categoria || productos.isLoading}>
                      <SelectTrigger><SelectValue placeholder={form.categoria ? (productos.isLoading ? "Cargando…" : "Elige el producto") : "Primero la categoría"} /></SelectTrigger>
                      <SelectContent>
                        {(productos.data ?? []).map((p) => (
                          <SelectItem key={p.id} value={p.id}>{p.nombre} · {fmtPEN(Number(p.precio))}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">Al hacer clic en el banner, el cliente va a la ficha de este producto.</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Imagen de fondo</Label>
                  <button
                    type="button"
                    disabled={subiendo}
                    onClick={() => inputRef.current?.click()}
                    className="relative flex aspect-[4/3] w-full max-w-xs items-center justify-center overflow-hidden rounded-lg border-2 border-dashed border-border bg-muted text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    {form.imagen_url ? (
                      <img src={slideImg(form.imagen_url, 600)} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <span className="flex flex-col items-center text-xs"><ImagePlus className="mb-1 h-5 w-5" /> Subir imagen</span>
                    )}
                    {subiendo && <span className="absolute inset-0 grid place-items-center bg-background/70"><Loader2 className="h-5 w-5 animate-spin" /></span>}
                  </button>
                  <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={subirFoto} />
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="l-kicker">Rótulo</Label>
                    <Input id="l-kicker" maxLength={40} placeholder="Juego de sala" value={form.kicker} onChange={(e) => setForm({ ...form, kicker: e.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="l-nombre">Nombre</Label>
                    <Input id="l-nombre" maxLength={40} placeholder="ONIX" value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="l-detalle">Detalle</Label>
                    <Input id="l-detalle" maxLength={40} placeholder="3-2-1 + Banqueta" value={form.detalle} onChange={(e) => setForm({ ...form, detalle: e.target.value })} />
                  </div>
                </div>

                <div className="space-y-2 rounded-lg border border-border p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Label>Descuento</Label>
                    <div className="inline-flex rounded-lg border border-border p-0.5 text-xs">
                      {(["pct", "precio"] as const).map((m) => (
                        <button key={m} type="button" onClick={() => setForm({ ...form, modo: m })}
                          className={`h-9 rounded-md px-3 sm:h-7 ${form.modo === m ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>
                          {m === "pct" ? "Por porcentaje" : "Por precio"}
                        </button>
                      ))}
                    </div>
                  </div>
                  {form.modo === "pct" ? (
                    <Input type="number" inputMode="numeric" min={DESCUENTO_MIN} max={DESCUENTO_MAX} step={1} placeholder="Ej. 35" value={form.pct}
                      onChange={(e) => setForm({ ...form, pct: e.target.value })} aria-label="Descuento en porcentaje" />
                  ) : (
                    <Input type="number" inputMode="decimal" min={1} step="0.01" placeholder="Precio de liquidación en S/" value={form.precio}
                      onChange={(e) => setForm({ ...form, precio: e.target.value })} aria-label="Precio de liquidación" />
                  )}
                  <p className="text-xs text-muted-foreground">
                    {!producto
                      ? "Elige el producto para ver el precio."
                      : precioFinal !== null && descuento
                        ? `Precio regular ${fmtPEN(Number(producto.precio))} → precio final ${fmtPEN(precioFinal)} (${descuento} %). ${form.modo === "precio" ? "El descuento es un porcentaje entero, por eso el precio final puede variar unos céntimos del que escribiste." : ""}`
                        : "Escribe un descuento válido."}
                    {producto && ofertaInfo(producto).activa && !(original && original.product_id === producto.id && producto.descuento_porcentaje === original.descuento_aplicado) &&
                      ` Este producto está en oferta (${producto.descuento_porcentaje} %): al guardar, la liquidación la reemplaza.`}
                  </p>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label>Envío</Label>
                    <Select value={form.envio_tipo} onValueChange={(v) => setForm({ ...form, envio_tipo: v as EnvioTipo })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ninguno">Sin sello de envío</SelectItem>
                        <SelectItem value="gratis">Delivery gratis</SelectItem>
                        <SelectItem value="descuento">Descuento en el envío</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {form.envio_tipo === "descuento" && (
                    <div className="space-y-1.5">
                      <Label htmlFor="l-envio">Descuento del envío (S/)</Label>
                      <Input id="l-envio" type="number" inputMode="decimal" min={1} step="0.5" placeholder="Ej. 20" value={form.envio_descuento}
                        onChange={(e) => setForm({ ...form, envio_descuento: e.target.value })} />
                    </div>
                  )}
                </div>
                {form.envio_tipo !== "ninguno" && (
                  <p className="text-xs text-muted-foreground">
                    Por ahora el sello es solo visual: el checkout todavía cobra el envío por distrito. Pendiente de aplicarlo en el cobro.
                  </p>
                )}

                <label className="flex items-center gap-2 text-sm">
                  <Switch checked={form.regalo_cojines} onCheckedChange={(v) => setForm({ ...form, regalo_cojines: v })} />
                  Incluye «GRATIS · juego de cojines»
                </label>

                <div className="space-y-1.5">
                  <Label>Vista previa</Label>
                  {producto && descuento && precioFinal !== null && form.imagen_url ? (
                    <BannerLiquidacion
                      className="aspect-[4/3] w-full max-w-sm"
                      d={{
                        imagen: form.imagen_url, kicker: form.kicker || null, nombre: form.nombre || "NOMBRE", detalle: form.detalle || null,
                        precioRegular: Number(producto.precio), precioFinal, descuento,
                        envioTipo: form.envio_tipo, envioDescuento: Number(form.envio_descuento) || null, regaloCojines: form.regalo_cojines,
                      }}
                    />
                  ) : (
                    <p className="text-xs text-muted-foreground">Elige el producto, el descuento y la imagen para ver cómo queda.</p>
                  )}
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setForm(null)}>Cancelar</Button>
                <Button disabled={guardar.isPending || subiendo} onClick={intentarGuardar}>
                  {guardar.isPending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />} Guardar
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
