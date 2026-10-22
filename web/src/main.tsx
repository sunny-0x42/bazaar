import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { QuoteProvider } from "./components/Quote";
import "./styles.css";

if ("serviceWorker" in navigator) {
  void navigator.serviceWorker.getRegistrations().then((regs) => {
    for (const reg of regs) void reg.unregister();
  });
}

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QuoteProvider>
      <App />
    </QuoteProvider>
  </React.StrictMode>,
);
