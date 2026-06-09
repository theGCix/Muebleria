import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  listProveedores,
  upsertProveedor,
  getProveedor,
  listOrdenes,
  crearOrdenCompra,
  actualizarStatusOrden,
  recibirOrdenCompra,
} from "@/lib/pos.functions";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

import { Loader2, Plus } from "lucide-react";
import { useState, useMemo } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/proveedores")({
  component: ProveedoresPage,
});

const UNIDADES = ["metros","kg","litros","unidades","planchas","piezas"];

// ─────────────────────────────────────────
// ✅ FORM PROVEEDOR
// ─────────────────────────────────────────

function ProveedorForm({ initial, onClose }: any) {
  const qc = useQueryClient();

  const [form, setForm] = useState({
    nombre: initial?.nombre ?? "",
    ruc: initial?.ruc ?? "",
    tipo: initial?.tipo ?? "insumo",
  });

  const mut = useMutation({
    mutationFn: () => upsertProveedor({ ...form, id: initial?.id }),
    onSuccess: () => {
      toast.success("Guardado");
      qc.invalidateQueries({ queryKey: ["proveedores"] });
      onClose();
    },
  });

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {initial ? "Editar proveedor" : "Nuevo proveedor"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <Label>Nombre</Label>
            <Input
              value={form.nombre}
              onChange={(e) => setForm({ ...form, nombre: e.target.value })}
            />
          </div>

          <div>
            <Label>RUC</Label>
            <Input
              value={form.ruc}
              onChange={(e) => setForm({ ...form, ruc: e.target.value })}
            />
          </div>

          <div>
            <Label>Tipo</Label>
            <Select
              value={form.tipo}
              onValueChange={(v) => setForm({ ...form, tipo: v })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="insumo">Insumos</SelectItem>
                <SelectItem value="producto">Productos</SelectItem>
                <SelectItem value="ambos">Ambos</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button
            onClick={() => mut.mutate()}
            disabled={!form.nombre || mut.isPending}
            className="w-full"
          >
            {mut.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Guardar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─────────────────────────────────────────
// ✅ ORDEN COMPRA
// ─────────────────────────────────────────

function NuevaOrdenDialog({ proveedorId, onClose }: any) {
  const [items, setItems] = useState([
    { descripcion: "", unidad: "unidades", cantidad: 1, precio_unit: 0 },
  ]);

  const addItem = () =>
    setItems([...items, { descripcion: "", unidad: "unidades", cantidad: 1, precio_unit: 0 }]);

  const mut = useMutation({
    mutationFn: () =>
      crearOrdenCompra({
        proveedor_id: proveedorId,
        items,
      }),
    onSuccess: () => {
      toast.success("Orden creada");
      onClose();
    },
  });

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nueva Orden</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          {items.map((item, i) => (
            <div key={i} className="grid grid-cols-4 gap-2">
              <Input
                placeholder="Descripción"
                value={item.descripcion}
                onChange={(e) => {
                  const copy = [...items];
                  copy[i].descripcion = e.target.value;
                  setItems(copy);
                }}
              />

              <Select
                value={item.unidad}
                onValueChange={(v) => {
                  const copy = [...items];
                  copy[i].unidad = v;
                  setItems(copy);
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {UNIDADES.map((u) => (
                    <SelectItem key={u} value={u}>
                      {u}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Input
                type="number"
                value={item.cantidad}
                onChange={(e) => {
                  const copy = [...items];
                  copy[i].cantidad = Number(e.target.value);
                  setItems(copy);
                }}
              />

              <Input
                type="number"
                value={item.precio_unit}
                onChange={(e) => {
                  const copy = [...items];
                  copy[i].precio_unit = Number(e.target.value);
                  setItems(copy);
                }}
              />
            </div>
          ))}

          <Button variant="outline" onClick={addItem}>
            + Item
          </Button>

          <Button
            onClick={() => mut.mutate()}
            disabled={mut.isPending}
          >
            {mut.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Crear orden
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─────────────────────────────────────────
// ✅ PAGE
// ─────────────────────────────────────────

function ProveedoresPage() {
  const [formOpen, setFormOpen] = useState(false);
  const [selectedId, setSelectedId] = useState(null);

  const { data, isLoading } = useQuery({
    queryKey: ["proveedores"],
    queryFn: () => listProveedores({ activo: true }),
  });

  const proveedores = data?.proveedores ?? [];

  return (
    <div className="space-y-4">
      <div className="flex justify-between">
        <h1 className="text-xl font-semibold">Proveedores</h1>

        <Button onClick={() => setFormOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Nuevo
        </Button>
      </div>

      {isLoading ? (
        <Loader2 className="animate-spin" />
      ) : (
        <div className="space-y-2">
          {proveedores.map((p: any) => (
            <div
              key={p.id}
              className="border p-3 rounded flex justify-between"
            >
              <div>
                <div className="font-medium">{p.nombre}</div>
                <div className="text-sm text-gray-500">{p.ruc}</div>
              </div>

              <Button size="sm" onClick={() => setSelectedId(p.id)}>
                Ver
              </Button>
            </div>
          ))}
        </div>
      )}

      {formOpen && <ProveedorForm onClose={() => setFormOpen(false)} />}

      {selectedId && (
        <NuevaOrdenDialog
          proveedorId={selectedId}
          onClose={() => setSelectedId(null)}
        />
      )}
    </div>
  );
}