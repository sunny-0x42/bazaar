import { ipfsToHttp } from "./chain";

export const SITE_ORIGIN = "https://nomaq.xyz";

const DEFAULT_TITLE = "Nomaq — NFT marketplace on gno.land";
const DEFAULT_DESCRIPTION = "Launch collections and trade unique NFTs at a fixed GNOT price on gno.land mainnet.";

export type PageMeta = {
  title?: string;
  description?: string;
  image?: string;
  url?: string;
  card?: string;
};

export function collectionTitle(name: string): string {
  const title = String(name || "").trim() || "Collection";
  return `${title} · Nomaq`;
}

export function absMetaImage(raw: string): string {
  const next = ipfsToHttp(String(raw || "").trim());
  if (/^https?:\/\//i.test(next)) return next;
  if (next.startsWith("/")) return SITE_ORIGIN + next;
  return `${SITE_ORIGIN}/og.jpg`;
}

export function fallbackBio(slug: string, name: string): string {
  if (String(slug || "").trim().toLowerCase() === "bazaargens") {
    return "Bazaar Gens is the 1,111-piece collection on Nomaq. Holders unlock protocol-fee discounts. Mint and trade each piece in GNOT on gno.land.";
  }
  const label = String(name || slug || "Collection").trim() || "Collection";
  return `${label} on Nomaq. Trade this collection in GNOT on gno.land.`;
}

function setMeta(selector: string, attrs: Record<string, string>, content: string) {
  let node = document.head.querySelector(selector);
  if (!node) {
    node = document.createElement("meta");
    for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
    document.head.appendChild(node);
  }
  node.setAttribute("content", content);
}

export function applyPageMeta(meta: PageMeta = {}) {
  const title = meta.title || DEFAULT_TITLE;
  const description = meta.description || DEFAULT_DESCRIPTION;
  const image = meta.image || `${SITE_ORIGIN}/og.jpg`;
  const url = meta.url || `${SITE_ORIGIN}/`;
  const card = meta.card || "summary_large_image";
  document.title = title;
  setMeta('meta[name="description"]', { name: "description" }, description);
  setMeta('meta[property="og:title"]', { property: "og:title" }, title);
  setMeta('meta[property="og:description"]', { property: "og:description" }, description);
  setMeta('meta[property="og:image"]', { property: "og:image" }, image);
  setMeta('meta[property="og:image:alt"]', { property: "og:image:alt" }, title);
  setMeta('meta[property="og:url"]', { property: "og:url" }, url);
  setMeta('meta[name="twitter:title"]', { name: "twitter:title" }, title);
  setMeta('meta[name="twitter:description"]', { name: "twitter:description" }, description);
  setMeta('meta[name="twitter:image"]', { name: "twitter:image" }, image);
  setMeta('meta[name="twitter:card"]', { name: "twitter:card" }, card);
  const canonical = document.head.querySelector('link[rel="canonical"]');
  if (canonical) canonical.setAttribute("href", url);
}
