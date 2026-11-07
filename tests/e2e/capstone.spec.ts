import { expect, test, type Page } from "@playwright/test";

async function openMap(page: Page) {
  await page.goto("/");
  await expect(page.locator(".question-node")).toHaveCount(5);
  await expect(page.getByTestId("zoom-percentage")).not.toHaveText("100%");
}

async function transform(page: Page) {
  return page.locator(".react-flow__viewport").evaluate((element) => {
    const matrix = new DOMMatrix(getComputedStyle(element).transform);
    return { x: matrix.e, y: matrix.f, zoom: matrix.a };
  });
}

test("renders the default graph without runtime or hydration errors", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  await openMap(page);
  await expect(page.getByRole("heading", { name: "Delivery Network", level: 1 })).toBeVisible();
  await expect(page.locator(".react-flow__edge")).toHaveCount(5);
  await expect(page.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "2");
  await expect(page.getByRole("progressbar")).toHaveAttribute("aria-valuemax", "5");
  const panel = (await page.getByRole("complementary", { name: "Question progress panel" }).boundingBox())!;
  expect(panel.height).toBeLessThanOrEqual(960 * .65);
  for (const node of await page.locator(".question-node").all()) {
    const box = (await node.boundingBox())!;
    expect(box.x).toBeGreaterThan(308);
    expect(box.y).toBeGreaterThan(130);
    expect(box.x + box.width).toBeLessThan(panel.x - 8);
    expect(box.y + box.height).toBeLessThan(880);
  }
  await page.screenshot({ path: "test-results/capstone-desktop.png" });
  expect(errors).toEqual([]);
});

test("opens available and completed previews and acknowledges launching without changing progress", async ({ page }) => {
  await openMap(page);
  await page.getByRole("button", { name: "Question 4: Prioritize urgent orders, Available", exact: true }).click();
  const preview = page.getByRole("dialog");
  await expect(preview.getByRole("heading", { name: "Prioritize urgent orders" })).toBeVisible();
  await expect(preview.getByText("Priority queue", { exact: true })).toBeVisible();
  await expect(preview.getByText(/Lunch-hour orders/)).toBeVisible();
  await preview.getByRole("button", { name: "Start question" }).click();
  await expect(preview).toHaveCount(0);
  await expect(page.getByRole("status").filter({ hasText: "Question selected" })).toContainText("Prioritize urgent orders");
  await expect(page.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "2");
  await expect(page).toHaveURL("/");
  await page.getByRole("button", { name: "Question 1: Map the delivery zones, Completed", exact: true }).click();
  await expect(page.getByRole("dialog").getByText("Completed", { exact: true })).toBeVisible();
  await expect(page.getByRole("dialog").getByRole("button", { name: "Start question" })).toBeVisible();
});

test("explains every locked prerequisite and links back to the required node", async ({ page }) => {
  await openMap(page);
  await page.getByRole("button", { name: "Question 5: Find the fastest route, Locked", exact: true }).click();
  const preview = page.getByRole("dialog");
  await expect(preview.getByRole("heading", { name: "Find the fastest route" })).toBeVisible();
  await expect(preview.getByRole("button", { name: /Start question|Continue question/ })).toHaveCount(0);
  await expect(preview.getByRole("button", { name: "Find the nearest driver" })).toBeVisible();
  await expect(preview.getByRole("button", { name: "Prioritize urgent orders" })).toBeVisible();
  await page.screenshot({ path: "test-results/capstone-locked-preview.png" });
  await preview.getByRole("button", { name: "Find the nearest driver" }).click();
  await expect(preview).toHaveCount(0);
  await expect(page.getByTestId("question-row-delivery-driver")).toHaveAttribute("aria-pressed", "true");
});

