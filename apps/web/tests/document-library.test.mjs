import assert from "node:assert/strict";
import { afterEach, beforeEach, mock, test } from "node:test";
import { JSDOM } from "jsdom";
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import {
  groupDocumentsIntoFolders, groupFoldersIntoCategories, resolveFolderLocation,
  folderItem, shareableDocuments,
} from "../app/document-library.ts";

// Next's image/link wrappers are supplied by the bundler in the application.
// Native DOM equivalents keep these tests focused on folder interactions.
mock.module("next/image", { defaultExport: (props) => {
  const attributes = { ...props };
  for (const name of ["priority", "fill", "unoptimized"]) delete attributes[name];
  return React.createElement("img", attributes);
} });
mock.module("next/link", { defaultExport: (props) => {
  const attributes = { ...props };
  delete attributes.prefetch;
  return React.createElement("a", attributes);
} });
const { default: Home } = await import("../app/page.tsx");
const { FolderCard } = await import("../app/components/Folder.tsx");
const { ShareDocumentClient } = await import("../app/share/[token]/ShareDocumentClient.tsx");

const aircraft = { id: "aircraft", code: "AIRCRAFT", name: "Aircraft" };
const engine = { id: "engine", code: "ENGINE", name: "Engine" };
const general = { id: "general", code: "JUST_DOCUMENT", name: "Just Document" };
function makeDocument(id, category = aircraft, msn = "123", status = "APPROVED") {
  return {
    id, category, msn, filename: `${id}.pdf`, status, mimeType: "application/pdf",
    sizeBytes: 2048, shareUrl: status === "APPROVED" ? `https://fly.ae/s/${id}` : null,
    createdAt: "2026-09-07T00:00:00Z",
  };
}

let dom, root, container, records, requests, copied, downloads, rejectDeletes;
const originals = new Map();
function global(name, value) {
  if (!originals.has(name)) originals.set(name, Object.getOwnPropertyDescriptor(globalThis, name));
  Object.defineProperty(globalThis, name, { value, configurable: true, writable: true });
}
function buttons(scope = container) { return [...scope.querySelectorAll("button")]; }
function button(label, scope = container) {
  const found = buttons(scope).find((item) => item.getAttribute("aria-label") === label || item.textContent.trim() === label);
  assert.ok(found, `Button not found: ${label}`);
  return found;
}
async function click(element) { await act(async () => element.click()); }
async function key(element, key, options = {}) {
  await act(async () => element.dispatchEvent(new window.KeyboardEvent("keydown", { key, bubbles: true, cancelable: true, ...options })));
}
async function pointer(element, type, options = {}) {
  const event = new window.MouseEvent(type, { bubbles: true, cancelable: true, clientX: 40, clientY: 40, ...options });
  Object.defineProperties(event, { pointerType: { value: "touch" }, isPrimary: { value: true } });
  await act(async () => element.dispatchEvent(event));
}
async function mount(element) {
  await act(async () => { root.render(element); await new Promise((resolve) => setTimeout(resolve, 15)); });
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 15)); });
}
async function openLibrary() {
  await mount(React.createElement(Home));
  await click(button("My Documents", container.querySelector(".primary-nav")));
}
function heading() { return container.querySelector("h1").textContent.trim(); }
function menu() { return window.document.querySelector('[role="menu"][aria-label$=" actions"]'); }

