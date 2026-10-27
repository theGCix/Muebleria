import {
  LayoutDashboard, ShoppingCart, ShoppingBag, ShoppingBasket, Receipt, Users, UserCog, Package,
  LayoutGrid, UserPlus, Star, Boxes, Hammer, Wrench, Truck, BarChart2, PackageCheck, Tag, Navigation, Wallet, Undo2, Images,
  type LucideIcon,
} from "lucide-react";
import type { AppRole } from "@/hooks/useAuth";
import type { CountKey } from "@/hooks/useSidebarCounts";

export type NavItem = {
  title: string;
  url: string;
  icon: LucideIcon;
  roles: AppRole[];
  countKey?: CountKey;
};
export type NavGroup = { label: string; items: NavItem[]; alwaysOpen?: boolean };

const ADMIN_VENDEDOR: AppRole[] = ["admin", "vendedor"];
const ADMIN: AppRole[] = ["admin"];
const CARPINTERO: AppRole[] = ["carpintero"];

// Acción principal: va como botón destacado bajo el logo, fuera de los grupos.
export const POS_ITEM: NavItem = {
  title: "Realizar Venta", url: "/pos", icon: ShoppingCart, roles: ADMIN_VENDEDOR,
};

// Única fuente de verdad del menú: la usan el sidebar, las migas de pan y el buscador.
// Si cambias o agregas rutas, hazlo aquí.
export const groups: NavGroup[] = [
  {
    label: "General",
    alwaysOpen: true,
    items: [
      { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard, roles: ADMIN_VENDEDOR },
      { title: "Analytics", url: "/analytics", icon: BarChart2, roles: ADMIN_VENDEDOR },
      { title: "Central KPIs", url: "/central", icon: LayoutGrid, roles: ADMIN_VENDEDOR },
    ],
  },
  {
    label: "Ventas",
    items: [
      { title: "Pedidos", url: "/pedidos", icon: ShoppingBag, roles: ADMIN_VENDEDOR, countKey: "pedidos" },
      { title: "Despachos", url: "/despachos", icon: Navigation, roles: ADMIN_VENDEDOR },
      { title: "Ventas Realizadas", url: "/ventas", icon: Receipt, roles: ADMIN_VENDEDOR },
      { title: "Caja y gastos", url: "/caja", icon: Wallet, roles: ADMIN_VENDEDOR },
      { title: "Devoluciones", url: "/devoluciones", icon: Undo2, roles: ADMIN_VENDEDOR },
    ],
  },
  {
    label: "Clientes y Marketing",
    items: [
      { title: "Clientes", url: "/clientes", icon: Users, roles: ADMIN_VENDEDOR },
      { title: "Leads", url: "/leads", icon: UserPlus, roles: ADMIN_VENDEDOR, countKey: "leads" },
      { title: "Carritos abandonados", url: "/carritos-abandonados", icon: ShoppingBasket, roles: ADMIN_VENDEDOR, countKey: "carritos" },
      { title: "Reseñas", url: "/resenas", icon: Star, roles: ADMIN_VENDEDOR, countKey: "resenas" },
      { title: "Testimonios", url: "/testimonios", icon: Images, roles: ADMIN_VENDEDOR },
      { title: "Cupones", url: "/cupones", icon: Tag, roles: ADMIN },
    ],
  },
  {
    label: "Catálogo",
    items: [
      { title: "Productos", url: "/productos", icon: Package, roles: ADMIN },
      { title: "Combos", url: "/combos", icon: PackageCheck, roles: ADMIN },
    ],
  },
  {
    label: "Fabricación",
    items: [
      { title: "Mis órdenes", url: "/mi-produccion", icon: Wrench, roles: CARPINTERO },
      { title: "Producción", url: "/produccion", icon: Hammer, roles: ADMIN_VENDEDOR },
      { title: "Insumos MRP", url: "/insumos", icon: Boxes, roles: ADMIN_VENDEDOR, countKey: "insumos" },
      { title: "Proveedores", url: "/proveedores", icon: Truck, roles: ADMIN_VENDEDOR },
    ],
  },
  {
    label: "Administración",
    items: [
      { title: "Usuarios", url: "/usuarios", icon: UserCog, roles: ADMIN },
    ],
  },
];

export const canSee = (item: NavItem, roles: AppRole[]) => item.roles.some((r) => roles.includes(r));

// Título y grupo de la página actual, para las migas de pan.
export function findCrumb(pathname: string): { group?: string; title: string } {
  if (pathname === POS_ITEM.url) return { group: "Ventas", title: POS_ITEM.title };
  for (const g of groups) {
    const item = g.items.find((i) => i.url === pathname);
    if (item) return { group: g.label === "General" ? undefined : g.label, title: item.title };
  }
  const last = pathname.split("/").filter(Boolean).pop() ?? "Inicio";
  return { title: last.charAt(0).toUpperCase() + last.slice(1) };
}