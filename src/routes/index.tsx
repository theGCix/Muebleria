import { createFileRoute } from "@tanstack/react-router"; 
import { useEffect, useRef } from "react";
import { Header } from "@/components/Header"; 
import { PortadaCarrusel } from "@/components/home/PortadaCarrusel";

import { ElegirAmbiente } from "@/components/home/ElegirAmbiente";
import { ColeccionDestacada } from "@/components/home/ColeccionDestacada";
import { ArmadorPresupuesto } from "@/components/home/ArmadorPresupuesto";


import { OfertasVigentes } from "@/components/home/OfertasVigentes";
import { HechoEnTaller } from "@/components/home/HechoEnTaller";
import { RecienSalidos } from "@/components/home/RecienSalidos";
import { PruebaloEnTuEspacio } from "@/components/home/PruebaloEnTuEspacio";
import { CotizarMedida } from "@/components/home/CotizarMedida";
import { CombosSection } from "@/components/CombosSection";
import { PromoCategoriaBanner } from "@/components/PromoCategoriaBanner";
import { Testimonials } from "@/components/Testimonials";
import { ClientesSatisfechos } from "@/components/ClientesSatisfechos";
import { Footer } from "@/components/Footer";

import { trackEvent } from "@/hooks/useEventTracking"; // ajusta la ruta si es diferente
import { useHomeCinema } from "@/hooks/useHomeCinema";

export const Route = createFileRoute("/")({ head: () => ({ meta: [ 
  { title: "G&M Mueblería — Muebles artesanales en madera natural" }, 
  { name: "description",
     content: "Sala, comedor, recámara y oficina. Muebles hechos a mano por artesanos. Compra online con entrega a domicilio." },
      { property: "og:title", content: "G&M Mueblería — Muebles artesanales" },
      { property: "og:description", content: "Piezas atemporales en madera natural para cada rincón de tu hogar." }, ], }),
       component: Index, });

function Index() {
  const mainRef = useRef<HTMLElement>(null);
  useHomeCinema(mainRef);

  useEffect(() => {
    trackEvent({
      tipo: "pagina_vista",
      path: "/",
    });
  }, []);

  return (
     <div className="min-h-screen bg-background"> 
     <Header /> 
     <main ref={mainRef}> <PortadaCarrusel /> <ElegirAmbiente /> <ColeccionDestacada /> <ArmadorPresupuesto /> <OfertasVigentes /> <HechoEnTaller /> <RecienSalidos />
       {/* Fuera del boceto, se conservan por ahora (el menú apunta a #combos y el pie a #testimonios) */}
       <CombosSection /> <PromoCategoriaBanner /> <Testimonials /> <ClientesSatisfechos />
       <PruebaloEnTuEspacio /> <CotizarMedida />
     </main> 
     <Footer pegado /></div> ); }