beforeEach(() => {
  dom = new JSDOM('<!doctype html><html><body><div id="root"></div><button id="outside">Outside</button></body></html>', { url: "http://localhost:3000/", pretendToBeVisual: true });
  for (const name of ["window", "document", "navigator", "HTMLElement", "Element", "Node", "Image", "MutationObserver"]) global(name, dom.window[name]);
  global("IS_REACT_ACT_ENVIRONMENT", true);
  window.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
  window.confirm = () => false;
  window.HTMLElement.prototype.scrollIntoView = () => {};
  records = [makeDocument("a"), makeDocument("b"), makeDocument("engine", engine), makeDocument("general", general, "GENERAL")];
  requests = []; copied = []; downloads = []; rejectDeletes = new Set();
  Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: async (value) => copied.push(value) } });
  window.HTMLAnchorElement.prototype.click = function () { downloads.push(this.href); };
  global("fetch", async (input, options = {}) => {
    const path = new URL(input).pathname.replace("/api/v1", "");
    if (path === "/auth/session/refresh") return Response.json({
      accessToken: "test-only-token", expiresAt: "2099-01-01T00:00:00Z",
      user: { id: "test", email: "test@example.com", displayName: "Test", authenticationMethod: "EMAIL" },
    });
    requests.push({ path, method: options.method ?? "GET", authorization: new Headers(options.headers).get("Authorization") });
    if (path === "/categories") return Response.json([aircraft, engine, general]);
    if (path === "/documents") return Response.json(records);
    if (path.match(/^\/documents\/[^/]+\/temporary-share$/) && options.method === "POST") {
      const id = path.split("/")[2];
      return Response.json({
        code: "7K9D-P4QX",
        shortUrl: `http://localhost:3000/s/7K9D-P4QX`,
        expiresAt: "2099-01-01T00:15:00Z",
        documentId: id,
      });
    }
    if (path.startsWith("/documents/") && options.method === "DELETE") {
      const id = path.split("/").at(-1);
      if (rejectDeletes.has(id)) return Response.json({ detail: "Temporary failure" }, { status: 503 });
      records = records.filter((item) => item.id !== id);
      return new Response(null, { status: 204 });
    }
    if (path.startsWith("/shares/")) return Response.json({ filename: "shared.pdf", category: "Aircraft", msn: "123", sizeBytes: 2048, downloadUrl: `https://download.example.com/${path.split("/").at(-1)}.pdf` });
    throw new Error(`Unexpected request ${path}`);
  });
  container = window.document.getElementById("root");
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  dom.window.close();
  for (const [name, descriptor] of originals) {
    if (descriptor) Object.defineProperty(globalThis, name, descriptor);
    else delete globalThis[name];
  }
  originals.clear();
});

test("folders keep identical identifiers separate across categories and fall back after deletion", () => {
  const folders = groupDocumentsIntoFolders([...records, makeDocument("deleted", aircraft, "gone", "DELETED")]);
  const categories = groupFoldersIntoCategories(folders);
  assert.equal(folders.length, 3);
  assert.deepEqual(categories.map((item) => item.category.code), ["AIRCRAFT", "ENGINE", "JUST_DOCUMENT"]);
  assert.equal(folders[0].documents.length, 2);
  assert.equal(folderItem(folders[2]).label, "General documents");
  assert.equal(resolveFolderLocation(categories, engine.id, folders[0].key).folder, undefined);
  assert.equal(resolveFolderLocation(categories, aircraft.id, "removed").category.category.id, aircraft.id);
  assert.deepEqual(resolveFolderLocation([], aircraft.id, folders[0].key), { category: undefined, folder: undefined });
  assert.equal(shareableDocuments([makeDocument("pending", aircraft, "123", "PROCESSING")]).length, 0);
});

test("sidebar, cards, breadcrumbs and back button navigate the same folder hierarchy", async () => {
  await openLibrary();
  assert.equal(container.querySelectorAll(".document-folder-tile").length, 3);
  await click(button("Open Aircraft, 2 documents"));
  assert.equal(heading(), "Aircraft");
  assert.equal(button("Collapse Aircraft").getAttribute("aria-expanded"), "true");
  await click(button("Open 123, 2 documents"));
  assert.equal(heading(), "123");
  assert.equal(container.querySelectorAll(".document-item").length, 2);
  assert.equal(container.querySelector('.documents-sidebar [aria-current="page"]').textContent.replace(/\s/g, ""), "1232");
  assert.equal(container.querySelector('.folder-breadcrumbs [aria-current="page"]').textContent, "123");
  await click(button("Aircraft", container.querySelector(".folder-breadcrumbs")));
  assert.equal(heading(), "Aircraft");
  await click(button("Back to My Documents"));
  assert.equal(heading(), "My Documents");
  await click(button("Expand Engine"));
  await click(container.querySelectorAll(".documents-navigation-folder")[1]);
  assert.equal(heading(), "123");
  assert.match(container.querySelector(".document-table").textContent, /engine.pdf/);
  assert.doesNotMatch(container.querySelector(".document-table").textContent, /a.pdf/);
});

test("mobile navigation exposes nested categories and closes after choosing a folder", async () => {
  await openLibrary();
  await click(button("Open navigation menu"));
  const navigation = container.querySelector(".mobile-navigation");
  await click(button("Expand Just Document", navigation));
  await click(button("General documents1", navigation));
  assert.equal(heading(), "General documents");
  assert.equal(container.querySelector(".mobile-navigation"), null);
  assert.match(container.querySelector(".document-table").textContent, /general.pdf/);
});

