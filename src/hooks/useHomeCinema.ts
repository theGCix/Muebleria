// src/hooks/useHomeCinema.ts
// Animaciones de scroll de la página principal (GSAP + ScrollTrigger).
//
// Cómo funciona: los componentes solo llevan atributos data-*; este hook los detecta,
// incluso los que aparecen después (el contenido llega de Supabase de forma asíncrona).
//
//   data-reveal="up|panel"   Aparece al entrar en pantalla (varios a la vez salen en cascada)
//   data-hero                Sección hero. Dentro:
//     data-hero-title          título (se parte en líneas con máscara)
//     data-hero-item           bajada, reloj, botones… (entrada escalonada)
//     data-hero-text           bloque de texto que sube un poco con el scroll (parallax)
//     data-hero-rail           riel de etiquetas: baja un poco con el scroll (parallax)
//     data-hero-img            contenedor de imagen; su <img> tiene parallax interno
//   data-cat-section         Sección fijada en escritorio. Dentro:
//     data-cat-head            encabezado
//     data-cat-card            tarjetas que van entrando mientras se hace scroll
//
// Con "reducir movimiento" activado no se anima nada: todo queda visible y quieto.
import { useEffect, type RefObject } from "react";
import { gsap, ScrollTrigger, SplitText, MQ } from "@/lib/gsap";

const OK = "data-cine-ok";

function pendientes(raiz: HTMLElement, selector: string) {
  return Array.from(raiz.querySelectorAll<HTMLElement>(`${selector}:not([${OK}])`));
}

/* ───────────────────────── Revelados ───────────────────────── */

function revelados(raiz: HTMLElement): number {
  const els = pendientes(raiz, "[data-reveal]");
  if (!els.length) return 0;
  els.forEach((el) => el.setAttribute(OK, "1"));

  const desde = (el: HTMLElement) =>
    el.dataset.reveal === "panel" ? { autoAlpha: 0, y: 56, scale: 0.97 } : { autoAlpha: 0, y: 36 };

  els.forEach((el) => gsap.set(el, desde(el)));

  ScrollTrigger.batch(els, {
    start: "top 88%",
    end: "max", // si la página carga ya desplazada, igual se muestra
    once: true,
    onEnter: (lote) =>
      gsap.to(lote, {
        autoAlpha: 1,
        y: 0,
        scale: 1,
        duration: 0.95,
        ease: "power3.out",
        stagger: 0.12,
        overwrite: true,
        clearProps: "transform,opacity,visibility",
      }),
  });
  return els.length;
}

/* ───────────────────────── Hero ───────────────────────── */

function hero(raiz: HTMLElement): number {
  const secs = pendientes(raiz, "[data-hero]");
  secs.forEach((sec) => {
    sec.setAttribute(OK, "1");

    const titulo = sec.querySelector<HTMLElement>("[data-hero-title]");
    const items = Array.from(sec.querySelectorAll<HTMLElement>("[data-hero-item]"));
    const texto = sec.querySelector<HTMLElement>("[data-hero-text]");
    const riel = sec.querySelector<HTMLElement>("[data-hero-rail]");
    const imgWrap = sec.querySelector<HTMLElement>("[data-hero-img]");
    const img = imgWrap?.querySelector<HTMLElement>("img");

    /* Entrada (una sola vez) */
    const tl = gsap.timeline({ defaults: { ease: "power3.out" } });

    if (titulo) {
      SplitText.create(titulo, {
        type: "lines",
        mask: "lines",
        autoSplit: true,
        aria: "auto",
        onSplit: (self) => {
          const a = gsap.from(self.lines, {
            yPercent: 110,
            duration: 1.1,
            stagger: 0.12,
            ease: "power4.out",
          });
          tl.add(a, 0);
          return a;
        },
      });
    }
    if (items.length) {
      tl.from(items, { autoAlpha: 0, y: 28, duration: 0.9, stagger: 0.1, clearProps: "all" }, 0.35);
    }
    if (riel) {
      // La entrada va en los hijos; el parallax, en el contenedor (así no se pisan)
      tl.from(Array.from(riel.children), {
        autoAlpha: 0,
        y: -36,
        duration: 1,
        stagger: 0.1,
        clearProps: "all",
      }, 0.2);
    }
    if (imgWrap) {
      tl.from(imgWrap, { autoAlpha: 0, scale: 0.94, duration: 1.1, clearProps: "all" }, 0.2);
    }

    /* Parallax con el scroll (suave, sin pin: no choca con el reloj ni con las etiquetas) */
    const rango = { trigger: sec, start: "top top", end: "bottom top", scrub: 0.8 };
    if (texto) gsap.to(texto, { y: -36, ease: "none", scrollTrigger: rango });
    if (riel) gsap.to(riel, { y: 52, ease: "none", scrollTrigger: rango });
    if (img && imgWrap) {
      gsap.fromTo(
        img,
        { yPercent: -6, scale: 1.12 },
        {
          yPercent: 6,
          ease: "none",
          scrollTrigger: { trigger: imgWrap, start: "top bottom", end: "bottom top", scrub: 0.8 },
        },
      );
    }
  });
  return secs.length;
}

