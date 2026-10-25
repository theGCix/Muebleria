// src/components/MedidaCTA.tsx
// Cierre del home: captura leads de muebles a medida con un formulario corto
// (qué necesitas + nombre + WhatsApp). Entra al CRM como lead con origen "web".
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { CheckCircle2, Loader2, Ruler, Send } from "lucide-react";
import { toast } from "sonner";
import { createLead } from "@/lib/leads.functions";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const TIPOS = ["Sala", "Comedor", "Recámara", "Separador de ambiente", "Otro"];

const PASOS = [
  {
    n: "1",
    t: "Cuéntanos qué necesitas",
    d: "Tipo de mueble, medidas aproximadas y el espacio donde irá.",
  },
  {
    n: "2",
    t: "Un asesor te contacta",
    d: "Por WhatsApp o llamada, para afinar los detalles contigo.",
  },
  {
    n: "3",
    t: "Recibes tu cotización",
    d: "Con el precio de tu pieza, sin compromiso de compra.",
  },
];

export function MedidaCTA() {
  const [tipo, setTipo] = useState<string | null>(null);
  const [nombre, setNombre] = useState("");
  const [telefono, setTelefono] = useState("");
  const [detalle, setDetalle] = useState("");
  const [enviado, setEnviado] = useState<string | null>(null);

  const telefonoOk = telefono.replace(/\D/g, "").length >= 6;
  const valido = nombre.trim().length >= 2 && telefonoOk;

  const mutation = useMutation({
    mutationFn: () =>
      createLead({
        nombre: nombre.trim(),
        telefono: telefono.trim(),
        email: null,
        producto_id: null,
        producto_nombre: null,
        mensaje:
          `Cotización a medida${tipo ? ` — ${tipo}` : ""}` +
          (detalle.trim() ? `: ${detalle.trim()}` : ""),
        origen: "web",
      }),
    onSuccess: () => {
      setEnviado(nombre.trim().split(" ")[0]);
      setTipo(null);
      setNombre("");
      setTelefono("");
      setDetalle("");
    },
    onError: () => toast.error("No pudimos enviar tu consulta. Intenta de nuevo."),
  });

  return (
    <section id="a-medida" className="scroll-mt-28 px-4 pb-20 pt-4 md:pb-24">
      <div
        data-reveal="panel"
        className="hero-taller container mx-auto grid max-w-7xl gap-10 overflow-hidden rounded-3xl bg-[var(--wood-dark)] p-7 text-white shadow-[var(--shadow-elegant)] md:p-12 lg:grid-cols-[1.05fr_1fr] lg:gap-14 lg:p-14">
        <div className="flex flex-col justify-center">
          <span className="mb-5 inline-flex w-fit items-center gap-2 rounded-full border border-[var(--color-gold)]/50 px-3.5 py-1.5 text-xs font-medium uppercase tracking-[0.2em] text-[var(--color-gold-light)]">
            <Ruler className="h-3.5 w-3.5" /> Muebles a medida
          </span>
          <h2 className="font-display text-4xl font-semibold leading-[1.02] md:text-6xl">
            ¿No encuentras el mueble exacto? Lo fabricamos para tu{" "}
            <em className="italic text-[var(--color-gold)]">espacio</em>.
          </h2>
          <p className="mt-4 max-w-lg text-white/75">
            Nuestros artesanos fabrican piezas pensadas para las medidas y el estilo de tu espacio.
          </p>

          <ol className="mt-8 space-y-4">
            {PASOS.map((p) => (
              <li key={p.n} className="flex items-start gap-4">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[var(--color-gold)]/60 font-display text-lg text-[var(--color-gold)]">
                  {p.n}
                </span>
                <span>
                  <span className="block font-semibold">{p.t}</span>
                  <span className="text-sm text-white/65">{p.d}</span>
                </span>
              </li>
            ))}
          </ol>
        </div>

        <div className="rounded-2xl bg-background p-6 text-foreground shadow-xl md:p-8">
          {enviado ? (
            <div className="flex h-full min-h-[320px] flex-col items-center justify-center gap-3 text-center">
              <CheckCircle2 className="h-12 w-12 text-emerald-600" />
              <h3 className="font-display text-3xl font-semibold">¡Gracias, {enviado}!</h3>
              <p className="max-w-xs text-sm text-muted-foreground">
                Recibimos tu consulta. Un asesor te contactará muy pronto por WhatsApp o llamada.
              </p>
              <button
                type="button"
                onClick={() => setEnviado(null)}
                className="mt-2 text-sm font-medium text-accent hover:underline"
              >
                Enviar otra consulta
              </button>
            </div>
          ) : (
            <form
              className="space-y-5"
              onSubmit={(e) => {
                e.preventDefault();
                if (valido) mutation.mutate();
              }}
            >
              <div>
                <h3 className="font-display text-3xl font-semibold">Pide tu cotización</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Toma menos de un minuto. Sin compromiso.
                </p>
              </div>

              <div>
                <p className="mb-2 text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
                  ¿Qué necesitas?
                </p>
                <div className="flex flex-wrap gap-2" role="group" aria-label="Tipo de mueble">
                  {TIPOS.map((t) => (
                    <button
                      key={t}
                      type="button"
                      aria-pressed={tipo === t}
                      onClick={() => setTipo(tipo === t ? null : t)}
                      className={`rounded-full border px-4 py-1.5 text-sm font-medium transition-colors ${
                        tipo === t
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-card hover:bg-secondary"
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="medida-nombre">Tu nombre</Label>
                  <Input
                    id="medida-nombre"
                    value={nombre}
                    onChange={(e) => setNombre(e.target.value)}
                    autoComplete="name"
                    maxLength={255}
                    className="mt-1.5 h-11"
                  />
                </div>
                <div>
                  <Label htmlFor="medida-telefono">WhatsApp</Label>
                  <Input
                    id="medida-telefono"
                    type="tel"
                    inputMode="tel"
                    value={telefono}
                    onChange={(e) => setTelefono(e.target.value)}
                    placeholder="9XXXXXXXX"
                    autoComplete="tel"
                    maxLength={20}
                    className="mt-1.5 h-11"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="medida-detalle">Medidas o detalles (opcional)</Label>
                <Input
                  id="medida-detalle"
                  value={detalle}
                  onChange={(e) => setDetalle(e.target.value)}
                  placeholder="Ej.: comedor para 6, madera clara, 2 m de largo"
                  maxLength={500}
                  className="mt-1.5 h-11"
                />
              </div>

              <button
                type="submit"
                disabled={!valido || mutation.isPending}
                className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-primary px-6 text-sm font-semibold text-primary-foreground shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-lg disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none"
              >
                {mutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                Quiero mi cotización
              </button>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}