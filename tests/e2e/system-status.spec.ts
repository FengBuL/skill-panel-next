import { mkdir } from "node:fs/promises";
import path from "node:path";

import { expect, test } from "@playwright/test";

test("production build exposes the technical status loop", async ({ page }) => {
  await page.goto("/");

  await expect(
    page.getByRole("heading", { name: "Skill Panel Next" }),
  ).toBeVisible();
  await expect(page.getByText("运行状态：正常")).toBeVisible();
  await expect(page.getByText("Schema 版本：1")).toBeVisible();
  await expect(page.getByRole("navigation")).toHaveCount(0);

  const evidenceDirectory = process.env.SPN_EVIDENCE_DIR;
  if (evidenceDirectory) {
    const absoluteDirectory = path.resolve(evidenceDirectory);
    await mkdir(absoluteDirectory, { recursive: true });
    await page.screenshot({
      path: path.join(absoluteDirectory, "system-status-1024x768.png"),
      fullPage: true,
    });
  }
});
