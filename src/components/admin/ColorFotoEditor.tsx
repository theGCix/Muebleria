// src/components/admin/ColorFotoEditor.tsx
// Círculo en la esquina de cada foto del producto: abre un panel para asignarle el color del mueble.
import { useState } from "react";
import { Palette, Pipette } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { COLORES_BASE, nombreMasCercano, normalizarHex } from "@/lib/colorNames";

export type ColorFoto = { name: string; hex: string };

declare global {
  interface Window {
    EyeDropper?: new () => { open: () => Promise<{ sRGBHex: string }> };
  }
}

export function ColorFotoEditor({
  color,
  onChange,
}: {
  color?: ColorFoto | null;
  onChange: (c: ColorFoto | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const hayGotero = typeof window !== "undefined" && "EyeDropper" in window;

  // Si el admin no tocó el nombre, se re-sugiere al cambiar el color; si lo editó, se respeta.
  const elegirHex = (raw: string) => {
    const hex = normalizarHex(raw);
    if (!hex) return;
    const nombreEditado = color && color.name !== nombreMasCercano(color.hex);
    onChange({ hex, name: nombreEditado ? color.name : nombreMasCercano(hex) });
  };

  const gotero = async () => {
    try {
      const r = await new window.EyeDropper!().open();
      elegirHex(r.sRGBHex);
    } catch {
      /* el usuario canceló */
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          onClick={(e) => e.stopPropagation()}
          title={color ? `Color: ${color.name}` : "Asignar color a esta foto"}
          aria-label={color ? `Color de la foto: ${color.name}` : "Asignar color a esta foto"}
          className={`absolute -top-1.5 -left-1.5 z-10 grid h-6 w-6 place-items-center rounded-full shadow ring-2 ring-background transition-transform hover:scale-110 ${
            color ? "" : "border border-dashed border-muted-foreground/50 bg-background text-muted-foreground"
          }`}
          style={color ? { backgroundColor: color.hex } : undefined}
        >
          {!color && <Palette className="h-3 w-3" />}
        </button>
      </PopoverTrigger>

      <PopoverContent
        className="w-64 space-y-3 p-3"
        align="start"
        onClick={(e) => e.stopPropagation()}
      >
        <div>
          <p className="text-sm font-medium">Color de esta foto</p>
          <p className="text-xs text-muted-foreground">
            El color del mueble que se ve en la foto. Así el cliente lo elige y ve esa foto.
          </p>
        </div>

        <div className="grid grid-cols-8 gap-1.5">
          {COLORES_BASE.map((c) => (
            <button
              key={c.hex}
              type="button"
              title={c.name}
              aria-label={c.name}
              onClick={() => onChange({ name: c.name, hex: c.hex })}
              className={`h-6 w-6 rounded-full border transition-transform hover:scale-110 ${
                color?.hex === c.hex ? "ring-2 ring-primary ring-offset-1" : "border-border/60"
              }`}
              style={{ backgroundColor: c.hex }}
            />
          ))}
        </div>

        <div className="flex items-center gap-2">
          <input
            type="color"
            value={color?.hex ?? "#c8bfb5"}
            onChange={(e) => elegirHex(e.target.value)}
            aria-label="Elegir otro color"
            className="h-9 w-12 cursor-pointer rounded border border-border bg-transparent p-0.5"
          />
          {hayGotero && (
            <Button type="button" variant="outline" size="sm" onClick={gotero} className="gap-1.5">
              <Pipette className="h-3.5 w-3.5" /> Tomar de la foto
            </Button>
          )}
        </div>

        <div>
          <p className="mb-1 text-xs text-muted-foreground">Nombre que verá el cliente</p>
          <Input
            value={color?.name ?? ""}
            disabled={!color}
            maxLength={30}
            placeholder="Elige un color primero"
            onChange={(e) => color && onChange({ ...color, name: e.target.value })}
          />
        </div>

        {color && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="w-full text-destructive"
            onClick={() => {
              onChange(null);
              setOpen(false);
            }}
          >
            Quitar color de esta foto
          </Button>
        )}
      </PopoverContent>
    </Popover>
  );
}