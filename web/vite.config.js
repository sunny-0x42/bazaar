import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: { outDir: "dist", emptyOutDir: true },
  server: {
    port: 5176,
    host: "127.0.0.1",
    proxy: {
      "/api": "http://127.0.0.1:8788",
      "/gnoswap-prices": {
        target: "https://api.gnoswap.io",
        changeOrigin: true,
        rewrite: () => "/v1/tokens/prices",
      },
      "/coingecko-gnot": {
        target: "https://api.coingecko.com",
        changeOrigin: true,
        rewrite: () => "/api/v3/simple/price?ids=gno-land&vs_currencies=usd",
      },
    },
    watch: { ignored: ["**/tmp-qa/**"] },
  },
});
