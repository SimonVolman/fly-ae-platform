import type { Page, TestInfo } from "@playwright/test";

function safeName(value: string) {
  return value.trim().replace(/[^a-z0-9_-]+/gi, "-").replace(/^-+|-+$/g, "");
}

export async function captureCheckpoint(
  page: Page,
  testInfo: TestInfo,
  name: string,
) {
  if (process.env.UI_SCREENSHOTS !== "1") return;

  await page.evaluate(async () => {
    await document.fonts?.ready;
    await Promise.all(
      Array.from(document.images)
        .filter((image) => !image.complete)
        .map((image) => {
          // A blocked third-party image can remain incomplete forever. It must
          // not prevent the diagnostic screenshot from being written.
          return new Promise<void>((resolve) => {
            const finish = () => resolve();
            image.addEventListener("load", finish, { once: true });
            image.addEventListener("error", finish, { once: true });
            window.setTimeout(finish, 1500);
          });
        }),
    );
  });

  await page.addStyleTag({
    content:
      "*, *::before, *::after { animation: none !important; transition: none !important; caret-color: transparent !important; }",
  });

  const filename = `${safeName(name) || "checkpoint"}.png`;
  const path = testInfo.outputPath(filename);
  await page.screenshot({
    path,
    fullPage: true,
    animations: "disabled",
    caret: "hide",
  });
  await testInfo.attach(`checkpoint-${safeName(name) || "screen"}`, {
    path,
    contentType: "image/png",
  });
}
