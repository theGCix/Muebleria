// src/components/DistritoCombobox.tsx
// D14: selector de distrito con búsqueda (51 distritos del tarifario). Lo usan la ficha (DeliveryPromise)
// y el checkout. Solo cambia cómo se elige: la fuente del valor sigue siendo useDistritoEnvio / form.distrito
// y las tarifas salen de DISTRITOS_ENVIO (src/lib/envios.ts).
import { useId, useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { DISTRITOS_ENVIO } from "@/lib/envios";
import { filtrarDistrito } from "@/lib/buscarDistrito";
import { fmtPEN } from "@/lib/pricing";
import { cn } from "@/lib/utils";

interface Props {
  value: string;
  onChange: (distrito: string) => void;
  /** id del botón, para enlazarlo con un <label htmlFor>. */
  id?: string;
  placeholder?: string;
  /** Muestra la tarifa a la derecha de cada distrito. */
  mostrarTarifa?: boolean;
  className?: string;
}

export function DistritoCombobox({
  value,
  onChange,
  id,
  placeholder = "Selecciona tu distrito…",
  mostrarTarifa = true,
  className,
}: Props) {
  const [open, setOpen] = useState(false);
  const listId = useId();

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          id={id}
          role="combobox"
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={listId}
          className={cn(
            "flex h-11 w-full items-center justify-between gap-2 rounded-md border border-input bg-background px-3 text-left text-sm text-foreground shadow-sm",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            !value && "text-muted-foreground",
            className,
          )}
        >
          <span className="truncate">{value || placeholder}</span>
          <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" aria-hidden />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)] min-w-[16rem] p-0">
        <Command filter={filtrarDistrito}>
          {/* 16 px: evita el zoom automático de iOS al enfocar el buscador */}
          <CommandInput placeholder="Busca tu distrito…" className="h-11 text-base" aria-label="Buscar distrito" />
          <CommandList id={listId} className="max-h-[min(18rem,50vh)]">
            <CommandEmpty>No encontramos ese distrito.</CommandEmpty>
            <CommandGroup>
              {DISTRITOS_ENVIO.map((d) => (
                <CommandItem
                  key={d.destino}
                  value={d.destino}
                  onSelect={() => {
                    onChange(d.destino);
                    setOpen(false);
                  }}
                  className="min-h-11 text-sm data-[selected=true]:bg-secondary data-[selected=true]:text-foreground"
                >
                  <Check className={cn("h-4 w-4", value === d.destino ? "opacity-100" : "opacity-0")} aria-hidden />
                  <span className="flex-1">{d.destino}</span>
                  {mostrarTarifa && <span className="text-xs text-muted-foreground">{fmtPEN(d.precio)}</span>}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
