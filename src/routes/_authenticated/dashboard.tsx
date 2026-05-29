import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { getDashboard } from "@/lib/pos.functions";
import { Card } from "@/components/ui/card";
import { Loader2, TrendingUp, ShoppingBag, Users, Award } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";
import { startOfMonth, startOfQuarter, startOfYear, format } from "date-fns";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — G&M POS" }] }),
  component: DashboardPage,
});

const fmt = (n: number) =>
  new Intl.NumberFormat("es-PE", { style: "currency", currency: "PEN" }).format(n);

function DashboardPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => getDashboard(),
  });

  if (isLoading || !data) {
    return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }

  const { sales, items, customers, profiles } = data;
  const now = new Date();
  const totMes = sales.filter((s) => new Date(s.created_at) >= startOfMonth(now)).reduce((a, s) => a + Number(s.total), 0);
  const totTrim = sales.filter((s) => new Date(s.created_at) >= startOfQuarter(now)).reduce((a, s) => a + Number(s.total), 0);
  const totAnio = sales.filter((s) => new Date(s.created_at) >= startOfYear(now)).reduce((a, s) => a + Number(s.total), 0);

  const byMonth: Record<string, number> = {};
  sales.forEach((s) => {
    const k = format(new Date(s.created_at), "yyyy-MM");
    byMonth[k] = (byMonth[k] || 0) + Number(s.total);
  });
  const monthData = Object.entries(byMonth).sort().slice(-12).map(([m, total]) => ({ mes: m, total }));

  const productMap: Record<string, { qty: number; total: number }> = {};
  items.forEach((it: any) => {
    const k = it.title;
    if (!productMap[k]) productMap[k] = { qty: 0, total: 0 };
    productMap[k].qty += Number(it.qty);
    productMap[k].total += Number(it.total);
  });
  const topProducts = Object.entries(productMap)
    .map(([title, v]) => ({ title, ...v }))
    .sort((a, b) => b.qty - a.qty)
    .slice(0, 5);

  const sellerMap: Record<string, number> = {};
  sales.forEach((s) => { if (s.vendedor_id) sellerMap[s.vendedor_id] = (sellerMap[s.vendedor_id] || 0) + Number(s.total); });
  const topSeller = Object.entries(sellerMap).sort((a, b) => b[1] - a[1])[0];
  const topSellerName = topSeller ? (profiles.find((p) => p.id === topSeller[0])?.full_name ?? "—") : "—";

  const buyerMap: Record<string, number> = {};
  sales.forEach((s) => { if (s.customer_id) buyerMap[s.customer_id] = (buyerMap[s.customer_id] || 0) + Number(s.total); });
  const topBuyer = Object.entries(buyerMap).sort((a, b) => b[1] - a[1])[0];
  const topBuyerName = topBuyer ? (customers.find((c) => c.id === topBuyer[0])?.nombre ?? "—") : "—";

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-3xl font-display font-semibold">Dashboard</h1>
        <p className="text-muted-foreground">Visión general del negocio</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Kpi label="Ventas del mes" value={fmt(totMes)} icon={TrendingUp} />
        <Kpi label="Ventas trimestre" value={fmt(totTrim)} icon={ShoppingBag} />
        <Kpi label="Ventas año" value={fmt(totAnio)} icon={Award} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="p-6">
          <h3 className="font-semibold mb-4">Ventas mensuales</h3>
          <div className="h-64">
            <ResponsiveContainer>
              <BarChart data={monthData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="mes" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <Tooltip formatter={(v: number) => fmt(v)} />
                <Bar dataKey="total" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-6">
          <h3 className="font-semibold mb-4">Productos más vendidos</h3>
          <ul className="space-y-3">
            {topProducts.length === 0 && <li className="text-sm text-muted-foreground">Aún sin ventas.</li>}
            {topProducts.map((p, i) => (
              <li key={p.title} className="flex items-center justify-between border-b last:border-0 pb-2">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="h-7 w-7 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-semibold flex-shrink-0">{i + 1}</span>
                  <span className="truncate">{p.title}</span>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="font-semibold">{p.qty} u.</div>
                  <div className="text-xs text-muted-foreground">{fmt(p.total)}</div>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="p-6">
          <div className="flex items-center gap-3 mb-2">
            <Award className="h-5 w-5 text-primary" />
            <h3 className="font-semibold">Vendedor top</h3>
          </div>
          <p className="text-2xl font-display">{topSellerName}</p>
          <p className="text-sm text-muted-foreground mt-1">{topSeller ? fmt(topSeller[1]) : "—"}</p>
        </Card>
        <Card className="p-6">
          <div className="flex items-center gap-3 mb-2">
            <Users className="h-5 w-5 text-primary" />
            <h3 className="font-semibold">Cliente top</h3>
          </div>
          <p className="text-2xl font-display">{topBuyerName}</p>
          <p className="text-sm text-muted-foreground mt-1">{topBuyer ? fmt(topBuyer[1]) : "—"}</p>
        </Card>
      </div>
    </div>
  );
}

function Kpi({ label, value, icon: Icon }: { label: string; value: string; icon: any }) {
  return (
    <Card className="p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="text-2xl font-display font-semibold mt-1">{value}</p>
        </div>
        <Icon className="h-8 w-8 text-primary/40" />
      </div>
    </Card>
  );
}