test("synchronizes panel selection, graph activation, and current-question jumping", async ({ page }) => {
  await openMap(page);
  await page.getByTestId("question-row-delivery-priority").click();
  await expect(page.locator('[data-question-id="delivery-priority"]')).toHaveAttribute("aria-pressed", "true");
  const panel = (await page.locator(".question-panel").boundingBox())!;
  const node = (await page.locator('[data-question-id="delivery-priority"]').boundingBox())!;
  expect(node.x + node.width).toBeLessThan(panel.x);
  await page.getByRole("button", { name: "Jump to current question" }).click();
  await expect(page.getByTestId("question-row-delivery-driver")).toHaveAttribute("aria-pressed", "true");
  await page.locator('[data-question-id="delivery-neighborhoods"]').click();
  await expect(page.getByTestId("question-row-delivery-neighborhoods")).toHaveAttribute("aria-pressed", "true");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("filters topics, handles no results, and switches graphs without stale layouts", async ({ page }) => {
  await openMap(page);
  const input = page.getByRole("textbox", { name: "Search topics" });
  await input.fill("  STRINGS  ");
  await expect(page.getByRole("navigation", { name: "Coding topics" }).getByRole("button")).toHaveCount(1);
  await input.fill("not-a-topic");
  await expect(page.getByText("No topics found")).toBeVisible();
  await page.getByRole("button", { name: "Clear search" }).click();
  await page.getByRole("button", { name: /Arrays The Inventory Room/ }).click();
  await expect(page.getByRole("heading", { name: "The Inventory Room", level: 1 })).toBeVisible();
  await expect(page.locator(".question-node")).toHaveCount(4);
  await expect(page.getByRole("progressbar")).toHaveAttribute("aria-valuemax", "4");
  await page.getByRole("button", { name: /Trees The Folder Explorer/ }).click();
  await page.getByRole("button", { name: /Graphs Delivery Network/ }).click();
  await expect(page.locator(".question-node")).toHaveCount(5);
  await expect(page.locator('[data-question-id="delivery-driver"]')).toBeVisible();
  await expect(page.locator('[data-question-id="trees-2"]')).toHaveCount(0);
});

test("resizes and collapses navigation and the question panel", async ({ page }) => {
  await openMap(page);
  const separator = page.getByRole("separator", { name: "Resize topic sidebar" });
  await separator.focus();
  await page.keyboard.press("ArrowRight");
  await expect(separator).toHaveAttribute("aria-valuenow", "266");
  const box = (await separator.boundingBox())!;
  await page.mouse.move(box.x + 3, 400);
  await page.mouse.down();
  await page.mouse.move(box.x + 200, 400, { steps: 8 });
  await page.mouse.up();
  await expect(separator).toHaveAttribute("aria-valuenow", "360");
  await page.getByRole("button", { name: "Collapse topic sidebar" }).click();
  await expect(page.getByRole("complementary", { name: "Topic sidebar" })).toHaveCount(0);
  await page.getByRole("button", { name: "Show topics", exact: true }).click();
  await expect(separator).toHaveAttribute("aria-valuenow", "360");
  await page.getByRole("button", { name: "Collapse question panel" }).click();
  await expect(page.getByRole("complementary", { name: "Question progress panel" })).toHaveCount(0);
  await page.getByRole("button", { name: "Open question panel" }).click();
  await expect(page.getByRole("complementary", { name: "Question progress panel" })).toBeVisible();
});

test("zooms around the pointer, pans without opening questions, and fits the map", async ({ page }) => {
  await openMap(page);
  const region = (await page.getByTestId("graph-region").boundingBox())!;
  const pointer = { x: region.x + region.width - 55, y: region.height - 160 };
  const before = await transform(page);
  await page.mouse.move(pointer.x, pointer.y);
  await page.mouse.wheel(0, -180);
  await expect.poll(async () => (await transform(page)).zoom).toBeGreaterThan(before.zoom);
  // Wait until the wheel gesture settles before checking its invariant anchor.
  await expect.poll(async () => Number(await page.getByTestId("zoom-percentage").textContent().then((value) => value?.replace("%", "")))).toBeGreaterThan(Math.round(before.zoom * 100));
  const after = await transform(page);
  const worldBefore = { x: (pointer.x - region.x - before.x) / before.zoom, y: (pointer.y - before.y) / before.zoom };
  const worldAfter = { x: (pointer.x - region.x - after.x) / after.zoom, y: (pointer.y - after.y) / after.zoom };
  expect(worldAfter.x).toBeCloseTo(worldBefore.x, 0);
  expect(worldAfter.y).toBeCloseTo(worldBefore.y, 0);
  await page.mouse.down();
  await page.mouse.move(pointer.x - 120, pointer.y - 60, { steps: 10 });
  await page.mouse.up();
  expect((await transform(page)).x).not.toBe(after.x);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("button", { name: "Fit map", exact: true }).click();
  await expect.poll(async () => (await transform(page)).zoom).toBeCloseTo(before.zoom, 2);
  expect(await page.evaluate(() => ({ x: window.scrollX, y: window.scrollY }))).toEqual({ x: 0, y: 0 });
  await page.getByRole("button", { name: "Zoom in", exact: true }).click();
  await expect.poll(async () => (await transform(page)).zoom).toBeGreaterThan(before.zoom);
  await page.getByRole("button", { name: "Zoom out", exact: true }).click();
  await expect.poll(async () => (await transform(page)).zoom).toBeCloseTo(before.zoom, 2);
  const card = (await page.locator('[data-question-id="delivery-priority"]').boundingBox())!;
  await page.mouse.move(card.x + card.width / 2, card.y + card.height / 2);
  await page.mouse.down();
  await page.mouse.move(card.x + card.width / 2 + 25, card.y + card.height / 2 + 20, { steps: 5 });
  await page.mouse.up();
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test.describe("short desktop viewport", () => {
  test.use({ viewport: { width: 1440, height: 600 } });
  test("scrolls lists independently and reveals the graph's selected list entry", async ({ page }) => {
    await openMap(page);
    const list = page.locator(".question-list");
    const listBox = (await list.boundingBox())!;
    const before = await transform(page);
    await page.mouse.move(listBox.x + 60, listBox.y + 60);
    await page.mouse.wheel(0, 500);
    await expect.poll(() => list.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
    expect((await transform(page)).zoom).toBe(before.zoom);
    await page.locator('[data-question-id="delivery-zones"]').click();
    await expect(page.getByTestId("question-row-delivery-zones")).toHaveAttribute("aria-pressed", "true");
    await expect.poll(() => page.getByTestId("question-row-delivery-zones").evaluate((element) => {
      const parent = element.parentElement!.getBoundingClientRect();
      const row = element.getBoundingClientRect();
      return row.top >= parent.top && row.bottom <= parent.bottom;
    })).toBe(true);
    await page.keyboard.press("Escape");
    await page.locator('[data-question-id="delivery-route"]').click();
    await expect.poll(() => list.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
    expect(await page.evaluate(() => window.scrollY)).toBe(0);
  });
});

test("supports keyboard activation, focus restoration, search and map shortcuts", async ({ page }) => {
  await openMap(page);
  const node = page.locator('[data-question-id="delivery-priority"]');
  await node.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(node).toBeFocused();
  await page.keyboard.press("/");
  await expect(page.getByRole("textbox", { name: "Search topics" })).toBeFocused();
  await page.getByRole("button", { name: "Capstone Tree, fit map" }).focus();
  await page.keyboard.press("j");
  await expect(page.getByTestId("question-row-delivery-driver")).toHaveAttribute("aria-pressed", "true");
  await page.keyboard.press("f");
  await page.getByRole("button", { name: "Keyboard shortcuts" }).click();
  await expect(page.getByRole("dialog").getByRole("heading", { name: "Build something bigger." })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "Keyboard shortcuts" })).toBeFocused();
});

test.describe("mobile", () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

  test("keeps the map visible and switches topics through a focused drawer", async ({ page }) => {
    await openMap(page);
    await expect(page.getByRole("complementary", { name: "Topic sidebar" })).toHaveCount(0);
    await expect(page.getByRole("complementary", { name: "Question progress panel" })).toHaveCount(0);
    await page.screenshot({ path: "test-results/capstone-mobile.png" });
    await page.getByRole("button", { name: "Show topics", exact: true }).click();
    const drawer = page.getByRole("dialog", { name: "Choose a coding topic" });
    await expect(drawer).toBeVisible();
    await drawer.getByRole("textbox", { name: "Search topics" }).fill("trees");
    await drawer.getByRole("button", { name: /Trees The Folder Explorer/ }).click();
    await expect(drawer).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "The Folder Explorer", level: 1 })).toBeVisible();
    await expect(page.locator(".question-node")).toHaveCount(4);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
  });

  test("opens a bounded question overlay and centers the selected question", async ({ page }) => {
    await openMap(page);
    await page.getByRole("button", { name: "Open question panel" }).click();
    const panel = page.getByRole("dialog", { name: "Capstone question list" });
    await expect(panel).toBeVisible();
    const box = (await panel.boundingBox())!;
    expect(box.height).toBeLessThanOrEqual(844 * .65);
    expect(box.width).toBeLessThan(390 - 52);
    await page.screenshot({ path: "test-results/capstone-mobile-panel.png" });
    await panel.getByTestId("question-row-delivery-route").click();
    await expect(panel).toHaveCount(0);
    const node = page.locator('[data-question-id="delivery-route"]');
    await expect(node).toHaveAttribute("aria-pressed", "true");
    const nodeBox = (await node.boundingBox())!;
    expect(nodeBox.x).toBeGreaterThan(52);
    expect(nodeBox.x + nodeBox.width).toBeLessThan(390);
    // Closing the overlay must preserve the requested center rather than fitting again.
    expect(nodeBox.y + nodeBox.height / 2).toBeCloseTo((192 + (844 - 112)) / 2, 0);
    await node.click();
    await expect(page.getByRole("dialog").getByRole("heading", { name: "Find the fastest route" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(node).toBeFocused();
  });
});

test.describe("tablet", () => {
  test.use({ viewport: { width: 820, height: 1024 } });
  test("collapses navigation and preserves the map around the question overlay", async ({ page }) => {
    await openMap(page);
    await expect(page.getByRole("button", { name: "Show topics", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Open question panel" }).click();
    const overlay = page.getByRole("dialog", { name: "Capstone question list" });
    await expect(overlay).toBeVisible();
    await page.screenshot({ path: "test-results/capstone-tablet.png" });
    await overlay.getByRole("button", { name: "Close question panel" }).click();
    await expect(page.getByRole("button", { name: "Open question panel" })).toBeFocused();
  });
});
