import { useEffect, useState } from "react";
import { useRouterState } from "@tanstack/react-router";
import { Search } from "lucide-react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import {
  Breadcrumb, BreadcrumbItem, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { GlobalSearch } from "@/components/GlobalSearch";
import { NotificationsBell } from "@/components/NotificationsBell";
import { findCrumb } from "@/components/nav-config";
import type { AppRole } from "@/hooks/useAuth";

export function AdminTopbar({ roles }: { roles: AppRole[] }) {
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const crumb = findCrumb(pathname);
  const [searchOpen, setSearchOpen] = useState(false);
  const [isMac, setIsMac] = useState(false);

  // Solo el personal de ventas/administración usa buscador y pendientes.
  const isStaff = roles.includes("admin") || roles.includes("vendedor");

  useEffect(() => {
    setIsMac(/Mac|iPhone|iPad/.test(navigator.platform));
  }, []);

  // Atajo Ctrl+K / ⌘K
  useEffect(() => {
    if (!isStaff) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isStaff]);

  return (
    <header className="sticky top-0 z-10 flex h-14 items-center gap-3 border-b bg-background px-4">
      <SidebarTrigger />
      <div className="h-5 w-px bg-border" />

      <Breadcrumb className="min-w-0">
        <BreadcrumbList className="flex-nowrap">
          {crumb.group && (
            <>
              <BreadcrumbItem className="hidden text-muted-foreground sm:inline-flex">{crumb.group}</BreadcrumbItem>
              <BreadcrumbSeparator className="hidden sm:block" />
            </>
          )}
          <BreadcrumbItem className="min-w-0">
            <BreadcrumbPage className="truncate font-semibold">{crumb.title}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="flex-1" />

      {isStaff && (
        <>
          <button
            type="button"
            onClick={() => setSearchOpen(true)}
            className="inline-flex h-9 items-center gap-2 rounded-md border bg-muted/40 px-3 text-sm text-muted-foreground transition-colors hover:bg-accent sm:w-64"
            aria-label="Buscar"
          >
            <Search className="h-4 w-4" />
            <span className="hidden flex-1 text-left sm:inline">Buscar…</span>
            <kbd className="hidden rounded border bg-background px-1.5 py-0.5 text-[10px] font-medium sm:inline">
              {isMac ? "⌘K" : "Ctrl K"}
            </kbd>
          </button>
          <NotificationsBell roles={roles} />
          <GlobalSearch open={searchOpen} onOpenChange={setSearchOpen} roles={roles} />
        </>
      )}
    </header>
  );
}
