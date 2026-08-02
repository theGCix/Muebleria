import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Check, ChevronsUpDown, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface Option {
  id: string;
  label: string;
  sublabel?: string;
}

interface ProductComboSelectorProps {
  mode: "producto" | "combo";
  value: string | null;
  onChange: (id: string | null) => void;
  placeholder?: string;
}

/**
 * Combobox con búsqueda server-side sobre public.products o public.combos.
 * Requiere el componente Command de shadcn/ui (cmdk):
 *   npx shadcn@latest add command popover
 */
export function ProductComboSelector({
  mode,
  value,
  onChange,
  placeholder,
}: ProductComboSelectorProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [options, setOptions] = useState<Option[]>([]);
  const [selected, setSelected] = useState<Option | null>(null);
  const [loading, setLoading] = useState(false);

  const table = mode === "producto" ? "products" : "combos";
  const nameField = mode === "producto" ? "nombre" : "nombre";
  const priceField = mode === "producto" ? "precio" : "precio_combo";

  // Cargar el nombre del valor seleccionado al abrir (por si viene de edición)
  useEffect(() => {
    if (!value) {
      setSelected(null);
      return;
    }
    if (selected?.id === value) return;

    supabase
      .from(table)
      .select(`id, ${nameField}, ${priceField}`)
      .eq("id", value)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setSelected({
            id: data.id,
            label: (data as any)[nameField],
            sublabel: `S/ ${(data as any)[priceField]}`,
          });
        }
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const search = useCallback(
    async (term: string) => {
      setLoading(true);
      let req = supabase
        .from(table)
        .select(`id, ${nameField}, ${priceField}`)
        .eq("activo", true)
        .limit(20);

      if (term.trim()) {
        req = req.ilike(nameField, `%${term.trim()}%`);
      }

      const { data, error } = await req;
      if (!error && data) {
        setOptions(
          data.map((d: any) => ({
            id: d.id,
            label: d[nameField],
            sublabel: `S/ ${d[priceField]}`,
          }))
        );
      }
      setLoading(false);
    },
    [table, nameField, priceField]
  );

  useEffect(() => {
    if (open) search(query);
  }, [open, query, search]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal"
        >
          {selected ? selected.label : placeholder ?? `Buscar ${mode}...`}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder={`Escribe para buscar ${mode}...`}
            value={query}
            onValueChange={setQuery}
          />
          <CommandList>
            {loading && (
              <div className="py-4 flex justify-center">
                <Loader2 className="w-4 h-4 animate-spin" />
              </div>
            )}
            {!loading && <CommandEmpty>Sin resultados</CommandEmpty>}
            <CommandGroup>
              {options.map((opt) => (
                <CommandItem
                  key={opt.id}
                  value={opt.id}
                  onSelect={() => {
                    onChange(opt.id === value ? null : opt.id);
                    setSelected(opt.id === value ? null : opt);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === opt.id ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <div className="flex flex-col">
                    <span>{opt.label}</span>
                    <span className="text-xs text-muted-foreground">
                      {opt.sublabel}
                    </span>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}