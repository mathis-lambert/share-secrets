import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@fontsource-variable/jetbrains-mono";
import { App } from "@/app/App";
import "@/styles/tokens.css";
import "@/styles/base.css";
import "@/styles/components.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
