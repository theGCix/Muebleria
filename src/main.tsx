import ReactDOM from "react-dom/client";
import { RouterProvider } from "@tanstack/react-router";
import { StrictMode } from "react";
import { getRouter } from "./router";
import { initAnalytics, trackPageView } from "./lib/analytics";
import "./styles.css";

const router = getRouter();

// GA4 + Meta Pixel (solo si hay IDs en las variables VITE_GA_MEASUREMENT_ID / VITE_META_PIXEL_ID)
initAnalytics();
// SPA: un page_view por cada cambio de ruta (la carga inicial también dispara onResolved)
router.subscribe("onResolved", ({ toLocation }) => {
  trackPageView(toLocation.pathname);
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>
);