// src/lib/rutas.ts
// Rutas internas del negocio (panel, POS, producción…) y rutas privadas del cliente.
// Se usan para: (1) no medirlas en GA4/Meta Pixel y (2) marcarlas como noindex.

/** Panel de staff (están detrás de login). No cuentan como tráfico de la tienda. */
export const RUTAS_STAFF = [
  "/admin", "/analytics", "/caja", "/carritos-abandonados", "/carrusel", "/central", "/clientes",
  "/combos", "/correos-pedidos", "/crm", "/cupones", "/dashboard", "/despachos", "/devoluciones",
  "/fotos-clientes", "/gestionar-proyectos", "/insumos", "/leads", "/mi-produccion", "/pedidos",
  "/pos", "/produccion", "/productos", "/proveedores", "/resenas", "/usuarios", "/ventas",
];

/** Rutas del cliente sin valor para buscadores (cuenta, pago, enlaces por pedido). */
const RUTAS_PRIVADAS_CLIENTE = ["/perfil", "/checkout", "/auth", "/restablecer", "/conformidad", "/resena", "/login"];

const coincide = (path: string, lista: string[]) =>
  lista.some((p) => path === p || path.startsWith(`${p}/`));

export const esRutaStaff = (path: string) => coincide(path, RUTAS_STAFF);
export const esRutaNoIndexable = (path: string) =>
  coincide(path, RUTAS_STAFF) || coincide(path, RUTAS_PRIVADAS_CLIENTE);
