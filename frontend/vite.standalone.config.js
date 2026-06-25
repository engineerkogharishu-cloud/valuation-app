import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import fs from "fs";

const OUT = path.resolve(__dirname, "../clean_v3");

// Plugin: after build, rename index.standalone.html → index.html
//         and write _redirects for Netlify SPA routing.
function netlifyFinalize() {
  return {
    name: "netlify-finalize",
    closeBundle() {
      // Rename HTML entry
      const src = path.join(OUT, "index.standalone.html");
      const dst = path.join(OUT, "index.html");
      if (fs.existsSync(src)) fs.renameSync(src, dst);

      // Write Netlify _redirects (SPA fallback)
      fs.writeFileSync(path.join(OUT, "_redirects"), "/* /index.html 200\n");

      console.log("✅  clean_v3 ready — drag the folder to netlify.com/drop");
    },
  };
}

export default defineConfig({
  plugins: [react(), netlifyFinalize()],

  resolve: {
    alias: [
      // Swap the real api.js with the localStorage-only standalone version.
      {
        find: path.resolve(__dirname, "src/services/api.js"),
        replacement: path.resolve(__dirname, "src/services/api.standalone.js"),
      },
    ],
  },

  build: {
    outDir: OUT,
    emptyOutDir: true,
    rollupOptions: {
      input: path.resolve(__dirname, "index.standalone.html"),
    },
  },
});
