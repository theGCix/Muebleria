import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { searchCustomers } from "@/lib/pos.functions";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { Loader2, Search } from "lucide-react";

export const Route = createFileRoute("/_authenticated/clientes")({
  head: () => ({ meta: [{ title: "Clientes — G&M POS" }] }),
  component: ClientesPage,
});

function ClientesPage() {
  const [q, setQ] = useState("");
  const { data, isLoading } = useQuery({ queryKey: ["customers-list", q], queryFn: () => searchCustomers({ data: { q } }) });
  return (
    <div className="max-w-5xl mx-auto space-y-4">
      <div>
        <h1 className="text-3xl font-display font-semibold">Clientes</h1>
        <p className="text-muted-foreground">Directorio de clientes registrados</p>
      </div>
      <Card className="p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Buscar por nombre o documento" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      </Card>
      <Card className="overflow-hidden">
        {isLoading ? (
          <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin" /></div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left">
              <tr><th className="px-4 py-3">Nombre</th><th className="px-4 py-3">Documento</th><th className="px-4 py-3">Contacto</th></tr>
            </thead>
            <tbody>
              {(data?.customers ?? []).map((c: any) => (
                <tr key={c.id} className="border-t">
                  <td className="px-4 py-3 font-medium">{c.nombre}</td>
                  <td className="px-4 py-3">{c.doc_tipo} {c.doc_numero}</td>
                  <td className="px-4 py-3 text-muted-foreground">{c.email ?? ""} {c.telefono ? `· ${c.telefono}` : ""}</td>
                </tr>
              ))}
              {(data?.customers ?? []).length === 0 && (
                <tr><td colSpan={3} className="text-center py-10 text-muted-foreground">Sin clientes.</td></tr>
              )}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}