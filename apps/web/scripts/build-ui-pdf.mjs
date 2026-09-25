import { readdir, readFile, mkdir } from "node:fs/promises";
import { dirname, extname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(scriptDirectory, "../../..");

function argument(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
}

function safeName(value) {
  return value.trim().replace(/[^a-z0-9._-]+/gi, "-").replace(/^-+|-+$/g, "");
}

function defaultOutputName() {
  const target = process.env.UI_BASE_URL
    ? safeName(new URL(process.env.UI_BASE_URL).hostname)
    : "local";
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  return `fly-ae-ui-${target}-${stamp}.pdf`;
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

async function screenshotFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...await screenshotFiles(path));
    } else if (
      extname(entry.name).toLowerCase() === ".png" &&
      !path.includes(`${process.platform === "win32" ? "\\" : "/"}attachments${process.platform === "win32" ? "\\" : "/"}`) &&
      !entry.name.startsWith("test-failed-")
    ) {
      files.push(path);
    }
  }
  return files.sort((left, right) => left.localeCompare(right));
}

const inputDirectory = resolve(argument("--input") ?? resolve(repositoryRoot, "artifacts/ui/results"));
const requestedOutput = argument("--output") ?? process.env.UI_ARTIFACT_NAME;
const outputPath = resolve(
  requestedOutput
    ? requestedOutput.endsWith(".pdf") ? requestedOutput : `${safeName(requestedOutput)}.pdf`
    : resolve(repositoryRoot, "artifacts/ui/bundles", defaultOutputName()),
);
const images = await screenshotFiles(inputDirectory);

if (!images.length) {
  throw new Error(`No UI screenshots found under ${inputDirectory}`);
}

const pages = await Promise.all(images.map(async (path, index) => {
  const encoded = (await readFile(path)).toString("base64");
  const relativeName = path.slice(inputDirectory.length + 1);
  return `<section class="sheet">
    <header><strong>${String(index + 1).padStart(2, "0")} / ${images.length}</strong><span>${escapeHtml(relativeName)}</span></header>
    <img src="data:image/png;base64,${encoded}" alt="${escapeHtml(relativeName)}">
  </section>`;
}));

const html = `<!doctype html><html><head><meta charset="utf-8"><style>
  @page { size: 12in 18in; margin: 0; }
  * { box-sizing: border-box; }
  body { margin: 0; color: #101a37; font-family: Arial, sans-serif; }
  .sheet { width: 12in; height: 18in; padding: .3in; display: flex; flex-direction: column; break-after: page; background: white; }
  .sheet:last-child { break-after: auto; }
  header { height: .5in; display: flex; gap: .18in; align-items: center; border-bottom: 1px solid #d7ddea; font-size: 14px; }
  header strong { color: #0873ce; }
  header span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  img { display: block; flex: 1; min-height: 0; width: 100%; object-fit: contain; object-position: top center; padding-top: .2in; }
</style></head><body>${pages.join("")}</body></html>`;

await mkdir(dirname(outputPath), { recursive: true });
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: "load" });
  await page.pdf({ path: outputPath, width: "12in", height: "18in", printBackground: true });
} finally {
  await browser.close();
}

console.log(`Created ${outputPath} with ${images.length} screenshots.`);
