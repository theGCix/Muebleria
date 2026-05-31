import { createFileRoute } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ExternalLink, BookOpen, Github, Video } from "lucide-react";

export const Route = createFileRoute("/_authenticated/crm")({
  head: () => ({ meta: [{ title: "CRM — G&M" }] }),
  component: CrmPage,
});

const resources = [
  {
    title: "Twenty CRM (Open Source)",
    desc: "CRM open source moderno, similar a Salesforce. Se puede autoalojar. Tiene clientes, leads, oportunidades, pipeline de ventas y más.",
    url: "https://github.com/twentyhq/twenty",
    icon: Github,
    tag: "Autoalojable",
    recommended: true,
  },
  {
    title: "ERPNext CRM",
    desc: "Módulo CRM completo dentro de ERPNext (también open source). Incluye seguimiento de leads, cotizaciones, y se integra con ventas y contabilidad.",
    url: "https://erpnext.com/crm",
    icon: ExternalLink,
    tag: "ERP completo",
  },
  {
    title: "Documentación Twenty CRM",
    desc: "Guía de instalación y configuración de Twenty CRM con Docker. Puedes integrarlo con tu Supabase existente vía API.",
    url: "https://twenty.com/developers",
    icon: BookOpen,
    tag: "Docs",
  },
  {
    title: "Tutorial: CRM con Supabase + React",
    desc: "Ejemplo de CRM básico construido sobre Supabase con TanStack Query, similar a tu stack actual. Puedes reutilizar como base.",
    url: "https://github.com/supabase/supabase/tree/master/examples",
    icon: Video,
    tag: "Tutorial",
  },
];

const mrpResources = [
  {
    title: "Odoo Manufacturing (MRP)",
    desc: "El módulo MRP de Odoo es gratuito en comunidad. Incluye órdenes de fabricación, lista de materiales (BOM), planificación y stock.",
    url: "https://www.odoo.com/es_ES/app/manufacturing",
    icon: ExternalLink,
    tag: "Gratuito comunidad",
    recommended: true,
  },
  {
    title: "ERPNext Manufacturing",
    desc: "MRP open source completo. Ordenes de trabajo, planificación de capacidad, BOM. 100% gratuito y autoalojable.",
    url: "https://docs.erpnext.com/docs/user/manual/en/manufacturing",
    icon: BookOpen,
    tag: "Open source",
  },
  {
    title: "MRPeasy",
    desc: "MRP en la nube para pequeñas empresas. Prueba gratuita de 30 días. Fácil de implementar sin servidor propio.",
    url: "https://www.mrpeasy.com",
    icon: ExternalLink,
    tag: "SaaS",
  },
];

function CrmPage() {
  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-display font-semibold">CRM y MRP</h1>
        <p className="text-muted-foreground mt-1">
          Recursos para implementar gestión de clientes y planificación de producción
        </p>
      </div>

      <Card className="p-5 bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800">
        <h2 className="font-semibold text-blue-800 dark:text-blue-200 mb-2">💡 Recomendación</h2>
        <p className="text-sm text-blue-700 dark:text-blue-300">
          Para una mueblería, lo más práctico es <strong>Twenty CRM</strong> para gestión de clientes/leads
          y <strong>ERPNext</strong> si necesitas MRP completo (control de materiales, fabricación).
          Ambos son open source y se pueden autoalojar o usar en la nube gratuitamente.
          No hay que reinventar la rueda: integra tu sistema actual con sus APIs REST.
        </p>
      </Card>

      <section>
        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
          👥 CRM — Gestión de Clientes y Ventas
        </h2>
        <div className="grid gap-4 md:grid-cols-2">
          {resources.map((r) => (
            <Card key={r.title} className={`p-4 ${r.recommended ? "ring-2 ring-primary/30" : ""}`}>
              {r.recommended && (
                <span className="text-xs font-medium bg-primary text-primary-foreground px-2 py-0.5 rounded mb-2 inline-block">
                  ⭐ Recomendado
                </span>
              )}
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-semibold">{r.title}</h3>
                <span className="text-xs bg-muted px-2 py-0.5 rounded whitespace-nowrap">{r.tag}</span>
              </div>
              <p className="text-sm text-muted-foreground mt-1">{r.desc}</p>
              <Button asChild size="sm" variant="outline" className="mt-3">
                <a href={r.url} target="_blank" rel="noreferrer">
                  <r.icon className="h-3.5 w-3.5 mr-1" /> Ver recurso
                </a>
              </Button>
            </Card>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
          🏭 MRP — Planificación de Materiales y Producción
        </h2>
        <div className="grid gap-4 md:grid-cols-2">
          {mrpResources.map((r) => (
            <Card key={r.title} className={`p-4 ${r.recommended ? "ring-2 ring-primary/30" : ""}`}>
              {r.recommended && (
                <span className="text-xs font-medium bg-primary text-primary-foreground px-2 py-0.5 rounded mb-2 inline-block">
                  ⭐ Recomendado
                </span>
              )}
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-semibold">{r.title}</h3>
                <span className="text-xs bg-muted px-2 py-0.5 rounded whitespace-nowrap">{r.tag}</span>
              </div>
              <p className="text-sm text-muted-foreground mt-1">{r.desc}</p>
              <Button asChild size="sm" variant="outline" className="mt-3">
                <a href={r.url} target="_blank" rel="noreferrer">
                  <r.icon className="h-3.5 w-3.5 mr-1" /> Ver recurso
                </a>
              </Button>
            </Card>
          ))}
        </div>
      </section>

      <Card className="p-5">
        <h3 className="font-semibold mb-2">🔗 Cómo integrar con tu sistema actual</h3>
        <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
          <li>Twenty CRM tiene una API GraphQL — puedes sincronizar clientes desde tu tabla <code>customers</code> de Supabase</li>
          <li>ERPNext tiene una API REST — puedes crear órdenes de compra cuando el stock baje del mínimo</li>
          <li>Ambos sistemas admiten webhooks para notificar tu sistema en tiempo real</li>
          <li>Alternativa simple: usar Supabase Edge Functions como puente entre sistemas</li>
        </ul>
      </Card>
    </div>
  );
}
