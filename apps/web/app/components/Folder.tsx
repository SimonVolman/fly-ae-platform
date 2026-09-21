"use client";

import Image from "next/image";
import {
  useCallback, useEffect, useId, useImperativeHandle, useLayoutEffect, useRef, useState,
  type PointerEvent, type Ref,
} from "react";
import { createPortal } from "react-dom";
import { documentCount, shareableDocuments, type FolderViewItem } from "../document-library";

export type FolderAction = "copy" | "qr" | "download" | "delete";
type ActionsHandle = { openAt: (x: number, y: number, origin: HTMLElement) => void };
type ActionsProps = {
  folder: FolderViewItem;
  busy: boolean;
  temporaryShareEnabled: boolean;
  onAction: (action: FolderAction, folder: FolderViewItem) => void;
  className?: string;
  ref?: Ref<ActionsHandle>;
  onOpenChange?: (open: boolean) => void;
};

export function DocumentIcon({ name }: { name: "link" | "download" | "bin" | "back" | "file" | "more" }) {
  return <span className={`document-icon document-icon-${name}`} aria-hidden="true" />;
}

export function FolderActions({ folder, busy, onAction, className, ref, onOpenChange }: ActionsProps) {
  const id = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const origin = useRef<HTMLElement | null>(null);
  const [anchor, setAnchor] = useState<{ x: number; y: number; alignRight: boolean; focusLast: boolean } | null>(null);
  const available = shareableDocuments(folder.documents).length;
  const close = useCallback((restoreFocus = false) => {
    setAnchor(null);
    onOpenChange?.(false);
    if (restoreFocus && origin.current?.isConnected) origin.current.focus();
  }, [onOpenChange]);
  const openAt = (x: number, y: number, source: HTMLElement, alignRight = false, focusLast = false) => {
    if (busy) return;
    origin.current = source;
    setAnchor({ x, y, alignRight, focusLast });
    onOpenChange?.(true);
  };
  useImperativeHandle(ref, () => ({ openAt }));

  useLayoutEffect(() => {
    if (!anchor || !menu.current) return;
    const element = menu.current;
    const bounds = element.getBoundingClientRect();
    const left = anchor.alignRight ? anchor.x - bounds.width : anchor.x;
    element.style.left = `${Math.max(8, Math.min(left, window.innerWidth - bounds.width - 8))}px`;
    element.style.top = `${Math.max(8, Math.min(anchor.y, window.innerHeight - bounds.height - 8))}px`;
    const items = Array.from(element.querySelectorAll<HTMLButtonElement>("button:not(:disabled)"));
    (anchor.focusLast ? items.at(-1) : items[0])?.focus();
  }, [anchor]);

  useEffect(() => {
    if (!anchor) return;
    function outside(event: Event) {
      const target = event.target as Node;
      if (!menu.current?.contains(target) && !trigger.current?.contains(target)) close();
    }
    function dismiss() { close(true); }
    function scroll(event: Event) {
      if (!menu.current?.contains(event.target as Node)) close();
    }
    document.addEventListener("pointerdown", outside);
    document.addEventListener("focusin", outside);
    window.addEventListener("resize", dismiss);
    window.addEventListener("scroll", scroll, true);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("focusin", outside);
      window.removeEventListener("resize", dismiss);
      window.removeEventListener("scroll", scroll, true);
    };
  }, [anchor, close]);

  function choose(action: FolderAction) {
    close(true);
    onAction(action, folder);
  }

  return (
    <>
      <button ref={trigger} className={`folder-more-button${className ? ` ${className}` : ""}`} type="button"
        aria-label={`Actions for ${folder.label}`} aria-haspopup="menu"
        aria-expanded={Boolean(anchor)} aria-controls={anchor ? id : undefined} disabled={busy}
        onClick={(event) => {
          if (anchor) { close(true); return; }
          const rect = event.currentTarget.getBoundingClientRect();
          openAt(rect.right, rect.bottom + 6, event.currentTarget, true);
        }}
        onKeyDown={(event) => {
          if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
          event.preventDefault();
          const rect = event.currentTarget.getBoundingClientRect();
          openAt(rect.right, rect.bottom + 6, event.currentTarget, true, event.key === "ArrowUp");
        }}><DocumentIcon name="more" /></button>
      {anchor && createPortal(
        <div id={id} ref={menu} className="folder-context-menu" role="menu"
          aria-label={`${folder.label} actions`}
          style={{ left: anchor.x, top: anchor.y }}
          onContextMenu={(event) => event.preventDefault()}
          onKeyDown={(event) => {
            if (event.key === "Escape" || event.key === "Tab") {
              if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); }
              close(true);
              return;
            }
            if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
            event.preventDefault();
            const items = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>("button:not(:disabled)"));
            const index = items.indexOf(document.activeElement as HTMLButtonElement);
            const next = event.key === "Home" ? 0 : event.key === "End" ? items.length - 1
              : (index + (event.key === "ArrowDown" ? 1 : -1) + items.length) % items.length;
            items[next]?.focus();
          }}>
          <button type="button" role="menuitem" tabIndex={-1} disabled={busy || !available}
            onClick={() => choose("copy")}>
            <Image className="folder-context-menu-icon" src="/folder-menu-link.svg" alt="" width={24} height={24} aria-hidden="true" />
            <span>Copy link</span>
          </button>
          <button type="button" role="menuitem" tabIndex={-1} disabled={busy || !available || !temporaryShareEnabled}
            onClick={() => choose("qr")}>
            <svg className="folder-context-menu-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M4 4h6v6H4V4Zm2 2v2h2V6H6Zm8-2h6v6h-6V4Zm2 2v2h2V6h-2ZM4 14h6v6H4v-6Zm2 2v2h2v-2H6Zm8-2h2v2h-2v-2Zm4 0h2v4h-2v-4Zm-4 4h4v2h-4v-2Z" fill="currentColor" />
            </svg>
            <span>QR & short link</span>
          </button>
          <button type="button" role="menuitem" tabIndex={-1} disabled={busy || !available}
            onClick={() => choose("download")}>
            <Image className="folder-context-menu-icon" src="/folder-menu-download.svg" alt="" width={24} height={24} aria-hidden="true" />
            <span>Download</span>
          </button>
          <button className="danger-action" type="button" role="menuitem" tabIndex={-1} disabled={busy}
            onClick={() => choose("delete")}>
            <Image className="folder-context-menu-icon" src="/delete-bin.svg" alt="" width={24} height={24} aria-hidden="true" />
            <span>Delete all</span>
          </button>
        </div>, document.body,
      )}
    </>
  );
}

