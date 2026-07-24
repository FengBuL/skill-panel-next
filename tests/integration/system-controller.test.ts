import { describe, expect, it } from "vitest";

import type { SystemAdapter } from "../../src/contracts/system";
import { SystemController } from "../../src/controllers/system-controller";

describe("SystemController", () => {
  it("loads runtime, health, and schema version through one adapter", async () => {
    const adapter: SystemAdapter = {
      runtime: "browser-mock",
      healthCheck: async () => ({
        status: "ok",
        service: "skill-panel-next",
      }),
      schemaVersion: async () => 1,
    };

    const controller = new SystemController(adapter);

    await expect(controller.load()).resolves.toEqual({
      status: "ready",
      runtime: "browser-mock",
      service: "skill-panel-next",
      schemaVersion: 1,
    });
  });

  it("returns a safe unavailable state when the adapter fails", async () => {
    const adapter: SystemAdapter = {
      runtime: "tauri",
      healthCheck: async () => {
        throw new Error("/Users/example/private/database failed");
      },
      schemaVersion: async () => 1,
    };

    const controller = new SystemController(adapter);

    await expect(controller.load()).resolves.toEqual({
      status: "unavailable",
      runtime: "tauri",
      message: "运行状态暂时不可用",
    });
  });
});
