import { createFileRoute } from "@tanstack/react-router"; 
import { useEffect } from "react";
import { Header } from "@/components/Header"; 
import { Hero } from "@/components/Hero"; 
import { Categories } from "@/components/Categories";
import { ProductsSection } from "@/components/ProductsSection";
import { Testimonials } from "@/components/Testimonials"; 
import { Footer } from "@/components/Footer";

import { trackEvent } from "@/hooks/useEventTracking"; // ajusta la ruta si es diferente

export const Route = createFileRoute("/")({ head: () => ({ meta: [ 
  { title: "G&M Mueblería — Muebles artesanales en madera natural" }, 
  { name: "description",
     content: "Sala, comedor, recámara y oficina. Muebles hechos a mano por artesanos. Compra online con entrega a domicilio." },
      { property: "og:title", content: "G&M Mueblería — Muebles artesanales" },
      { property: "og:description", content: "Piezas atemporales en madera natural para cada rincón de tu hogar." }, ], }),
       component: Index, });

function Index() {
  useEffect(() => {
    trackEvent({
      tipo: "pagina_vista",
      path: "/",
    });
  }, []);

  return (
     <div className="min-h-screen bg-background"> 
     <Header /> 
     <main> <Hero /> <Categories /> <ProductsSection /> <Testimonials /> 
     </main> <Footer /> </div> ); }
