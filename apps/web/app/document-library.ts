export type Category = { id: string; code: string; name: string };

export type DocumentStatus =
  | "CREATED" | "UPLOADING" | "PENDING" | "PROCESSING"
  | "APPROVED" | "REJECTED" | "FAILED" | "DELETED";

export type FlyDocument = {
  id: string;
  category: Category;
  msn: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  status: DocumentStatus;
  shareUrl: string | null;
  createdAt: string;
};

export type DocumentFolder = {
  key: string;
  category: Category;
  msn: string;
  documents: FlyDocument[];
};

export type CategoryFolder = {
  key: string;
  category: Category;
  folders: DocumentFolder[];
  documents: FlyDocument[];
};

export type FolderViewItem = {
  key: string;
  label: string;
  documents: FlyDocument[];
  categoryId: string;
  folderKey: string | null;
};

const CATEGORY_ORDER = ["AIRCRAFT", "APU", "ENGINE", "LANDING_GEAR", "JUST_DOCUMENT"];

export function documentCount(count: number) {
  return `${count} ${count === 1 ? "document" : "documents"}`;
}

export function folderLabel(folder: DocumentFolder) {
  return folder.category.code === "JUST_DOCUMENT" ? "General documents" : folder.msn;
}

export function groupDocumentsIntoFolders(documents: FlyDocument[]) {
  const folders = new Map<string, DocumentFolder>();
  for (const document of documents) {
    if (document.status === "DELETED") continue;
    const key = `${document.category.id}:${document.msn}`;
    const folder = folders.get(key);
    if (folder) folder.documents.push(document);
    else folders.set(key, {
      key, category: document.category, msn: document.msn, documents: [document],
    });
  }
  return Array.from(folders.values());
}

export function groupFoldersIntoCategories(
  folders: DocumentFolder[],
  availableCategories: Category[] = [],
) {
  const categories = new Map<string, CategoryFolder>();
  for (const folder of folders) {
    const category = categories.get(folder.category.id);
    if (category) {
      category.folders.push(folder);
      category.documents.push(...folder.documents);
    } else categories.set(folder.category.id, {
      key: `category:${folder.category.id}`, category: folder.category,
      folders: [folder], documents: [...folder.documents],
    });
  }
  for (const category of availableCategories) {
    if (!categories.has(category.id)) {
      categories.set(category.id, {
        key: "category:" + category.id, category, folders: [], documents: [],
      });
    }
  }
  return Array.from(categories.values()).sort((left, right) => {
    const rank = (code: string) => {
      const index = CATEGORY_ORDER.indexOf(code);
      return index === -1 ? CATEGORY_ORDER.length : index;
    };
    return rank(left.category.code) - rank(right.category.code);
  });
}

export function folderItem(folder: DocumentFolder): FolderViewItem {
  return {
    key: `document:${folder.key}`, label: folderLabel(folder),
    documents: folder.documents, categoryId: folder.category.id, folderKey: folder.key,
  };
}

export function categoryItem(folder: CategoryFolder): FolderViewItem {
  return {
    key: folder.key, label: folder.category.name, documents: folder.documents,
    categoryId: folder.category.id, folderKey: null,
  };
}

export function resolveFolderLocation(
  categories: CategoryFolder[], categoryId: string | null, folderKey: string | null,
) {
  const category = categories.find((item) => item.category.id === categoryId);
  return { category, folder: category?.folders.find((item) => item.key === folderKey) };
}

export function shareableDocuments(documents: FlyDocument[]) {
  return documents.filter((document) => document.status === "APPROVED" && document.shareUrl);
}

export function folderShareText(folder: Pick<FolderViewItem, "label" | "documents">) {
  const documents = shareableDocuments(folder.documents);
  return [
    `${folder.label} — ${documentCount(documents.length)}`,
    ...documents.flatMap((document, index) => [
      "",
      `${index + 1}. ${document.filename}`,
      document.shareUrl!.trim(),
    ]),
  ].join("\n");
}
