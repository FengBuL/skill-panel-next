export type RuntimeKind = "browser-mock" | "tauri";

export interface HealthStatus {
  status: "ok";
  service: "skill-panel-next";
}

export interface SystemAdapter {
  readonly runtime: RuntimeKind;
  healthCheck(): Promise<HealthStatus>;
  schemaVersion(): Promise<number>;
}

export type SystemViewState =
  | {
      status: "ready";
      runtime: RuntimeKind;
      service: string;
      schemaVersion: number;
    }
  | {
      status: "unavailable";
      runtime: RuntimeKind;
      message: string;
    };
