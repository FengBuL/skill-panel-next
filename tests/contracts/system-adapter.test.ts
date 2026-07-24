import { describe, expect, it, vi } from "vitest";

import { createBrowserSystemAdapter } from "../../src/adapters/browser-system-adapter";
import { createTauriSystemAdapter } from "../../src/adapters/tauri-system-adapter";

describe("SystemAdapter", () => {
  it("provides deterministic browser health and schema data", async () => {
    const adapter = createBrowserSystemAdapter();

    await expect(adapter.healthCheck()).resolves.toEqual({
      status: "ok",
      service: "skill-panel-next",
    });
    await expect(adapter.schemaVersion()).resolves.toBe(1);
    expect(adapter.runtime).toBe("browser-mock");
  });

  it("maps adapter methods to stable Tauri command names", async () => {
    const invoke = vi
      .fn()
      .mockResolvedValueOnce({ status: "ok", service: "skill-panel-next" })
      .mockResolvedValueOnce(1);
    const adapter = createTauriSystemAdapter(invoke);

    await expect(adapter.healthCheck()).resolves.toEqual({
      status: "ok",
      service: "skill-panel-next",
    });
    await expect(adapter.schemaVersion()).resolves.toBe(1);
    expect(invoke).toHaveBeenNthCalledWith(1, "health_check");
    expect(invoke).toHaveBeenNthCalledWith(2, "schema_version");
    expect(adapter.runtime).toBe("tauri");
  });
});
