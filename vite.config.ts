import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { TanStackRouterVite } from "@tanstack/router-plugin/vite";
import tsConfigPaths from "vite-tsconfig-paths";
import path from "path";

export default defineConfig({
  plugins: [
    tsConfigPaths(),
    TanStackRouterVite({ routesDirectory: "./src/routes" }),
    tailwindcss(),
    react(),
    {
  name: "spa-fallback",
  configureServer(server) {
    server.middlewares.use((req, _res, next) => {
      if (
        req.url &&
        !req.url.includes(".") &&
        !req.url.startsWith("/@") &&
        !req.url.startsWith("/api") &&
        !req.url.startsWith("/node_modules")
      ) {
        req.url = "/";
      }
      next();
    });
  },
},
  ],
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
  build: { outDir: "dist" },
  server: {
  proxy: {
    "/niubiz-return.html": {
      target: "http://localhost:3001",
      changeOrigin: true,
      configure: (proxy) => {
        proxy.on("proxyReq", (proxyReq, req) => {
          if (req.method === "POST") {
            // dejar pasar
          }
        });
      },
    },
  },
},
  
});

