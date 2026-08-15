import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const templateRoot = new URL("../", import.meta.url);

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
});

test("server-renders customer-copy legal placeholders", async () => {
  const [terms, privacy] = await Promise.all([
    render("/terms"),
    render("/privacy"),
  ]);
  assert.equal(terms.status, 200);
  assert.equal(privacy.status, 200);
  assert.match(await terms.text(), /Terms and Conditions/);
  assert.match(await privacy.text(), /Privacy Policy/);
});

test("removes the disposable starter preview", async () => {
  const [css, page, layout, packageJson, readme, designDocument, designManifest] =
    await Promise.all([
      readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
      readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
      readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
      readFile(new URL("../package.json", import.meta.url), "utf8"),
      readFile(new URL("../../../README.md", import.meta.url), "utf8"),
      readFile(new URL("../../../docs/design-system.md", import.meta.url), "utf8"),
      readFile(new URL("../../../docs/design-system.json", import.meta.url), "utf8"),
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
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);
  assert.doesNotMatch(layout, /codex-preview|_sites-preview|Starter Project/);

  await assert.rejects(
    access(new URL("app/_sites-preview/SkeletonPreview.tsx", templateRoot)),
  );
});
