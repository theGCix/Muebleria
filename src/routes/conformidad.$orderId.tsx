// src/routes/conformidad.$orderId.tsx
// El cliente confirma que recibió su pedido y, si quiere, sube fotos de su mueble.
// Las fotos quedan PENDIENTES: solo se muestran en la web si el equipo las aprueba desde el panel (Testimonios).
import { useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, CheckCircle2, ImagePlus, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { uploadImage } from "@/lib/cloudinary";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";

export const Route = createFileRoute("/conformidad/$orderId")({
  head: () => ({ meta: [{ title: "Tu mueble ya llegó — G&M Mueblería" }, { name: "robots", content: "noindex" }] }),
  component: ConformidadPage,
});

const MAX_FOTOS = 6;
const MAX_ENVIOS = 3;

interface Pedido {
  order_number: string;
  nombre: string;
  envios_previos: number;
}

const mini = (url: string, w = 240) =>
  url.includes("res.cloudinary.com") && url.includes("/upload/") ? url.replace("/upload/", `/upload/w_${w},q_auto,f_auto/`) : url;

function ConformidadPage() {
  const { orderId } = Route.useParams();
  const [email, setEmail] = useState("");
  const [buscando, setBuscando] = useState(false);
  const [pedido, setPedido] = useState<Pedido | null | undefined>(undefined); // undefined = aún no consultado
  const [fotos, setFotos] = useState<string[]>([]);
  const [subiendo, setSubiendo] = useState(false);
  const [autor, setAutor] = useState("");
  const [comentario, setComentario] = useState("");
  const [acepto, setAcepto] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [listo, setListo] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const buscar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setBuscando(true);
    const { data, error } = await supabase.rpc("get_pedido_conformidad" as never, {
      _order_id: orderId,
      _email: email.trim(),
    } as never);
    setBuscando(false);
    if (error) return void toast.error(error.message);
    const fila = ((data ?? []) as Pedido[])[0];
    setPedido(fila ?? null);
  };

  const subirFotos = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (files.length === 0) return;
    const cupo = MAX_FOTOS - fotos.length;
    if (cupo <= 0) return void toast.error(`Máximo ${MAX_FOTOS} fotos`);
    setSubiendo(true);
    try {
      const urls: string[] = [];
      for (const f of files.slice(0, cupo)) {
        const r = await uploadImage(f, "muebleria/conformidad");
        urls.push(r.secure_url);
      }
      setFotos((cur) => [...cur, ...urls]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo subir la foto");
    } finally {
      setSubiendo(false);
    }
  };

  const enviar = async () => {
    if (fotos.length === 0) return void toast.error("Sube al menos una foto");
    if (!acepto) return void toast.error("Marca la autorización para continuar");
    setEnviando(true);
    const { error } = await supabase.rpc("enviar_conformidad_entrega" as never, {
      _order_id: orderId,
      _email: email.trim(),
      _fotos: fotos,
      _comentario: comentario || null,
      _autor: autor || null,
    } as never);
    setEnviando(false);
    if (error) return void toast.error(error.message);
    setListo(true);
  };

  const yaEnvio = !!pedido && pedido.envios_previos >= MAX_ENVIOS;

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto max-w-2xl px-4 py-10">
        <Link to="/" className="mb-8 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Volver a la tienda
        </Link>

        <h1 className="mb-2 font-display text-3xl font-semibold">¡Tu mueble ya llegó!</h1>
        <p className="mb-8 text-muted-foreground">
          Cuéntanos que todo salió bien y, si quieres, muéstranos cómo quedó en tu casa.
        </p>

        {listo ? (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-border/50 bg-card p-8 text-center">
            <CheckCircle2 className="h-10 w-10 text-emerald-500" />
            <p className="font-medium">¡Gracias por tu confirmación!</p>
            <p className="text-sm text-muted-foreground">
              Revisaremos tus fotos antes de publicarlas. Si las aprobamos, aparecerán en la sección Testimonios.
            </p>
            <Button asChild variant="outline" className="mt-2 rounded-full">
              <Link to="/resena/$orderId" params={{ orderId }}>Dejar también una reseña</Link>
            </Button>
          </div>
        ) : pedido === undefined ? (
          <form onSubmit={buscar} className="space-y-4 rounded-xl border border-border/50 bg-card p-6">
            <div>
              <Label htmlFor="email">Correo con el que hiciste la compra</Label>
              <Input
                id="email"
                type="email"
                required
                className="mt-1"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tucorreo@ejemplo.com"
              />
            </div>
            <Button type="submit" disabled={buscando} className="w-full rounded-full">
              {buscando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Continuar
            </Button>
          </form>
        ) : pedido === null ? (
          <div className="rounded-xl border border-border/50 bg-card p-8 text-center">
            <p className="text-muted-foreground">
              No encontramos un pedido enviado o entregado con ese correo. Revisa que sea el mismo de tu compra o escríbenos y te
              ayudamos.
            </p>
            <Button variant="outline" className="mt-4 rounded-full" onClick={() => setPedido(undefined)}>
              Probar con otro correo
            </Button>
          </div>
        ) : yaEnvio ? (
          <div className="rounded-xl border border-border/50 bg-card p-8 text-center">
            <p className="text-muted-foreground">Ya recibimos las fotos de este pedido. ¡Gracias!</p>
          </div>
        ) : (
          <div className="space-y-5 rounded-xl border border-border/50 bg-card p-6">
            <p className="text-sm text-muted-foreground">
              Hola <strong className="text-foreground">{pedido.nombre.split(" ")[0]}</strong>, pedido{" "}
              <strong className="text-foreground">{pedido.order_number}</strong>.
            </p>

            <div className="space-y-2">
              <Label>Fotos de tu mueble ({fotos.length}/{MAX_FOTOS})</Label>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                {fotos.map((f, i) => (
                  <div key={f + i} className="relative aspect-square overflow-hidden rounded-lg border border-border bg-muted">
                    <img src={mini(f)} alt="" className="h-full w-full object-cover" />
                    <button
                      type="button"
                      aria-label="Quitar foto"
                      onClick={() => setFotos(fotos.filter((_, k) => k !== i))}
                      className="absolute right-1 top-1 grid h-6 w-6 place-items-center rounded-full bg-background/90 shadow"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
                {fotos.length < MAX_FOTOS && (
                  <button
                    type="button"
                    disabled={subiendo}
                    onClick={() => inputRef.current?.click()}
                    className="flex aspect-square flex-col items-center justify-center rounded-lg border-2 border-dashed border-border text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
                  >
                    {subiendo ? <Loader2 className="h-5 w-5 animate-spin" /> : <ImagePlus className="h-5 w-5" />}
                    <span className="mt-1 text-[10px]">{subiendo ? "Subiendo…" : "Agregar"}</span>
                  </button>
                )}
              </div>
              <input ref={inputRef} type="file" accept="image/*" multiple className="hidden" onChange={subirFotos} />
            </div>

            <div>
              <Label htmlFor="autor">Cómo quieres que aparezca tu nombre (opcional)</Label>
              <Input
                id="autor"
                className="mt-1"
                maxLength={80}
                value={autor}
                onChange={(e) => setAutor(e.target.value)}
                placeholder="Ej. María P."
              />
            </div>

            <div>
              <Label htmlFor="comentario">Tu comentario (opcional)</Label>
              <Textarea
                id="comentario"
                className="mt-1"
                rows={3}
                maxLength={600}
                value={comentario}
                onChange={(e) => setComentario(e.target.value)}
                placeholder="¿Cómo te llegó? ¿Qué te pareció?"
              />
            </div>

            <label className="flex items-start gap-2.5 text-sm">
              <Checkbox checked={acepto} onCheckedChange={(v) => setAcepto(v === true)} className="mt-0.5" />
              <span className="text-muted-foreground">
                Autorizo a G&amp;M Mueblería a mostrar estas fotos y mi nombre en su sitio web. Las revisarán antes de
                publicarlas.
              </span>
            </label>

            <Button onClick={enviar} disabled={enviando || subiendo} className="w-full rounded-full">
              {enviando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Enviar fotos
            </Button>
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}