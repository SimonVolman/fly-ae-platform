import { chromium } from 'playwright';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const base = (process.env.FLY_DEV_URL ?? 'https://dev.fly.ae').replace(/\/$/, '');
const runDate = new Date().toISOString().slice(0, 10);
const out = process.env.FLY_UI_ARTIFACT_DIR ?? join(process.cwd(), 'artifacts', 'ui', `dev-live-${runDate}`);
const fixture = await readFile(new URL('./fixtures/aviation-manual.pdf', import.meta.url));
const viewports = [
  { name: 'desktop', width: 1440, height: 900, isMobile: false, hasTouch: false },
  { name: 'tablet', width: 834, height: 1112, isMobile: true, hasTouch: true },
  { name: 'mobile', width: 390, height: 844, isMobile: true, hasTouch: true },
];
const results = [];
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true });

async function runViewport(viewport) {
  const filename = `dev-ui-${viewport.name}-${runDate}.pdf`;
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    deviceScaleFactor: 1,
    isMobile: viewport.isMobile,
    hasTouch: viewport.hasTouch,
    locale: 'en-US',
    colorScheme: 'light',
    acceptDownloads: true,
  });
  await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: base });
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  const item = { viewport: viewport.name, width: viewport.width, height: viewport.height, status: 'running', checkpoints: [], checks: [], errors: [] };
  results.push(item);
  let token;
  let documentId;
  let shortPath;
  let longPath;
  let publicContext;
  let publicPage;
  page.on('pageerror', error => item.errors.push(`pageerror: ${error.message}`));
  page.on('console', message => {
    if (message.type() === 'error' && !message.text().includes('status of 401')) {
      item.errors.push(`console: ${message.text().slice(0, 240)}`);
    }
  });
  page.on('requestfailed', request => {
    if (request.failure()?.errorText === 'net::ERR_ABORTED') return;
    if (request.url().includes('/api/v1/') || request.url().includes('s3.')) {
      item.errors.push(`requestfailed: ${request.method()} ${new URL(request.url()).pathname}: ${request.failure()?.errorText}`);
    }
  });
  page.on('response', async response => {
    try {
      const url = new URL(response.url());
      if (response.status() >= 400 && (url.pathname.includes('/api/v1/') || url.pathname.includes('__s3_proxy') || url.hostname.includes('s3'))) {
        if (url.pathname !== '/api/v1/auth/session/refresh') item.errors.push(`HTTP ${response.status()}: ${response.request().method()} ${url.pathname}`);
      }
      if (url.origin !== base || !response.ok()) return;
      if (url.pathname === '/api/v1/guest/sessions' && response.request().method() === 'POST') {
        token = (await response.json()).accessToken;
      }
      if (url.pathname === '/api/v1/documents' && response.request().method() === 'POST') {
        documentId = (await response.json()).id;
      }
    } catch (error) { item.errors.push(`response observer: ${error.message}`); }
  });
  async function shot(code, label, locator, pauseMs = 180) {
    if (locator) await locator.scrollIntoViewIfNeeded();
    else await page.evaluate(() => window.scrollTo(0, 0));
    if (pauseMs) await page.waitForTimeout(pauseMs);
    const file = `${viewport.name}-${code}.png`;
    await page.screenshot({ path: join(out, file), animations: 'disabled' });
    item.checkpoints.push({ file, label, viewport: viewport.name });
    console.log(`${viewport.name} screenshot ${code}: ${label}`);
  }
  async function publicShot(code, label) {
    await publicPage.waitForTimeout(180);
    const file = `${viewport.name}-${code}.png`;
    await publicPage.screenshot({ path: join(out, file), animations: 'disabled' });
    item.checkpoints.push({ file, label, viewport: viewport.name });
    console.log(`${viewport.name} screenshot ${code}: ${label}`);
  }
  try {
    const homeResponse = await page.goto(base, { waitUntil: 'domcontentloaded', timeout: 30000 });
    if (homeResponse.status() !== 200) throw new Error(`Homepage HTTP ${homeResponse.status()}`);
    await page.locator('.product-app').waitFor();
    await page.locator('.msn-field input').waitFor();
    item.checks.push('Homepage loads from live Dev');
    await shot('01-home', 'Upload homepage');

    const login = await page.locator('button.mobile-login-button').isVisible()
      ? page.locator('button.mobile-login-button') : page.locator('button.desktop-login');
    await login.click();
    await page.getByRole('dialog', { name: 'Log in' }).waitFor();
    await shot('02-login', 'Login dialog', page.getByRole('dialog', { name: 'Log in' }));
    item.checks.push('Login dialog opens');
    await page.locator('.login-dialog button.close').click();

    const category = await page.locator('.category-field select').inputValue();
    if (!category) throw new Error('Default Aircraft category is not selected');
    await page.locator('input[type="file"]').setInputFiles({ name: filename, mimeType: 'application/pdf', buffer: fixture });
    await page.locator('.guest-upload-options input[type="checkbox"]').check();
    const uploadButton = page.locator('button.upload-button');
    if (await uploadButton.isEnabled()) throw new Error('Upload is enabled without required identifier');
    await shot('03-required', 'Selected file: identifier still required', page.locator('.upload-panel'));
    item.checks.push('Upload blocked until identifier entered');

    await page.locator('.msn-field input').fill(`DEV-UI-${viewport.name.toUpperCase()}-0928`);
    if (!await uploadButton.isEnabled()) throw new Error('Upload stays disabled after entering identifier');
    await shot('04-details', 'Completed document details', page.locator('.msn-field'));
    await shot('05-selected', 'File ready and guest terms accepted', page.locator('.upload-panel'));
    item.checks.push('PDF file selected in browser');

    await uploadButton.click();
    try {
      const progress = page.locator('.upload-progress');
      await progress.waitFor({ state: 'visible', timeout: 2500 });
      await shot('06-progress', 'Secure upload in progress', progress, 0);
    } catch {
      // A tiny PDF can complete before Chromium captures this transient screen.
    }
    const state = await page.waitForFunction(() => {
      if (document.querySelector('.sharing-ready')) return 'approved';
      if (document.querySelector('.app-error, .upload-file-error')) return 'failed';
      return null;
    }, null, { timeout: 120000 });
    if (await state.jsonValue() !== 'approved') {
      await shot('06-upload-failed', 'Upload failure', page.locator('.upload-panel'));
      throw new Error(`Upload failed: ${await page.locator('.app-error, .upload-file-error').allTextContents()}`);
    }
    item.checks.push('Browser PDF upload approved');
    await shot('06-share-ready', 'Upload approved and share link ready', page.locator('.sharing-ready'));
    const longUrl = (await page.locator('.sharing-ready-link code').textContent()).trim();
    longPath = new URL(longUrl).pathname;
    if (!longPath.startsWith('/share/') && !longPath.startsWith('/s/')) throw new Error(`Unexpected share path: ${longPath}`);

    await page.getByRole('button', { name: 'QR & short link' }).click();
    await page.getByRole('dialog', { name: 'Share' }).waitFor();
    if (await page.locator('.temporary-share-qr svg path').count() < 1) throw new Error('QR SVG is empty');
    shortPath = new URL(await page.locator('.temporary-share-details a').getAttribute('href')).pathname;
    await shot('07-qr', 'QR and 15-minute short link', page.getByRole('dialog', { name: 'Share' }));
    item.checks.push('QR and short link created on live Dev');
    await page.getByRole('button', { name: 'Copy short link' }).click();
    const copied = await page.evaluate(() => navigator.clipboard.readText());
    if (new URL(copied).pathname !== shortPath) throw new Error('Copied short link differs from dialog');
    item.checks.push('Short link copies to clipboard');
    await page.getByRole('button', { name: 'Close' }).click();

    publicContext = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height }, deviceScaleFactor: 1, isMobile: viewport.isMobile, hasTouch: viewport.hasTouch, locale: 'en-US' });
    publicPage = await publicContext.newPage();
    publicPage.setDefaultTimeout(15000);
    let sharedResponse = await publicPage.goto(base + longPath, { waitUntil: 'domcontentloaded', timeout: 30000 });
    if (sharedResponse.status() !== 200) throw new Error(`Long share route HTTP ${sharedResponse.status()}`);
    await publicPage.getByRole('heading', { name: filename }).waitFor({ timeout: 30000 });
    await publicShot('08-public-share', 'Public share page without login');
    const downloadUrl = await publicPage.getByRole('link', { name: 'Download file' }).getAttribute('href');
    const downloaded = await publicContext.request.get(downloadUrl, { timeout: 30000 });
    if (!downloaded.ok() || !(await downloaded.body()).subarray(0, 5).equals(Buffer.from('%PDF-'))) throw new Error(`PDF download invalid: HTTP ${downloaded.status()}`);
    item.checks.push('Public share link downloads the PDF');

    sharedResponse = await publicPage.goto(base + shortPath, { waitUntil: 'domcontentloaded', timeout: 30000 });
    if (sharedResponse.status() !== 200) throw new Error(`Short share route HTTP ${sharedResponse.status()}`);
    await publicPage.getByRole('heading', { name: filename }).waitFor({ timeout: 30000 });
    await publicShot('09-short-share', 'Short-link destination');
    item.checks.push('Short link opens the same PDF without login');

    if (!token || !documentId) throw new Error('Browser session did not expose created test document for cleanup');
    const deletion = await fetch(`${base}/api/v1/documents/${documentId}`, { method: 'DELETE', headers: { authorization: `Bearer ${token}` } });
    if (!deletion.ok) throw new Error(`Test document cleanup failed: HTTP ${deletion.status}`);
    documentId = undefined;
    item.checks.push('Test document deleted after screenshots');
    await publicPage.goto(base + longPath, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await publicPage.getByRole('heading', { name: 'Document not found' }).waitFor({ timeout: 30000 });
    await publicShot('10-revoked-share', 'Share link unavailable after deletion');
    const revokedShort = await publicContext.request.get(`${base}/api/v1/shares/${encodeURIComponent(shortPath.split('/').at(-1))}`);
    if (revokedShort.status() !== 404) throw new Error(`Short share not revoked: HTTP ${revokedShort.status()}`);
    item.checks.push('Long and short links revoked after deletion');
    item.status = 'passed';
  } catch (error) {
    item.status = 'failed';
    item.errors.push(error.stack ?? String(error));
    try { await shot('99-failure', 'Failure state'); } catch {}
  } finally {
    if (token && documentId) {
      try {
        const cleanup = await fetch(`${base}/api/v1/documents/${documentId}`, { method: 'DELETE', headers: { authorization: `Bearer ${token}` } });
        item.checks.push(`Failure cleanup HTTP ${cleanup.status}`);
      } catch (error) { item.errors.push(`Failure cleanup: ${error.message}`); }
    }
    await publicContext?.close();
    await context.close();
  }
  console.log(`${viewport.name}: ${item.status}; ${item.checks.join('; ')}`);
  if (item.errors.length) console.log(`${viewport.name} errors: ${item.errors.join(' | ')}`);
}

try {
  for (const viewport of viewports) await runViewport(viewport);
} finally {
  await browser.close();
  await writeFile(join(out, 'results.json'), JSON.stringify({ base, date: new Date().toISOString(), results }, null, 2));
}
if (results.some(result => result.status !== 'passed')) process.exitCode = 1;
