import { expect, test as base, type Page, type TestInfo } from "@playwright/test";

const BASE_ORIGIN = new URL(
  process.env.UI_BASE_URL ?? "http://127.0.0.1:4173",
).origin;

export type ApiScenario = {
  authenticated?: boolean;
  otpRequestStatus?: number;
  documentsFailUntilReleased?: boolean;
};

export type ApiMockControls = {
  releaseDocuments: () => void;
};

export const categories = [
  { id: "aircraft", code: "AIRCRAFT", name: "Aircraft" },
  { id: "apu", code: "APU", name: "APU" },
  { id: "engine", code: "ENGINE", name: "Engine" },
  { id: "landing-gear", code: "LANDING_GEAR", name: "Landing Gear" },
  { id: "general", code: "JUST_DOCUMENT", name: "Just Document" },
];

export const documents = [
  {
    id: "aircraft-manual",
    category: categories[0],
    msn: "A6-FLY-001",
    filename: "aircraft-manual.pdf",
    mimeType: "application/pdf",
    sizeBytes: 2048,
    status: "APPROVED",
    shareUrl: "https://fly.ae/s/aircraft-manual",
    createdAt: "2026-09-01T00:00:00Z",
  },
  {
    id: "aircraft-checklist",
    category: categories[0],
    msn: "A6-FLY-001",
    filename: "aircraft-checklist.pdf",
    mimeType: "application/pdf",
    sizeBytes: 4096,
    status: "APPROVED",
    shareUrl: "https://fly.ae/s/aircraft-checklist",
    createdAt: "2026-09-02T00:00:00Z",
  },
  {
    id: "engine-manual",
    category: categories[2],
    msn: "ENG-001",
    filename: "engine-manual.pdf",
    mimeType: "application/pdf",
    sizeBytes: 3072,
    status: "PROCESSING",
    shareUrl: null,
    createdAt: "2026-09-03T00:00:00Z",
  },
];

function json(status: number, body: unknown, headers: Record<string, string> = {}) {
  return { status, contentType: "application/json", headers, body: JSON.stringify(body) };
}

export async function installApiMock(page: Page, scenario: ApiScenario = {}) {
  let documentsReleased = !scenario.documentsFailUntilReleased;
  const unexpectedApiRequests: string[] = [];

  await page.route("**/*", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const method = request.method();

    if (url.origin !== BASE_ORIGIN) {
      await route.abort("blockedbyclient");
      return;
    }

    if (!url.pathname.startsWith("/api/v1/")) {
      await route.continue();
      return;
    }

    const path = url.pathname.slice("/api/v1".length);

    if (path === "/categories" && method === "GET") {
      await route.fulfill(json(200, categories));
      return;
    }

    if (path === "/auth/session/refresh" && method === "POST") {
      if (!scenario.authenticated) {
        await route.fulfill(json(401, { detail: "No active session." }));
        return;
      }
      await route.fulfill(json(200, {
        accessToken: "test-access-token",
        expiresAt: "2099-01-01T00:00:00.000Z",
        user: {
          id: "test-user",
          email: "pilot@example.com",
          telegramUsername: null,
          displayName: "Test Pilot",
          authenticationMethod: "EMAIL",
        },
      }));
      return;
    }

    if (path === "/auth/otp/request" && method === "POST") {
      if (scenario.otpRequestStatus) {
        await route.fulfill(json(
          scenario.otpRequestStatus,
          { detail: "Too many requests. Try again later." },
          { "Retry-After": "2806" },
        ));
      } else {
        await route.fulfill({ status: 204, body: "" });
      }
      return;
    }

    if (path === "/documents" && method === "GET") {
      if (!documentsReleased) {
        await route.fulfill(json(503, { detail: "Document service is temporarily unavailable." }));
      } else {
        await route.fulfill(json(200, documents));
      }
      return;
    }

    if (/^\/documents\/[^/]+\/temporary-share$/.test(path) && method === "POST") {
      await route.fulfill(json(200, {
        code: "FLY8SAFE",
        shortUrl: "https://fly.ae/FLY8-SAFE",
        expiresAt: new Date(Date.now() + 15 * 60 * 1_000).toISOString(),
      }));
      return;
    }

    if (path.startsWith("/shares/") && method === "GET") {
      await route.fulfill(json(404, { detail: "This share link is unavailable." }));
      return;
    }

    unexpectedApiRequests.push(`${method} ${path}`);
    await route.abort("failed");
  });

  return {
    unexpectedApiRequests,
    releaseDocuments: () => {
      documentsReleased = true;
    },
  } satisfies ApiMockControls & { unexpectedApiRequests: string[] };
}

export const test = base.extend({
  page: async ({ page }, providePage, testInfo: TestInfo) => {
    const browserErrors: string[] = [];
    page.on("console", (message) => {
      if (
        message.type() === "error" &&
        !message.text().includes("ERR_BLOCKED_BY_CLIENT") &&
        !message.text().includes("Failed to load resource")
      ) {
        browserErrors.push(`console.error: ${message.text()}`);
      }
    });
    page.on("pageerror", (error) => browserErrors.push(`pageerror: ${error.message}`));

    await providePage(page);

    if (browserErrors.length) {
      await testInfo.attach("browser-errors.txt", {
        body: `${browserErrors.join("\n")}\n`,
        contentType: "text/plain",
      });
    }
  },
});

export { expect };
