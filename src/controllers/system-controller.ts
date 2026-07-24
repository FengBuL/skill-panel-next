import type { SystemAdapter, SystemViewState } from "../contracts/system";

export class SystemController {
  constructor(private readonly adapter: SystemAdapter) {}

  async load(): Promise<SystemViewState> {
    try {
      const [health, schemaVersion] = await Promise.all([
        this.adapter.healthCheck(),
        this.adapter.schemaVersion(),
      ]);

      return {
        status: "ready",
        runtime: this.adapter.runtime,
        service: health.service,
        schemaVersion,
      };
    } catch {
      return {
        status: "unavailable",
        runtime: this.adapter.runtime,
        message: "运行状态暂时不可用",
      };
    }
  }
}
