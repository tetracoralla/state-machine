import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => window.localStorage.clear());
  await page.reload();
});

test("surfaces semantic path errors and restores the prior definition with undo", async ({ page }) => {
  const editor = page.getByLabel("Machine definition");
  await editor.fill(`version: "0.1"
id: broken
initial: missing
events: {}
states:
  pending:
    final: true
`);

  await expect(page.getByText("INITIAL_STATE_UNKNOWN")).toBeVisible();
  await page.getByRole("button", { name: "Find" }).click();
  await expect(page.getByRole("alert")).toContainText("MACHINE_INVALID");

  await page.getByRole("button", { name: "Undo" }).click();
  await expect(page.getByText("Valid", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Simulator" })).toBeVisible();
});

test("shows guard rejections and resolved context and effect inputs", async ({ page }) => {
  await page.getByRole("button", { name: "PAYMENT_SUCCESS", exact: true }).click();
  await page.getByLabel("amount *").fill("128");
  await page.getByLabel("payment_id *").fill("pay_ui");

  await page.getByRole("button", { name: "Run PAYMENT_SUCCESS" }).click();
  await expect(page.getByText("GUARD_RESULT_REQUIRED")).toBeVisible();

  await page.getByRole("button", { name: "Pass" }).click();
  await page.getByRole("button", { name: "Run PAYMENT_SUCCESS" }).click();
  await expect(page.locator(".current-state-card span")).toHaveText("paid");

  const details = page.locator(".trace-details").last();
  await details.locator("summary").click();
  await expect(details).toContainText("pay_ui");
  await expect(details).toContainText("record_payment");
  await expect(details).toContainText('"paid": true');
});

test("persists edits and exports the current valid source", async ({ page }) => {
  const editor = page.getByLabel("Machine definition");
  const source = await editor.inputValue();
  await editor.fill(source.replace("title: Order lifecycle", "title: Persisted lifecycle"));
  await expect(page.getByText("Persisted lifecycle", { exact: true })).toBeVisible();

  await page.reload();
  await expect(editor).toHaveValue(/title: Persisted lifecycle/);

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("order-lifecycle.machine.yaml");
});

for (const viewport of [
  { width: 390, height: 844 },
  { width: 960, height: 900 },
  { width: 1440, height: 1000 },
]) {
  test(`keeps the workspace contained at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await expect(page.getByRole("heading", { name: "Definition" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Topology" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Simulator" })).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });
}
