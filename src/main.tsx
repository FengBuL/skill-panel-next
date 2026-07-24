import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { createSystemAdapter } from "./adapters/create-system-adapter";
import { App } from "./app/App";
import "./app/styles.css";

const root = document.getElementById("root");

if (!root) {
  throw new Error("Missing application root");
}

createRoot(root).render(
  <StrictMode>
    <App adapter={createSystemAdapter()} />
  </StrictMode>,
);
