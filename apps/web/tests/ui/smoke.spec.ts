import { captureCheckpoint } from "./screenshots";
import { expect, installApiMock, test } from "./fixtures";

async function openLogin(page: Parameters<typeof installApiMock>[0]) {
  await expect(page.getByRole("region", { name: "Upload an aviation file" })).toBeVisible();
  const mobileButton = page.locator("button.mobile-login-button");
  const button = (await mobileButton.isVisible())
    ? mobileButton
    : page.locator("button.desktop-login");
  const dialog = page.getByRole("dialog");
  for (let attempt = 0; attempt < 2; attempt += 1) {
    await button.click();
    if (await dialog.isVisible().catch(() => false)) return;
    await page.waitForTimeout(50);
  }
  await expect(dialog).toBeVisible();
}

async function openDocuments(page: Parameters<typeof installApiMock>[0]) {
  await expect(page.getByRole("button", { name: "Open account menu" })).toBeVisible();
  const desktopButton = page.locator('nav[aria-label="Product"]').getByRole("button", {
    name: "My Documents",
    exact: true,
  });
  if (await desktopButton.isVisible()) {
    await desktopButton.click();
  } else {
    await page.getByRole("button", { name: "Open navigation menu" }).click();
    await page.locator(".mobile-navigation").getByRole("button", {
      name: "My Documents",
      exact: true,
    }).click();
  }
  await expect(page.getByRole("heading", { name: "My Documents" })).toBeVisible();
}

test("UI-001 upload home renders in the browser", async ({ page }) => {
  await installApiMock(page);
  await page.goto("/");
  await expect(page.getByRole("region", { name: "Upload an aviation file" })).toBeVisible();
  if (test.info().project.name === "mobile-chromium") {
    await expect(page.getByLabel("Category")).toBeVisible();
  } else {
    await expect(page.getByRole("button", { name: "Aircraft", exact: true })).toBeVisible();
  }
  if (test.info().project.name === "mobile-chromium") {
    await expect(page.getByRole("heading", { name: "Document details" })).toBeVisible();
  } else {
    await expect(page.getByRole("heading", { name: "File upload" })).toBeVisible();
  }
  await captureCheckpoint(page, test.info(), "01-upload-home");
});

test("UI-002 login dialog is reachable through visible navigation", async ({ page }) => {
  await installApiMock(page);
  await page.goto("/");
  await openLogin(page);
  await expect(page.getByRole("dialog", { name: "Log in" })).toBeVisible();
  await expect(page.getByLabel("Email")).toBeVisible();
  await expect(page.getByRole("button", { name: "Get one-time code" })).toBeVisible();
  await captureCheckpoint(page, test.info(), "02-login-dialog");
});

test("UI-003 OTP rate limit is shown in the login dialog", async ({ page }) => {
  await installApiMock(page, { otpRequestStatus: 429 });
  await page.goto("/");
  await openLogin(page);
  await page.getByLabel("Email").fill("pilot@example.com");
  await page.getByRole("button", { name: "Get one-time code" }).click();
  await expect(page.getByRole("alert")).toContainText("Try again in 47 minutes");
  await captureCheckpoint(page, test.info(), "03-login-rate-limit");
});

test("UI-004 authenticated user can open My Documents", async ({ page }) => {
  await installApiMock(page, { authenticated: true });
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Open account menu" })).toBeVisible();
  await openDocuments(page);
  await expect(page.getByRole("button", { name: "Open Aircraft, 2 documents" })).toBeVisible();
  await captureCheckpoint(page, test.info(), "04-document-library");
});

test("UI-005 folder navigation reaches the document list", async ({ page }) => {
  await installApiMock(page, { authenticated: true });
  await page.goto("/");
  await openDocuments(page);
  await page.getByRole("button", { name: "Open Aircraft, 2 documents" }).click();
  await page.getByRole("button", { name: "Open A6-FLY-001, 2 documents" }).click();
  await expect(page.getByRole("heading", { name: "A6-FLY-001" })).toBeVisible();
  await expect(page.getByText("aircraft-manual.pdf", { exact: true })).toBeVisible();
  await captureCheckpoint(page, test.info(), "05-folder-documents");
});

test("UI-006 folder actions stay within the desktop viewport", async ({ page }) => {
  await installApiMock(page, { authenticated: true });
  await page.goto("/");
  await openDocuments(page);
  await page.getByRole("button", { name: "Open Aircraft, 2 documents" }).click();
  const actions = page.getByRole("button", { name: "Actions for Aircraft" });
  await expect(actions).toBeVisible();
  await actions.click();
  const menu = page.getByRole("menu", { name: "Aircraft actions" });
  await expect(menu).toBeVisible();
  const box = await menu.boundingBox();
  expect(box).not.toBeNull();
  const viewport = page.viewportSize();
  expect(viewport).not.toBeNull();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.y).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(viewport!.width);
  expect(box!.y + box!.height).toBeLessThanOrEqual(viewport!.height);
  await captureCheckpoint(page, test.info(), `06-folder-actions-${test.info().project.name}`);
});

test("UI-007 document list error can recover with Try again", async ({ page }) => {
  const mock = await installApiMock(page, { authenticated: true, documentsFailUntilReleased: true });
  await page.goto("/");
  await openDocuments(page);
  await expect(page.getByRole("alert")).toContainText("temporarily unavailable");
  await captureCheckpoint(page, test.info(), "07-document-load-error");
  mock.releaseDocuments();
  await page.getByRole("alert").getByRole("button", { name: "Try again" }).click();
  await expect(page.getByRole("button", { name: "Open Aircraft, 2 documents" })).toBeVisible();
  await captureCheckpoint(page, test.info(), "07-document-load-recovered");
});

test("UI-008 unavailable share link explains the failure", async ({ page }) => {
  await installApiMock(page);
  await page.goto("/s/not-real");
  await expect(page.getByRole("heading", { name: "Document not found" })).toBeVisible();
  await expect(page.getByText("This share link is unavailable.", { exact: true })).toBeVisible();
  await captureCheckpoint(page, test.info(), "08-share-link-error");
});
