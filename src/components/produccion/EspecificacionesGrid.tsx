// src/components/produccion/EspecificacionesGrid.tsx

interface Spec {
  key: string;
  value: string;
}

interface Props {
  specs: Spec[];
}

/**
 * Colores de punto asociados a tipos de especificación.
 * Puramente decorativo para que el carpintero distinga de un vistazo.
 */
const SPEC_DOT_COLORS: Record<string, string> = {
  Madera:   "#8B4513",
  Acabado:  "#C0A882",
  Medidas:  "#4A7CAE",
  Color:    "#D97706",
  Tela:     "#7C3AED",
  Entrega:  "#6B7280",
};

export function EspecificacionesGrid({ specs }: Props) {
  if (!specs.length) return null;

  return (
    <div className="grid grid-cols-2 gap-2">
      {specs.map((s) => (
        <div
          key={s.key}
          className="flex items-start gap-2.5 bg-card border border-border/50 rounded-lg px-3 py-2.5"
        >
          <span
            className="mt-1.5 h-2 w-2 rounded-full shrink-0"
            style={{
              background: SPEC_DOT_COLORS[s.key] ?? "#888",
            }}
          />
          <div className="min-w-0">
            <p className="text-sm font-medium truncate">{s.value}</p>
            <p className="text-xs text-muted-foreground">{s.key}</p>
          </div>
        </div>
      ))}
    </div>
  );
}