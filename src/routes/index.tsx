import { createFileRoute } from "@tanstack/react-router"; 
import { useEffect, useRef } from "react";
import { Header } from "@/components/Header"; 
import { PortadaPresupuesto } from "@/components/PortadaPresupuesto";
<<<<<<< ours
=======
import { HeroCampanaHome } from "@/components/Hero";
>>>>>>> theirs
import { Categories } from "@/components/Categories";
import { OfertasSection } from "@/components/OfertasSection";
import { CombosSection } from "@/components/CombosSection";
import { PromoCategoriaBanner } from "@/components/PromoCategoriaBanner";
import { ProductsSection } from "@/components/ProductsSection";
import { Testimonials } from "@/components/Testimonials";
import { ClientesSatisfechos } from "@/components/ClientesSatisfechos";
import { MedidaCTA } from "@/components/MedidaCTA";
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
<<<<<<< ours
     <main ref={mainRef}> <PortadaPresupuesto /> <OfertasSection /> <CombosSection /> <Categories /> <PromoCategoriaBanner /> <ProductsSection /> <Testimonials /> <ClientesSatisfechos /> <MedidaCTA />
=======
     <main ref={mainRef}> <PortadaPresupuesto /> <HeroCampanaHome /> <OfertasSection /> <CombosSection /> <Categories /> <PromoCategoriaBanner /> <ProductsSection /> <Testimonials /> <ClientesSatisfechos /> <MedidaCTA />
>>>>>>> theirs
     </main> 
     <Footer /> </div> ); }