export function FolderCard({ folder, busy, onOpen, onAction }: Omit<ActionsProps, "className" | "ref" | "onOpenChange"> & {
  onOpen: (folder: FolderViewItem) => void;
}) {
  const actions = useRef<ActionsHandle>(null);
  const button = useRef<HTMLButtonElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const start = useRef({ x: 0, y: 0 });
  const longPressed = useRef(false);
  const [selected, setSelected] = useState(false);
  const cancel = useCallback(() => {
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = null;
  }, []);
  useEffect(() => {
    window.addEventListener("scroll", cancel, true);
    return () => { cancel(); window.removeEventListener("scroll", cancel, true); };
  }, [cancel]);

  function pointerDown(event: PointerEvent<HTMLButtonElement>) {
    cancel();
    longPressed.current = false;
    if (busy || event.pointerType === "mouse" || !event.isPrimary) return;
    start.current = { x: event.clientX, y: event.clientY };
    timer.current = setTimeout(() => {
      if (!button.current) return;
      longPressed.current = true;
      actions.current?.openAt(start.current.x, start.current.y, button.current);
    }, 550);
  }

  return (
    <article className={`document-folder-tile ${selected ? "folder-selected" : ""}`}
      onContextMenu={(event) => {
        event.preventDefault();
        if (timer.current !== null) longPressed.current = true;
        cancel();
        if (button.current) {
          const rect = button.current.getBoundingClientRect();
          actions.current?.openAt(event.clientX || rect.left, event.clientY || rect.bottom, button.current);
        }
      }}>
      <button ref={button} className="document-folder-button" type="button"
        aria-label={`Open ${folder.label}, ${documentCount(folder.documents.length)}`}
        title={folder.label} onPointerDown={pointerDown} onPointerUp={cancel}
        onPointerCancel={cancel} onPointerLeave={cancel}
        onPointerMove={(event) => {
          if (Math.hypot(event.clientX - start.current.x, event.clientY - start.current.y) > 8) cancel();
        }}
        onKeyDown={(event) => {
          if (event.key === "ContextMenu" || (event.shiftKey && event.key === "F10")) {
            event.preventDefault();
            const rect = event.currentTarget.getBoundingClientRect();
            actions.current?.openAt(rect.left, rect.bottom, event.currentTarget);
          }
        }}
        onClick={() => {
          if (longPressed.current) { longPressed.current = false; return; }
          onOpen(folder);
        }}>
        <Image className="folder-art" src="/folder.svg" alt="" width={204} height={152} draggable={false} />
        <strong className="folder-tile-label">{folder.label}</strong>
        <span className="folder-tile-meta">{documentCount(folder.documents.length)}</span>
      </button>
      <FolderActions ref={actions} folder={folder} busy={busy} temporaryShareEnabled={temporaryShareEnabled} onAction={onAction} onOpenChange={setSelected} />
    </article>
  );
}