test("folder menu supports keyboard navigation, Escape focus return and outside dismissal", async () => {
  await openLibrary();
  const trigger = button("Actions for Aircraft");
  await key(trigger, "ArrowDown");
  assert.ok(menu());
  assert.equal(document.activeElement.textContent, "Copy links");
  await key(document.activeElement, "ArrowDown");
  assert.equal(document.activeElement.textContent, "Download files");
  await key(document.activeElement, "End");
  assert.equal(document.activeElement.textContent, "Delete all documents");
  await key(document.activeElement, "Home");
  assert.equal(document.activeElement.textContent, "Copy links");
  await key(document.activeElement, "Escape");
  assert.equal(menu(), null);
  assert.equal(document.activeElement, trigger);
  await key(trigger, "ArrowUp");
  assert.equal(document.activeElement.textContent, "Delete all documents");
  await key(document.activeElement, "Escape");
  await click(trigger);
  await pointer(document.getElementById("outside"), "pointerdown");
  assert.equal(menu(), null);
  await click(trigger);
  await key(document.activeElement, "Tab");
  assert.equal(menu(), null);
});

test("context menu stays within the viewport and never opens the folder", async () => {
  await openLibrary();
  Object.defineProperty(window, "innerWidth", { value: 360, configurable: true });
  Object.defineProperty(window, "innerHeight", { value: 640, configurable: true });
  const originalRect = window.HTMLElement.prototype.getBoundingClientRect;
  window.HTMLElement.prototype.getBoundingClientRect = function () {
    return this.getAttribute("role") === "menu" ? { width: 256, height: 216, left: 0, top: 0, right: 256, bottom: 216 } : originalRect.call(this);
  };
  const folderButton = button("Open Aircraft, 2 documents");
  await act(async () => folderButton.dispatchEvent(new window.MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: 350, clientY: 630 })));
  assert.equal(heading(), "My Documents");
  assert.ok(parseFloat(menu().style.left) + 256 <= 360);
  assert.ok(parseFloat(menu().style.top) + 216 <= 640);
  await key(document.activeElement, "Escape");
  assert.equal(document.activeElement, folderButton);
  await key(folderButton, "F10", { shiftKey: true });
  assert.ok(menu());
});

test("copy and download include approved documents only, and report success", async () => {
  records.push({ ...makeDocument("pending", aircraft, "123", "PROCESSING"), shareUrl: "https://fly.ae/s/pending" });
  await openLibrary();
  await click(button("Actions for Aircraft"));
  assert.match(menu().textContent, /links include file names, with one link per approved document/);
  await click(button("Copy links", menu()));
  assert.deepEqual(copied, [
    "Aircraft — 2 documents\n\n1. a.pdf\nhttps://fly.ae/s/a\n\n2. b.pdf\nhttps://fly.ae/s/b",
  ]);
  assert.match(container.querySelector('[role="status"]').textContent, /Copied 2 labeled document links from “Aircraft”/);
  await click(button("Actions for Aircraft"));
  await click(button("Download files", menu()));
  assert.deepEqual(downloads, ["https://download.example.com/a.pdf", "https://download.example.com/b.pdf"]);
  assert.deepEqual(requests.filter(({ path }) => path.startsWith("/shares/")).map(({ authorization }) => authorization), ["Bearer test-only-token", "Bearer test-only-token"]);
});

test("approved document creates a short link and local QR without exposing the session", async () => {
  await openLibrary();
  await click(button("Open Aircraft, 2 documents"));
  await click(button("Open 123, 2 documents"));
  await click(button("QR & short link", container.querySelector(".document-item")));

  const dialog = container.querySelector(".temporary-share-dialog");
  assert.ok(dialog);
  assert.match(dialog.textContent, /7K9D-P4QX/);
  assert.ok(dialog.querySelector("svg"));
  assert.doesNotMatch(dialog.innerHTML, /test-only-token/);
  assert.deepEqual(
    requests.filter(({ path }) => path.endsWith("/temporary-share")),
    [{ path: "/documents/a/temporary-share", method: "POST", authorization: "Bearer test-only-token" }],
  );

  assert.match(dialog.textContent, /Short link/);
  assert.doesNotMatch(dialog.textContent, /Secret code/);
  await click(button("Copy short link", dialog));
  assert.deepEqual(copied, ["http://localhost:3000/s/7K9D-P4QX"]);
});

test("share page remains public without reading a browser session", async () => {
  window.history.replaceState({}, "", "/share/test-share-token");
  await mount(React.createElement(ShareDocumentClient));
  assert.equal(heading(), "shared.pdf");
  assert.deepEqual(requests, [{ path: "/shares/test-share-token", method: "GET", authorization: null }]);
  assert.equal(container.querySelector(".shared-card a").href, "https://download.example.com/test-share-token.pdf");
  assert.doesNotMatch(container.innerHTML, /test-only-token/);
});

