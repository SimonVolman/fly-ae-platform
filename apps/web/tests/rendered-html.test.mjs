import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";
import {
  apiRequestError,
  formatRetryAfter,
  parseRetryAfter,
} from "../app/api-error.ts";

const templateRoot = new URL("../", import.meta.url);

test("formats API rate limits with a useful wait time", () => {
  assert.equal(parseRetryAfter("2806"), 2806);
  assert.equal(parseRetryAfter("invalid"), null);
  assert.equal(formatRetryAfter(1), "1 second");
  assert.equal(formatRetryAfter(60), "1 minute");
  assert.equal(formatRetryAfter(2806), "47 minutes");
  assert.equal(formatRetryAfter(3600), "1 hour");

  const error = apiRequestError(
    new Response(null, {
      status: 429,
      headers: { "Retry-After": "2806" },
    }),
    { detail: "Too many requests. Try again later." },
  );

  assert.equal(error.status, 429);
  assert.equal(error.retryAfterSeconds, 2806);
  assert.equal(error.message, "Too many requests. Try again in 47 minutes.");
});

async function render(pathname = "/") {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request(`http://localhost${pathname}`, {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("server-renders the fly.ae upload application", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>fly\.ae — Secure aircraft documentation<\/title>/i);
  assert.match(html, /fly\.ae/);
  assert.match(html, /Upload an aviation document/);
  assert.match(html, /Document details/);
  assert.match(html, /Continue to PDF upload/);
  assert.doesNotMatch(html, /<h2>PDF upload<\/h2>/);
  assert.match(html, /No email is needed for a first upload up to 10 MB/);
  assert.match(html, /My Documents/);
  assert.doesNotMatch(html, /codex-preview|react-loading-skeleton/i);
});

test("server-renders the fly.ae style guide", async () => {
  const response = await render("/style-guide");
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>fly\.ae — Style guide<\/title>/i);
  assert.match(html, /Clear by design/);
  assert.match(html, /Brand and colour/);
  assert.match(html, /Controls and states/);
  assert.match(html, /Product building blocks/);
  assert.doesNotMatch(html, /Figma UI Kit|node 160:1088/);
});

test("server-renders the Terms draft and Privacy placeholder", async () => {
  const [terms, privacy] = await Promise.all([
    render("/terms"),
    render("/privacy"),
  ]);
  assert.equal(terms.status, 200);
  assert.equal(privacy.status, 200);
  const termsHtml = await terms.text();
  assert.match(termsHtml, /Terms and Conditions/);
  assert.match(termsHtml, /Draft — not approved for production/);
  assert.match(termsHtml, /An “approved” status does not certify/);
  assert.match(termsHtml, /LEGAL ENTITY NAME/);
  assert.doesNotMatch(termsHtml, /Content pending/);
  assert.match(await privacy.text(), /Privacy Policy/);
});

test("removes the disposable starter preview", async () => {
  const [
    css,
    page,
    layout,
    packageJson,
    readme,
    designDocument,
    designManifest,
    infrastructureTemplate,
    securityConfig,
  ] =
    await Promise.all([
      readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
      readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
      readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
      readFile(new URL("../package.json", import.meta.url), "utf8"),
      readFile(new URL("../../../README.md", import.meta.url), "utf8"),
      readFile(new URL("../../../docs/design-system.md", import.meta.url), "utf8"),
      readFile(new URL("../../../docs/design-system.json", import.meta.url), "utf8"),
      readFile(new URL("../../../infra/aws/template.yml", import.meta.url), "utf8"),
      readFile(
        new URL(
          "../../backend/src/main/kotlin/ae/fly/backend/config/SecurityConfig.kt",
          import.meta.url,
        ),
        "utf8",
      ),
    ]);

  const designSystem = JSON.parse(designManifest);

  assert.match(page, /@uppy\/aws-s3/);
  assert.match(page, /createMultipartUpload/);
  assert.match(page, /auth\/otp\/verify/);
  assert.match(page, /guest\/sessions/);
  assert.match(page, /GUEST_MAX_FILE_SIZE = 10 \* 1024 \* 1024/);
  assert.match(page, /workflowStep === 2/);
  assert.match(page, /workflowStep === 3/);
  assert.match(page, /sessionStorage/);
  assert.match(page, /APPROVED/);
  assert.match(layout, /title:\s*"fly\.ae/);
  assert.match(css, /\.app-drop-zone/);
  assert.match(css, /\.document-table/);
  assert.match(css, /\.step-summary/);
  assert.match(css, /\.brand-logo/);
  assert.match(css, /--font-sans:\s*"Titillium Web"/);
  assert.match(page, /mobile-navigation/);
  assert.match(page, /Open account menu/);
  assert.match(page, /empty-documents-state/);
  assert.match(page, /auth-dialog-error/);
  assert.match(css, /\.auth-dialog-error/);
  assert.match(css, /\.aviation-notice/);
  assert.match(css, /--color-ink:\s*#101a3a/);
  assert.match(css, /--radius-control:\s*6px/);
  assert.match(css, /prefers-reduced-motion:\s*reduce/);
  assert.match(readme, /Дизайн-система/);
  assert.match(readme, /docs\/design-system\.md/);
  assert.match(designDocument, /Figma → JSON manifest → CSS tokens/);
  assert.equal(designSystem.name, "fly.ae Design System");
  assert.equal(designSystem.tokens.color.ink.css, "--color-ink");
  assert.equal(designSystem.implementation.livingGuide, "/style-guide");
  assert.match(infrastructureTemplate, /ExposeHeaders:\s*\n\s*- Retry-After/);
  assert.match(securityConfig, /exposedHeaders = listOf\([^)]*"Retry-After"/s);
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);
  assert.doesNotMatch(layout, /codex-preview|_sites-preview|Starter Project/);

  await assert.rejects(
    access(new URL("app/_sites-preview/SkeletonPreview.tsx", templateRoot)),
  );
});
