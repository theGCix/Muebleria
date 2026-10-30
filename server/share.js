// server/share.js
// ════════════════════════════════════════════════════════════════
// ENLACES PARA COMPARTIR con vista previa (WhatsApp, Facebook, Instagram, Telegram, X…).
//
// La tienda es una SPA estática: esos rastreadores NO ejecutan JavaScript, así que cualquier
// enlace /product/<id> se vería con la vista previa genérica. Estas rutas devuelven un HTML
// mínimo con las metas Open Graph del producto/combo y redirigen al visitante a la tienda.
//
//   GET /share/product/:id   →  vista previa del producto  (luego redirige a FRONTEND_URL/product/:id)
//   GET /share/combo/:id     →  vista previa del combo     (luego redirige a FRONTEND_URL/combo/:id)
//
// Conexión en server/index.js (ya aplicada en este paquete):
//   import { registerShare } from "./share.js";
//   registerShare({ app, supabaseAdmin, rateLimit });   // antes de app.listen()
//
// Variables de entorno del servidor:
//   FRONTEND_URL                 ya existe; URL pública de la tienda
//   CLOUDINARY_CLOUD_NAME        (o VITE_CLOUDINARY_CLOUD_NAME) para construir la imagen si el producto
//                                solo guarda `imagen_public_id`
// Importante: usa el enlace de la API que NO se duerma (WhatsApp espera pocos segundos a la vista previa).
// ════════════════════════════════════════════════════════════════

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SITE_NAME = "G&M Mueblería";

const esc = (v) =>
  String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

const recortar = (t, n = 160) => {
  const s = String(t ?? "").replace(/\s+/g, " ").trim();
  return s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s;
};

const soles = (n) => `S/ ${Number(n).toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function front() {
  return (process.env.FRONTEND_URL ?? "http://localhost:5173").replace(/\/+$/, "");
}

function cloudinary(publicId) {
  const cloud = process.env.CLOUDINARY_CLOUD_NAME || process.env.VITE_CLOUDINARY_CLOUD_NAME;
  if (!cloud || !publicId) return null;
  // 1200 de ancho, formato y calidad automáticos (rápido de descargar para el rastreador)
  return `https://res.cloudinary.com/${cloud}/image/upload/w_1200,q_auto,f_auto/${publicId}`;
}

function imagenDe(row) {
  const galeria = Array.isArray(row.imagenes) ? row.imagenes : [];
  const primera = galeria.find((i) => i?.url)?.url;
  return primera || cloudinary(row.imagen_public_id) || row.imagen_url || `${front()}/og-default.jpg`;
}

function precioFinal(p) {
  const vence = p.oferta_vence_el ? new Date(p.oferta_vence_el).getTime() : null;
  const activa = !!p.descuento_porcentaje && p.descuento_porcentaje > 0 && (!vence || vence > Date.now());
  return activa ? Math.round(p.precio * (1 - p.descuento_porcentaje / 100) * 100) / 100 : p.precio;
}

function pagina({ titulo, descripcion, imagen, destino, tipo, precio }) {
  const t = esc(titulo);
  const d = esc(descripcion);
  const url = esc(destino);
  return `<!doctype html>
<html lang="es-PE">
<head>
<meta charset="utf-8">
<title>${t}</title>
<meta name="description" content="${d}">
<meta name="robots" content="noindex">
<link rel="canonical" href="${url}">
<meta property="og:site_name" content="${esc(SITE_NAME)}">
<meta property="og:locale" content="es_PE">
<meta property="og:type" content="${tipo}">
<meta property="og:title" content="${t}">
<meta property="og:description" content="${d}">
<meta property="og:url" content="${url}">
<meta property="og:image" content="${esc(imagen)}">
<meta property="og:image:alt" content="${t}">
${precio != null ? `<meta property="product:price:amount" content="${Number(precio).toFixed(2)}">\n<meta property="product:price:currency" content="PEN">\n` : ""}<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${t}">
<meta name="twitter:description" content="${d}">
<meta name="twitter:image" content="${esc(imagen)}">
<meta http-equiv="refresh" content="0;url=${url}">
</head>
<body>
<p><a href="${url}">Ver en ${esc(SITE_NAME)}</a></p>
<script>location.replace(${JSON.stringify(destino)});</script>
</body>
</html>`;
}

export function registerShare({ app, supabaseAdmin, rateLimit }) {
  const limitador = rateLimit({ windowMs: 60_000, max: 120, standardHeaders: true, legacyHeaders: false });

  const responder = (res, html, status = 200) =>
    res
      .status(status)
      .set({ "Content-Type": "text/html; charset=utf-8", "Cache-Control": "public, max-age=300" })
      .send(html);

  // Si algo falla o no existe, el visitante igual llega a la tienda
  const alInicio = (res, ruta = "") => responder(res, pagina({
    titulo: `${SITE_NAME} — Muebles artesanales de madera natural`,
    descripcion: "Muebles de madera natural hechos a mano en Lima. Entrega a domicilio y envío a provincias.",
    imagen: `${front()}/og-default.jpg`,
    destino: `${front()}${ruta}`,
    tipo: "website",
  }), 200);

  app.get("/share/product/:id", limitador, async (req, res) => {
    const { id } = req.params;
    if (!UUID_RE.test(id)) return alInicio(res, "/catalogo");
    try {
      const { data: p, error } = await supabaseAdmin
        .from("products")
        .select("id,nombre,descripcion,precio,categoria,imagenes,imagen_public_id,imagen_url,descuento_porcentaje,oferta_vence_el,activo")
        .eq("id", id)
        .maybeSingle();
      if (error || !p || p.activo === false) return alInicio(res, "/catalogo");

      const precio = precioFinal(p);
      const base = recortar(p.descripcion, 130) || "Mueble de madera natural fabricado a pedido en Lima.";
      responder(res, pagina({
        titulo: `${p.nombre} — ${SITE_NAME}`,
        descripcion: `${soles(precio)} · ${base}`,
        imagen: imagenDe(p),
        destino: `${front()}/product/${p.id}`,
        tipo: "product",
        precio,
      }));
    } catch {
      alInicio(res, "/catalogo");
    }
  });

  app.get("/share/combo/:id", limitador, async (req, res) => {
    const { id } = req.params;
    if (!UUID_RE.test(id)) return alInicio(res, "/catalogo");
    try {
      const { data: c, error } = await supabaseAdmin
        .from("combos")
        .select("id,nombre,descripcion,precio_combo,imagen_public_id,imagen_url,activo,vence_el")
        .eq("id", id)
        .maybeSingle();
      const vencido = c?.vence_el && new Date(c.vence_el).getTime() < Date.now();
      if (error || !c || c.activo === false || vencido) return alInicio(res, "/catalogo");

      const base = recortar(c.descripcion, 130) || "Combo de muebles de madera natural: ahorras comprando el conjunto.";
      responder(res, pagina({
        titulo: `${c.nombre} — Combo | ${SITE_NAME}`,
        descripcion: `${soles(c.precio_combo)} · ${base}`,
        imagen: imagenDe(c),
        destino: `${front()}/combo/${c.id}`,
        tipo: "product",
        precio: c.precio_combo,
      }));
    } catch {
      alInicio(res, "/catalogo");
    }
  });
}
