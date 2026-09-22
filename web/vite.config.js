import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function newColPlugin() {
  return {
    name: "bazaar-new-col",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = (req.url || "").split("?")[0];
        if (url !== "/local/new-col") return next();
        if (req.method !== "POST") {
          res.statusCode = 405;
          res.end("POST");
          return;
        }
        let rawBody = "";
        for await (const chunk of req) rawBody += chunk;
        let slug = "";
        try {
          slug = String(JSON.parse(rawBody).slug || "")
            .trim()
            .toLowerCase();
        } catch {
          slug = "";
        }
        if (!/^[a-z][a-z0-9]{1,10}$/.test(slug)) {
          res.statusCode = 400;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ ok: false, error: "slug must be [a-z][a-z0-9]{1,10} (package name, no hyphen)" }));
          return;
        }
        const src = path.join(repoRoot, "gno.land", "r", "bazaar", "col");
        const dst = path.join(repoRoot, "gno.land", "r", "bazaar", "c", slug);
        const pkg = `gno.land/r/bazaar/c/${slug}`;
        if (!fs.existsSync(src)) {
          res.statusCode = 500;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ ok: false, error: "collection template missing" }));
          return;
        }
        if (fs.existsSync(dst)) {
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ ok: true, exists: true, pkg }));
          return;
        }
        fs.mkdirSync(dst, { recursive: true });
        for (const name of fs.readdirSync(src)) {
          if (name !== "gnomod.toml" && !name.endsWith(".gno")) continue;
          let text = fs.readFileSync(path.join(src, name), "utf8");
          text = text.replace(/package col\b/g, "package " + slug);
          text = text.replace('module = "gno.land/r/bazaar/col"', `module = "${pkg}"`);
          let out = name;
          if (name === "col.gno") out = `${slug}.gno`;
          if (name === "col_test.gno") out = `${slug}_test.gno`;
          fs.writeFileSync(path.join(dst, out), text);
        }
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ ok: true, exists: false, pkg }));
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), newColPlugin()],
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
