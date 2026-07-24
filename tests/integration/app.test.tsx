import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { App } from "../../src/app/App";
import { createBrowserSystemAdapter } from "../../src/adapters/browser-system-adapter";

describe("App", () => {
  it("renders the minimal system status without product navigation", async () => {
    render(<App adapter={createBrowserSystemAdapter()} />);

    expect(
      screen.getByRole("heading", { name: "Skill Panel Next" }),
    ).toBeInTheDocument();
    expect(await screen.findByText("运行状态：正常")).toBeInTheDocument();
    expect(screen.getByText("Schema 版本：1")).toBeInTheDocument();
    expect(screen.queryByText("Library")).not.toBeInTheDocument();
  });
});
