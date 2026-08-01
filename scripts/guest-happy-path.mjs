import { readFile } from "node:fs/promises";

const apiBase = process.env.FLY_API_URL ?? "http://localhost:8080/api/v1";
const pdf = await readFile(
  new URL("./fixtures/aviation-manual.pdf", import.meta.url),
);

async function request(path, options = {}) {
  const response = await fetch(`${apiBase}${path}`, options);
  const body = await response.text();
  if (!response.ok) {
    throw new Error(`${options.method ?? "GET"} ${path}: ${response.status} ${body}`);
  }
  return body ? JSON.parse(body) : null;
}

async function expectStatus(path, status, options = {}) {
  const response = await fetch(`${apiBase}${path}`, options);
  if (response.status !== status) {
    throw new Error(`${options.method ?? "GET"} ${path}: expected ${status}, got ${response.status}`);
  }
}

async function createGuest() {
  return request("/guest/sessions", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      acceptedLegal: true,
      termsVersion: "customer-v1",
      privacyVersion: "customer-v1",
    }),
  });
}

let accessToken;
let documentId;
let uploadId;

try {
  const guest = await createGuest();
  accessToken = guest.accessToken;
  if (!accessToken.startsWith("gst_") || guest.maxFileSizeBytes !== 10_485_760) {
    throw new Error("Guest session does not expose the expected 10 MiB capability");
  }
  const auth = { authorization: `Bearer ${accessToken}` };
  console.log("✓ UP-003-T01 guest session created without email");

  const categories = await request("/categories");
  const category = categories.find(({ code }) => code === "AIRCRAFT");
  if (!category) throw new Error("AIRCRAFT seed category is missing");

  await expectStatus("/documents", 413, {
    method: "POST",
    headers: { ...auth, "content-type": "application/json" },
    body: JSON.stringify({
      categoryId: category.id,
      msn: "A6-GUEST-LIMIT",
      filename: "too-large.pdf",
      mimeType: "application/pdf",
      sizeBytes: 10_485_761,
    }),
  });
  console.log("✓ UP-003-T06 backend rejects guest metadata above 10 MiB with 413");

  const document = await request("/documents", {
    method: "POST",
    headers: { ...auth, "content-type": "application/json" },
    body: JSON.stringify({
      categoryId: category.id,
      msn: "A6-GUEST-003",
      filename: "aviation-manual.pdf",
      mimeType: "application/pdf",
      sizeBytes: pdf.byteLength,
    }),
  });
  documentId = document.id;

  await expectStatus("/documents", 403, { headers: auth });
  const otherGuest = await createGuest();
  await expectStatus(`/documents/${documentId}`, 404, {
    headers: { authorization: `Bearer ${otherGuest.accessToken}` },
  });
  console.log("✓ UP-003-T03/T04 My Documents and another owner's document are inaccessible");

  const multipart = await request(`/documents/${documentId}/multipart`, {
    method: "POST",
    headers: auth,
  });
  uploadId = multipart.uploadId;
  const signedPart = await request(
    `/documents/${documentId}/multipart/${encodeURIComponent(uploadId)}/parts/1`,
    { headers: auth },
  );
  const upload = await fetch(signedPart.url, {
    method: "PUT",
    headers: signedPart.headers,
    body: pdf,
  });
  if (!upload.ok) throw new Error(`S3 part upload failed: ${upload.status}`);
  const etag = upload.headers.get("etag");
  if (!etag) throw new Error("S3 did not return an ETag");

  await request(
    `/documents/${documentId}/multipart/${encodeURIComponent(uploadId)}/complete`,
    {
      method: "POST",
      headers: { ...auth, "content-type": "application/json" },
      body: JSON.stringify({ parts: [{ partNumber: 1, etag }] }),
    },
  );
  uploadId = undefined;

  let approved;
  for (let attempt = 0; attempt < 40; attempt += 1) {
    approved = await request(`/documents/${documentId}`, { headers: auth });
    if (approved.status === "APPROVED") break;
    if (["FAILED", "REJECTED"].includes(approved.status)) {
      throw new Error(`Processing ended in ${approved.status}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  if (approved?.status !== "APPROVED" || !approved.shareUrl) {
    throw new Error("Guest document was not approved within 10 seconds");
  }
  console.log("✓ UP-003-T01/T02 PDF approved and guest received its share link");

  const shareToken = new URL(approved.shareUrl).pathname.split("/").at(-1);
  const shared = await request(`/shares/${encodeURIComponent(shareToken)}`);
  const downloaded = new Uint8Array(
    await (await fetch(shared.downloadUrl)).arrayBuffer(),
  );
  if (Buffer.from(downloaded.subarray(0, 5)).toString() !== "%PDF-") {
    throw new Error("Protected guest download is not a PDF");
  }
  console.log("✓ Guest share link downloads the protected PDF");

  await request(`/documents/${documentId}`, { method: "DELETE", headers: auth });
  await expectStatus(`/shares/${encodeURIComponent(shareToken)}`, 404);
  documentId = undefined;
  console.log("✓ Guest deleted its document and revoked the share link");
  console.log("UP-003 happy path passed.");
} catch (error) {
  if (accessToken && documentId) {
    const auth = { authorization: `Bearer ${accessToken}` };
    if (uploadId) {
      await fetch(
        `${apiBase}/documents/${documentId}/multipart/${encodeURIComponent(uploadId)}`,
        { method: "DELETE", headers: auth },
      ).catch(() => undefined);
    }
    await fetch(`${apiBase}/documents/${documentId}`, {
      method: "DELETE",
      headers: auth,
    }).catch(() => undefined);
  }
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
