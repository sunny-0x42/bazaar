import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { QuoteProvider } from "./components/Quote";
import "./styles.css";

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QuoteProvider>
      <App />
    </QuoteProvider>
  </React.StrictMode>,
);
