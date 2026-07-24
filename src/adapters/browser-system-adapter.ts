import type { SystemAdapter } from "../contracts/system";

export function createBrowserSystemAdapter(): SystemAdapter {
  return {
    runtime: "browser-mock",
    healthCheck: async () => ({
      status: "ok",
      service: "skill-panel-next",
    }),
    schemaVersion: async () => 1,
  };
}