test("short share route resolves the formatted temporary code", async () => {
  window.history.replaceState({}, "", "/s/7K9D-P4QX");
  await mount(React.createElement(ShareDocumentClient));
  assert.equal(heading(), "shared.pdf");
  assert.deepEqual(requests, [{
    path: "/shares/7K9D-P4QX",
    method: "GET",
    authorization: null,
  }]);
});

for (const stored of [null, "invalid json", JSON.stringify({ accessToken: "expired", expiresAt: "2000-01-01T00:00:00Z" })]) {
  test(`share page remains public with unavailable session: ${stored}`, async () => {
    window.history.replaceState({}, "", "/share/test-share-token");
    if (stored === null) window.sessionStorage.removeItem("flyae:session");
    else window.sessionStorage.setItem("flyae:session", stored);
    await mount(React.createElement(ShareDocumentClient));
    assert.equal(heading(), "shared.pdf");
    assert.equal(requests[0].authorization, null);
  });
}

test("unapproved folder actions are explained and disabled", async () => {
  records = [makeDocument("pending", aircraft, "123", "PENDING")];
  await openLibrary();
  await click(button("Actions for Aircraft"));
  assert.equal(button("Copy links", menu()).disabled, true);
  assert.equal(button("Download files", menu()).disabled, true);
  assert.match(menu().textContent, /available after approval/);
  assert.equal(document.activeElement.textContent, "Delete all documents");
});

test("deletion requires confirmation, retains failed files and recovers from deleting the last folder", async () => {
  records = [makeDocument("a"), makeDocument("b")];
  await openLibrary();
  await click(button("Open Aircraft, 2 documents"));
  await click(button("Open 123, 2 documents"));
  await click(button("Actions for 123"));
  await click(button("Delete all documents", menu()));
  assert.equal(requests.filter((request) => request.method === "DELETE").length, 0);
  window.confirm = () => true;
  rejectDeletes.add("b");
  await click(button("Actions for 123"));
  await click(button("Delete all documents", menu()));
  assert.equal(heading(), "123");
  assert.equal(container.querySelectorAll(".document-item").length, 1);
  assert.match(container.querySelector('[role="alert"]').textContent, /1 could not be deleted/);
  rejectDeletes.clear();
  await click(button("Actions for 123"));
  await click(button("Delete all documents", menu()));
  assert.equal(heading(), "My Documents");
  assert.match(container.textContent, /No documents yet/);
  assert.equal(container.querySelectorAll(".document-folder-tile").length, 0);
});

test("long press opens actions without navigation and is cancelled by scrolling or movement", async () => {
  const folder = folderItem(groupDocumentsIntoFolders([makeDocument("a")])[0]);
  let opened = 0;
  await mount(React.createElement(FolderCard, { folder, busy: false, onOpen: () => opened++, onAction() {} }));
  const target = button("Open 123, 1 document");
  await pointer(target, "pointerdown");
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 580)); });
  assert.ok(menu());
  await pointer(target, "pointerup");
  await click(target);
  assert.equal(opened, 0);
  await key(document.activeElement, "Escape");
  await pointer(target, "pointerdown");
  await pointer(target, "pointermove", { clientX: 40, clientY: 70 });
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 580)); });
  assert.equal(menu(), null);
  await pointer(target, "pointerup");
  await pointer(target, "pointerdown");
  await act(async () => window.dispatchEvent(new window.Event("scroll")));
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 580)); });
  assert.equal(menu(), null);
  await pointer(target, "pointerup");
  await click(target);
  assert.equal(opened, 1);
  await pointer(target, "pointerdown");
  await act(async () => target.dispatchEvent(new window.MouseEvent("contextmenu", { bubbles: true, cancelable: true })));
  await pointer(target, "pointerup");
  await click(target);
  assert.equal(opened, 1);
  assert.ok(menu());
});

test("a delayed refresh cannot bring deleted documents back", async () => {
  records = [makeDocument("a")];
  await openLibrary();
  const fetchCurrent = fetch;
  let resolveRefresh;
  global("fetch", (input, options) => new URL(input).pathname.endsWith("/documents")
    ? new Promise((resolve) => { resolveRefresh = resolve; }) : fetchCurrent(input, options));
  await click(button("My Documents", container.querySelector(".primary-nav")));
  await click(button("Open Aircraft, 1 document"));
  await click(button("Open 123, 1 document"));
  window.confirm = () => true;
  await click(button("Delete", container.querySelector(".document-item")));
  assert.match(container.textContent, /No documents yet/);
  await act(async () => resolveRefresh(Response.json([makeDocument("a")])));
  assert.match(container.textContent, /No documents yet/);
  assert.equal(container.querySelectorAll(".document-folder-tile").length, 0);
});
