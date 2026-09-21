"use client";

import Image from "next/image";
import { useId } from "react";
import { documentCount, folderLabel, type CategoryFolder } from "../document-library";

type Props = {
  categories: CategoryFolder[];
  active: boolean;
  categoryId: string | null;
  folderKey: string | null;
  expanded: string[];
  onToggle: (id: string) => void;
  onNavigate: (categoryId: string | null, folderKey: string | null) => void;
};

const CATEGORY_ILLUSTRATIONS: Record<string, { src: string; width: number; height: number }> = {
  AIRCRAFT: { src: "/documents-category-aircraft.svg", width: 264, height: 103 },
  APU: { src: "/documents-category-apu.svg", width: 166, height: 124 },
  ENGINE: { src: "/documents-category-engine.svg", width: 162, height: 141 },
  LANDING_GEAR: { src: "/documents-category-landing-gear.svg", width: 146, height: 121 },
  JUST_DOCUMENT: { src: "/documents-category-just-document.svg", width: 67, height: 83 },
};

export function DocumentsNavigation({
  categories, active, categoryId, folderKey, expanded, onToggle, onNavigate,
}: Props) {
  const id = useId();
  const rootOpen = expanded.includes("root");
  return (
    <nav className="documents-navigation" aria-label="Document folders">
      <div className={`documents-navigation-row ${active && !categoryId ? "is-current" : ""}`}>
        <button type="button" className="documents-disclosure"
          aria-label={`${rootOpen ? "Collapse" : "Expand"} My Documents`}
          aria-expanded={rootOpen} aria-controls={`${id}-categories`}
          onClick={() => onToggle("root")}>
          <span className="navigation-chevron" aria-hidden="true" />
        </button>
        <button type="button" className="documents-navigation-label"
          aria-current={active && !categoryId ? "page" : undefined}
          onClick={() => onNavigate(null, null)}>My Documents</button>
      </div>
      <ul id={`${id}-categories`} hidden={!rootOpen}>
        {categories.map((category, index) => {
          const selected = active && (
            category.category.id === categoryId ||
            (!categoryId && category.category.code === "AIRCRAFT")
          );
          const open = expanded.includes(category.category.id);
          const illustration = CATEGORY_ILLUSTRATIONS[category.category.code];
          return (
            <li key={category.key}>
              <div
                className={`documents-navigation-row ${selected ? "is-ancestor" : ""} ${selected && !folderKey ? "is-current" : ""}`}
                data-category-code={category.category.code}
              >
                {illustration && (
                  <Image
                    className="documents-category-illustration"
                    src={illustration.src}
                    alt=""
                    width={illustration.width}
                    height={illustration.height}
                    aria-hidden="true"
                  />
                )}
                <button type="button" className="documents-disclosure"
                  aria-label={`${open ? "Collapse" : "Expand"} ${category.category.name}`}
                  aria-expanded={open} aria-controls={`${id}-${index}`}
                  onClick={() => onToggle(category.category.id)}>
                  <span className="navigation-chevron" aria-hidden="true" />
                </button>
                <button type="button" className="documents-navigation-label"
                  aria-current={selected && !folderKey ? "page" : undefined}
                  title={`${category.category.name} · ${documentCount(category.documents.length)}`}
                  onClick={() => onNavigate(category.category.id, null)}>
                  <span>{category.category.name}</span>
                  <small>{documentCount(category.documents.length)}</small>
                </button>
              </div>
              <ul id={`${id}-${index}`} hidden={!open}>
                {category.folders.map((folder) => (
                  <li key={folder.key}>
                    <button type="button"
                      className={`documents-navigation-folder ${selected && folderKey === folder.key ? "is-current" : ""}`}
                      aria-current={selected && folderKey === folder.key ? "page" : undefined}
                      title={`${folderLabel(folder)} · ${documentCount(folder.documents.length)}`}
                      onClick={() => onNavigate(category.category.id, folder.key)}>
                      <span className="document-icon navigation-folder-icon" aria-hidden="true" />
                      <span>{folderLabel(folder)}</span>
                      <small aria-label={documentCount(folder.documents.length)}>{folder.documents.length}</small>
                    </button>
                  </li>
                ))}
              </ul>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
