import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Warns at build time if the API URL was forgotten.
// An empty VITE_API_URL makes the bundle call a relative "/api", which is
// correct only when the backend is served from the SAME domain. On a split
// Netlify + Railway deployment it silently breaks every request.
function warnMissingApiUrl() {
  return {
    name: "warn-missing-api-url",
    apply: "build",
    buildStart() {
      if (!process.env.VITE_API_URL) {
        this.warn(
          [
            "",
            "  ==========================================================",
            "   VITE_API_URL is not set.",
            "   The bundle will call a RELATIVE /api path.",
            "   That is correct ONLY if the backend is served from the",
            "   same domain. For a split frontend/backend deployment,",
            "   set VITE_API_URL to the backend origin and rebuild.",
            "  ==========================================================",
            "",
          ].join("\n")
        );
      }
    },
  };
}

export default defineConfig({
  plugins: [react(), warnMissingApiUrl()],

  // App is served from the domain root. Change only if it is ever hosted
  // under a sub-path (e.g. "/app/"), which would also need the Netlify SPA
  // redirect updated to match.
  base: "/",

  server: {
    port: 3000,
    // Dev only. In production VITE_API_URL points straight at the backend and
    // this proxy is not part of the build.
    proxy: {
      "/api": {
        target: "http://localhost:3001",
        changeOrigin: true,
        configure: (proxy) => {
          proxy.on("proxyRes", (proxyRes) => {
            // The backend marks the auth cookie Secure in production mode.
            // Strip that locally so it survives plain-HTTP dev.
            const setCookie = proxyRes.headers["set-cookie"];
            if (setCookie) {
              proxyRes.headers["set-cookie"] = setCookie.map((c) =>
                c.replace(/;\s*Secure/gi, "")
              );
            }
          });
        },
      },
    },
  },

  preview: {
    port: 4173,
  },

  build: {
    outDir: "build",
    // Never ship source maps: they would expose readable application source.
    sourcemap: false,
    chunkSizeWarningLimit: 1500,
  },
});
