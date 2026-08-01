import { readFile } from "node:fs/promises";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";

const apiBase = process.env.FLY_API_URL ?? "http://localhost:8080/api/v1";
const email = process.argv[2] ?? "pilot.happypath@fly.ae";
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

async function readOtp() {
  if (!stdin.isTTY) {
    throw new Error("Run this script in an interactive terminal to enter the development OTP.");
  }
  const prompt = createInterface({ input: stdin, output: stdout });
  try {
    return (await prompt.question("Development OTP from the backend console: ")).trim();
  } finally {
    prompt.close();
  }
}

let accessToken;
let documentId;
let uploadId;
let shareToken;

try {
  await request("/auth/otp/request", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email }),
  });
  console.log("✓ OTP requested");

  const code = await readOtp();
  const session = await request("/auth/otp/verify", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      email,
      code,
      acceptedLegal: true,
      termsVersion: "customer-v1",
      privacyVersion: "customer-v1",
    }),
  });
  accessToken = session.accessToken;
  const auth = { authorization: `Bearer ${accessToken}` };
  console.log("✓ OTP consumed and session issued");

  const categories = await request("/categories");
  const category = categories.find(({ code: value }) => value === "AIRCRAFT");
  if (!category) throw new Error("AIRCRAFT seed category is missing");

  const document = await request("/documents", {
    method: "POST",
    headers: { ...auth, "content-type": "application/json" },
    body: JSON.stringify({
      categoryId: category.id,
      msn: "A6-FLY-001",
      filename: "aviation-manual.pdf",
      mimeType: "application/pdf",
      sizeBytes: pdf.byteLength,
    }),
  });
  documentId = document.id;
  console.log("✓ Document metadata created");

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
  console.log("✓ PDF uploaded directly to private S3");

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
    throw new Error("Document was not approved within 10 seconds");
  }
  shareToken = new URL(approved.shareUrl).pathname.split("/").at(-1);
  console.log("✓ Document approved and share link created");

  const shared = await request(`/shares/${encodeURIComponent(shareToken)}`);
  const downloaded = new Uint8Array(
    await (await fetch(shared.downloadUrl)).arrayBuffer(),
  );
  if (Buffer.from(downloaded.subarray(0, 5)).toString() !== "%PDF-") {
    throw new Error("Protected download is not a PDF");
  }
  console.log("✓ Protected share download returned the PDF");

  const documents = await request("/documents", { headers: auth });
  if (!documents.some(({ id }) => id === documentId)) {
    throw new Error("Document is missing from My Documents");
  }
  console.log("✓ My Documents contains the approved upload");

  await request(`/documents/${documentId}`, { method: "DELETE", headers: auth });
  const revokedShare = await fetch(
    `${apiBase}/shares/${encodeURIComponent(shareToken)}`,
  );
  const deletedObject = await fetch(shared.downloadUrl);
  if (revokedShare.status !== 404 || deletedObject.status !== 404) {
    throw new Error("Delete did not revoke the share and remove the S3 object");
  }
  documentId = undefined;
  console.log("✓ Delete revoked the share and removed the S3 object");
  console.log("Happy path passed.");
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
