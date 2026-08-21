import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => window.localStorage.clear());
  await page.reload();
});

test("presents the Step Switch brand", async ({ page }) => {
  await expect(page).toHaveTitle("Step Switch");
  await expect(page.getByText("Step Switch", { exact: true })).toBeVisible();
  await expect(page.locator('input[type="file"]')).toHaveAttribute("hidden", "");
  await expect(page.getByRole("button", { name: /^$/ })).toHaveCount(0);
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

test("rejects an unreadable import without replacing the current draft", async ({ page }) => {
  const editor = page.getByLabel("Machine definition");
  const original = await editor.inputValue();
  await page.locator('input[type="file"]').setInputFiles({
    name: "broken.machine.yaml",
    mimeType: "text/yaml",
    buffer: Buffer.from("version: [broken\n"),
  });

  await expect(page.getByRole("alert")).toContainText("Import failed");
  await expect(editor).toHaveValue(original);
});

test("keeps the editor usable and warns when draft persistence is unavailable", async ({ page }) => {
  await page.addInitScript(() => {
    Storage.prototype.getItem = () => {
      throw new DOMException("Storage denied", "SecurityError");
    };
    Storage.prototype.setItem = () => {
      throw new DOMException("Storage denied", "SecurityError");
    };
  });
  await page.reload();

  await expect(page.getByRole("alert")).toContainText("Draft persistence is unavailable");
  const editor = page.getByLabel("Machine definition");
  const source = await editor.inputValue();
  await editor.fill(source.replace("title: Order lifecycle", "title: In-memory lifecycle"));
  await expect(page.getByText("In-memory lifecycle", { exact: true })).toBeVisible();
});

for (const viewport of [
  { width: 390, height: 844 },
  { width: 960, height: 900 },
  { width: 1200, height: 950 },
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

test("keeps the shipped topology fully visible at 1200px", async ({ page }) => {
  await page.setViewportSize({ width: 1200, height: 950 });
  const topology = page.getByLabel("State topology diagram");
  await expect(topology).toBeVisible();
  const overflow = await topology.evaluate((element) => element.scrollWidth - element.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});

test("reflows the editor before medium-width panels become cramped", async ({ page }) => {
  await page.setViewportSize({ width: 900, height: 700 });
  const definition = await page.locator(".definition-stack").boundingBox();
  const topology = await page.locator(".topology-panel").boundingBox();
  expect(definition).not.toBeNull();
  expect(topology).not.toBeNull();
  expect(topology!.y).toBeGreaterThanOrEqual(definition!.y + definition!.height);

  await page.setViewportSize({ width: 1440, height: 900 });
  const wideDefinition = await page.locator(".definition-stack").boundingBox();
  const wideTopology = await page.locator(".topology-panel").boundingBox();
  expect(wideDefinition).not.toBeNull();
  expect(wideTopology).not.toBeNull();
  expect(wideTopology!.x).toBeGreaterThanOrEqual(wideDefinition!.x + wideDefinition!.width);
});

test("keeps page, source, and narrow topology scrolling operable", async ({ page }) => {
  await page.setViewportSize({ width: 700, height: 650 });

  const documentMetrics = await page.evaluate(() => ({
    viewport: window.innerHeight,
    content: document.documentElement.scrollHeight,
  }));
  expect(documentMetrics.content).toBeGreaterThan(documentMetrics.viewport);
  const editor = page.getByLabel("Machine definition");
  const editorBox = await editor.boundingBox();
  expect(editorBox).not.toBeNull();
  expect(await editor.evaluate((element) => element.scrollHeight - element.clientHeight)).toBeGreaterThan(0);
  await page.mouse.move(editorBox!.x + editorBox!.width / 2, editorBox!.y + editorBox!.height / 2);
  await page.mouse.wheel(0, 600);
  await expect.poll(() => editor.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);

  await page.mouse.move(4, 300);
  await page.mouse.wheel(0, 10_000);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0);

  const topology = page.getByLabel("State topology diagram");
  await topology.scrollIntoViewIfNeeded();
  const topologyBox = await topology.boundingBox();
  expect(topologyBox).not.toBeNull();
  expect(await topology.evaluate((element) => element.scrollWidth - element.clientWidth)).toBeGreaterThan(100);
  await page.mouse.move(topologyBox!.x + topologyBox!.width / 2, topologyBox!.y + topologyBox!.height / 2);
  await page.mouse.wheel(500, 0);
  await expect.poll(() => topology.evaluate((element) => element.scrollLeft)).toBeGreaterThan(0);
});