/* ───────────────────────── Sección fijada (escritorio) ───────────────────────── */

function seccionFijada(raiz: HTMLElement): number {
  const secs = pendientes(raiz, "[data-cat-section]");
  secs.forEach((sec) => {
    sec.setAttribute(OK, "1");
    const cartas = Array.from(sec.querySelectorAll<HTMLElement>("[data-cat-card]"));
    if (!cartas.length) return;

    const tl = gsap.timeline({
      defaults: { ease: "none" },
      scrollTrigger: {
        trigger: sec,
        start: "top top+=96", // deja libre el header fijo
        end: "+=900",
        pin: true,
        scrub: 0.6,
        anticipatePin: 1,
        invalidateOnRefresh: true,
      },
    });
    tl.from(cartas, {
      autoAlpha: 0,
      y: 90,
      scale: 0.94,
      stagger: 0.35,
      duration: 1,
      ease: "power2.out",
    });
    tl.to({}, { duration: 0.4 }); // pausa final: las 4 tarjetas quietas antes de soltar
  });
  return secs.length;
}

function seccionFijadaMovil(raiz: HTMLElement): number {
  // En móvil / pantallas bajas no se fija: las tarjetas entran en cascada normal.
  const secs = pendientes(raiz, "[data-cat-section]");
  secs.forEach((sec) => {
    sec.setAttribute(OK, "1");
    const cartas = Array.from(sec.querySelectorAll<HTMLElement>("[data-cat-card]"));
    if (!cartas.length) return;
    gsap.set(cartas, { autoAlpha: 0, y: 36 });
    ScrollTrigger.batch(cartas, {
      start: "top 90%",
      end: "max",
      once: true,
      onEnter: (lote) =>
        gsap.to(lote, {
          autoAlpha: 1,
          y: 0,
          duration: 0.8,
          ease: "power3.out",
          stagger: 0.1,
          overwrite: true,
          clearProps: "transform,opacity,visibility",
        }),
    });
  });
  return secs.length;
}

/* ───────────────────────── Hook ───────────────────────── */

export function useHomeCinema(ref: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const raiz = ref.current;
    if (!raiz) return;

    const mm = gsap.matchMedia();
    let refrescar: number | undefined;

    const pedirRefresh = () => {
      window.clearTimeout(refrescar);
      // Cuando llegan datos o cargan imágenes la página cambia de alto:
      // hay que recalcular dónde empieza y termina cada animación.
      refrescar = window.setTimeout(() => ScrollTrigger.refresh(), 150);
    };

    mm.add(
      { movimiento: MQ.ok, fijar: MQ.pin },
      (ctx) => {
        const { fijar } = ctx.conditions as { movimiento: boolean; fijar: boolean };

        const escanear = () =>
          revelados(raiz) +
          hero(raiz) +
          (fijar ? seccionFijada(raiz) : seccionFijadaMovil(raiz));
        // Envuelve para que lo creado más tarde (datos asíncronos) quede dentro del contexto
        // y se limpie solo al cambiar de pantalla o desmontar.
        ctx.add("escanear", escanear);
        const run = () => (ctx as unknown as { escanear: () => number }).escanear();

        run();

        const obs = new MutationObserver(() => {
          // Solo recalcular si apareció algo nuevo que animar (evita bucles con el propio GSAP)
          if (run() > 0) pedirRefresh();
        });
        obs.observe(raiz, { childList: true, subtree: true });

        const ro = new ResizeObserver(pedirRefresh);
        ro.observe(raiz);

        return () => {
          obs.disconnect();
          ro.disconnect();
          raiz.querySelectorAll(`[${OK}]`).forEach((n) => n.removeAttribute(OK));
        };
      },
      raiz,
    );

    return () => {
      window.clearTimeout(refrescar);
      mm.revert();
    };
  }, [ref]);
}
