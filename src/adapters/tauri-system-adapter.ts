import { invoke as tauriInvoke } from "@tauri-apps/api/core";

import type { HealthStatus, SystemAdapter } from "../contracts/system";

type Invoke = <T>(command: string) => Promise<T>;

export function createTauriSystemAdapter(
  invoke: Invoke = tauriInvoke,
): SystemAdapter {
  return {
    runtime: "tauri",
    healthCheck: () => invoke<HealthStatus>("health_check"),
    schemaVersion: () => invoke<number>("schema_version"),
  };
}
