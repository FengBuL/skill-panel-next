import { useEffect, useMemo, useState } from "react";

import type { SystemAdapter } from "../contracts/system";
import type { SystemViewState } from "../contracts/system";
import { SystemController } from "../controllers/system-controller";

interface AppProps {
  adapter: SystemAdapter;
}

export function App({ adapter }: AppProps) {
  const controller = useMemo(() => new SystemController(adapter), [adapter]);
  const [state, setState] = useState<SystemViewState | null>(null);

  useEffect(() => {
    let active = true;

    void controller.load().then((nextState) => {
      if (active) {
        setState(nextState);
      }
    });

    return () => {
      active = false;
    };
  }, [controller]);

  return (
    <main className="system-status">
      <h1>Skill Panel Next</h1>
      <p className="system-status__purpose">生产基础链路检查</p>

      {state === null && <p role="status">正在检查运行状态</p>}

      {state?.status === "ready" && (
        <section aria-label="运行状态">
          <p>运行状态：正常</p>
          <p>运行环境：{state.runtime}</p>
          <p>Schema 版本：{state.schemaVersion}</p>
        </section>
      )}

      {state?.status === "unavailable" && <p role="alert">{state.message}</p>}
    </main>
  );
}
