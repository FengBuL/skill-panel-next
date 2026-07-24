import type { SystemAdapter } from "../contracts/system";
import { createBrowserSystemAdapter } from "./browser-system-adapter";
import { createTauriSystemAdapter } from "./tauri-system-adapter";

export function createSystemAdapter(): SystemAdapter {
  if ("__TAURI_INTERNALS__" in window) {
    return createTauriSystemAdapter();
  }

  return createBrowserSystemAdapter();
}
