import { useEffect } from "react";

export const GA_MEASUREMENT_ID = "G-1W967FFSVL";

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

const SHARE_PATH = /^\/(?:c\/[a-z0-9-]+(?:\/\d+)?|m\/[a-z0-9-]+|i\/\d+)$/i;

function pagePath(): string {
  const hash = window.location.hash || "";
  if (hash && hash !== "#" && hash !== "#/") return `/${hash.replace(/^#\/?/, "")}`;
  const path = (window.location.pathname || "/").replace(/\/+$/, "") || "/";
  if (SHARE_PATH.test(path)) return path;
  return `/${(hash || "#/").replace(/^#\/?/, "")}`;
}

function sendPageview() {
  const gtag = window.gtag;
  if (typeof gtag !== "function") return;
  const path = pagePath();
  gtag("config", GA_MEASUREMENT_ID, {
    page_path: path,
    page_title: document.title,
    cookie_flags: "SameSite=None;Secure",
  });
}

export function Analytics() {
  useEffect(() => {
    sendPageview();
    window.addEventListener("hashchange", sendPageview);
    window.addEventListener("popstate", sendPageview);
    return () => {
      window.removeEventListener("hashchange", sendPageview);
      window.removeEventListener("popstate", sendPageview);
    };
  }, []);
  return null;
}
