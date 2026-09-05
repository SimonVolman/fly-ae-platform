"use client";

import AwsS3, { type AwsS3Part } from "@uppy/aws-s3";
import Uppy from "@uppy/core";
import Image from "next/image";
import Link from "next/link";
import {
  ChangeEvent,
  DragEvent,
  FormEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { apiRequestError, type ApiProblem } from "./api-error";
import { Brand } from "./components/Brand";
import { MaintenancePage } from "./components/MaintenancePage";
import { PRIVACY_VERSION, TERMS_VERSION } from "./legal";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080/api/v1";
const AUTHENTICATED_MAX_FILE_SIZE = 3 * 1024 * 1024 * 1024;
const GUEST_MAX_FILE_SIZE = 100 * 1024 * 1024;
const GENERAL_DOCUMENT_MSN = "GENERAL";
const MAINTENANCE_MODE = process.env.NEXT_PUBLIC_MAINTENANCE_MODE === "true";

type Category = {
  id: string;
  code: string;
  name: string;
};

type IdentifierField = {
  label: string;
  placeholder: string;
  helper: string;
};

const IDENTIFIER_FIELDS: Record<string, IdentifierField> = {
  AIRCRAFT: {
    label: "MSN",
    placeholder: "34567",
    helper: "Examples: 34567, 10000, 208B-1234, RB-00123, ACFT/4567",
  },
  APU: {
    label: "S/N",
    placeholder: "P-123456",
    helper: "Examples: P-123456, APU12345, GTCP-00127, APS3200-4589, A12345",
  },
  ENGINE: {
    label: "ESN",
    placeholder: "876543",
    helper: "Examples: 876543, CAE123456, PCE-RB1234, GE-908765, ENG/45678",
  },
  LANDING_GEAR: {
    label: "S/N",
    placeholder: "N12345",
    helper:
      "Types: NLG | LH_MLG | RH_MLG | SHIPSET. Examples: NLG — N12345; LH MLG — L-45678; RH MLG — R-45679; NLG — 2Y-2386; Complete Shipset — MSN 34567",
  },
};

const CATEGORY_CARD_IMAGES: Record<string, string> = {
  AIRCRAFT: "/category-aircraft.svg",
  APU: "/category-apu.svg",
  ENGINE: "/category-engine.svg",
  LANDING_GEAR: "/category-landing-gear.svg",
  JUST_DOCUMENT: "/category-just-document.svg",
};

const CATEGORY_CARD_CATALOG = [
  {
    id: "7b42604e-d3f8-4bb5-9480-36c451c8f141",
    code: "AIRCRAFT",
    name: "Aircraft",
  },
  {
    id: "d78f3618-37b6-4959-9346-3e34ef42f4d2",
    code: "APU",
    name: "APU",
  },
  {
    id: "e7870801-60b0-47fb-baf2-86ce800ecb1f",
    code: "ENGINE",
    name: "Engine",
  },
  {
    id: "d5a0ada0-3c80-4ea0-8188-73c5d55a6d26",
    code: "LANDING_GEAR",
    name: "Landing Gear",
  },
  {
    id: "420c86a3-3ec4-4ea2-96f7-53f8a42ef679",
    code: "JUST_DOCUMENT",
    name: "Just Document",
  },
] as const satisfies readonly Category[];

const SUPPORTED_UPLOAD_TYPES: Record<string, readonly string[]> = {
  "application/pdf": ["pdf"],
  "image/jpeg": ["jpg", "jpeg"],
  "image/png": ["png"],
  "image/gif": ["gif"],
  "image/webp": ["webp"],
  "image/heic": ["heic"],
  "image/heif": ["heif"],
  "video/mp4": ["mp4", "m4v"],
  "video/x-m4v": ["m4v"],
  "video/quicktime": ["mov"],
  "video/webm": ["webm"],
  "video/x-msvideo": ["avi"],
  "video/mpeg": ["mpeg", "mpg"],
  "application/zip": ["zip"],
  "application/x-zip-compressed": ["zip"],
  "application/x-7z-compressed": ["7z"],
  "application/vnd.rar": ["rar"],
  "application/x-rar-compressed": ["rar"],
  "application/x-tar": ["tar"],
  "application/gzip": ["gz", "tgz"],
  "application/x-gzip": ["gz", "tgz"],
  "application/x-bzip2": ["bz2", "tbz2"],
  "application/x-xz": ["xz", "txz"],
};

const SUPPORTED_UPLOAD_ACCEPT = Object.entries(SUPPORTED_UPLOAD_TYPES)
  .flatMap(([mimeType, extensions]) => [
    mimeType,
    ...extensions.map((extension) => `.${extension}`),
  ])
  .join(",");

const UPPY_ALLOWED_FILE_TYPES = SUPPORTED_UPLOAD_ACCEPT.split(",");

function supportedUploadMimeType(file: File): string | null {
  const extension = file.name.split(".").at(-1)?.toLowerCase() ?? "";
  const declaredMimeType = file.type.toLowerCase();

  if (
    declaredMimeType &&
    SUPPORTED_UPLOAD_TYPES[declaredMimeType]?.includes(extension)
  ) {
    return declaredMimeType;
  }

  if (declaredMimeType && declaredMimeType !== "application/octet-stream") return null;

  return (
    Object.entries(SUPPORTED_UPLOAD_TYPES).find(([, extensions]) =>
      extensions.includes(extension),
    )?.[0] ?? null
  );
}

type DocumentStatus =
  | "CREATED"
  | "UPLOADING"
  | "PENDING"
  | "PROCESSING"
  | "APPROVED"
  | "REJECTED"
  | "FAILED"
  | "DELETED";

type FlyDocument = {
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

type Session = {
  accessToken: string;
  expiresAt: string;
  user: {
    id: string;
    email: string | null;
    telegramUsername: string | null;
    displayName: string;
    authenticationMethod: "EMAIL" | "TELEGRAM";
  };
};

type AuthenticationMethod = "EMAIL" | "TELEGRAM";

type OtpDeliveryOptions = {
  emailEnabled: boolean;
  telegramEnabled: boolean;
};

type TelegramLoginAccepted = {
  requestId: string;
  telegramStartUrl: string;
  expiresAt: string;
};

type GuestSession = {
  accessToken: string;
  expiresAt: string;
  maxFileSizeBytes: number;
};

type UploadMeta = {
  documentId: string;
};

type UploadBody = {
  location?: string;
};

type ActiveUpload = {
  document: FlyDocument;
  accessToken: string;
};

type GuestDocumentClaim = {
  documentId: string;
  guestAccessToken: string;
};

type UploadState =
  | "idle"
  | "ready"
  | "preparing"
  | "uploading"
  | "processing"
  | "approved"
  | "failed";

type WorkflowStep = 1 | 2 | 3;

type DocumentFolder = {
  key: string;
  category: Category;
  msn: string;
  documents: FlyDocument[];
};

type CategoryFolder = {
  key: string;
  category: Category;
  folders: DocumentFolder[];
  documents: FlyDocument[];
};

type FolderViewItem = {
  key: string;
  label: string;
  description: string;
  documents: FlyDocument[];
  categoryId: string;
  folderKey: string | null;
};

async function api<T>(
  path: string,
  options: RequestInit = {},
  accessToken?: string,
): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...options.headers,
    },
  });

  if (!response.ok) {
    const problem = (await response.json().catch(() => ({}))) as ApiProblem;
    throw apiRequestError(response, problem);
  }
  if (response.status === 204) {
    return undefined as T;
  }
  const responseText = await response.text();
  return (responseText ? JSON.parse(responseText) : undefined) as T;
}

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.ceil(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function statusLabel(status: DocumentStatus) {
  const labels: Record<DocumentStatus, string> = {
    CREATED: "Ready to upload",
    UPLOADING: "Uploading",
    PENDING: "Pending",
    PROCESSING: "Processing",
    APPROVED: "Approved",
    REJECTED: "Rejected",
    FAILED: "Failed",
    DELETED: "Deleted",
  };
  return labels[status];
}

function isJustDocument(category?: Category) {
  return category?.code === "JUST_DOCUMENT";
}

function identifierField(category?: Category) {
  return IDENTIFIER_FIELDS[category?.code ?? ""] ?? IDENTIFIER_FIELDS.AIRCRAFT;
}

function groupDocumentsIntoFolders(documents: FlyDocument[]) {
  const folders = new Map<string, DocumentFolder>();

  documents.forEach((document) => {
    const key = `${document.category.id}:${document.msn}`;
    const folder = folders.get(key);

    if (folder) {
      folder.documents.push(document);
      return;
    }

    folders.set(key, {
      key,
      category: document.category,
      msn: document.msn,
      documents: [document],
    });
  });

  return Array.from(folders.values());
}

function groupFoldersIntoCategories(folders: DocumentFolder[]) {
  const categories = new Map<string, CategoryFolder>();

  folders.forEach((folder) => {
    const categoryFolder = categories.get(folder.category.id);

    if (categoryFolder) {
      categoryFolder.folders.push(folder);
      categoryFolder.documents.push(...folder.documents);
      return;
    }

    categories.set(folder.category.id, {
      key: `category:${folder.category.id}`,
      category: folder.category,
      folders: [folder],
      documents: [...folder.documents],
    });
  });

  return Array.from(categories.values()).sort((left, right) => {
    const leftIndex = CATEGORY_CARD_CATALOG.findIndex(
      (category) => category.code === left.category.code,
    );
    const rightIndex = CATEGORY_CARD_CATALOG.findIndex(
      (category) => category.code === right.category.code,
    );
    return leftIndex - rightIndex;
  });
}

function HomeContent() {
  const [categories, setCategories] = useState<Category[]>(() => [
    ...CATEGORY_CARD_CATALOG,
  ]);
  const [categoryId, setCategoryId] = useState<string>(
    CATEGORY_CARD_CATALOG[0].id,
  );
  const [msn, setMsn] = useState("");
  const [session, setSession] = useState<Session | null>(null);
  const [documents, setDocuments] = useState<FlyDocument[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploadState, setUploadState] = useState<UploadState>("idle");
  const [workflowStep, setWorkflowStep] = useState<WorkflowStep>(1);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [activeUploads, setActiveUploads] = useState<ActiveUpload[]>([]);
  const [pendingGuestClaim, setPendingGuestClaim] =
    useState<GuestDocumentClaim | null>(null);
  const [claimBusyDocumentId, setClaimBusyDocumentId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [authError, setAuthError] = useState("");
  const [authOpen, setAuthOpen] = useState(false);
  const [authStep, setAuthStep] = useState<"method" | "code">("method");
  const [email, setEmail] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [authenticationMethod, setAuthenticationMethod] =
    useState<AuthenticationMethod>("EMAIL");
  const [telegramEnabled, setTelegramEnabled] = useState(false);
  const [telegramRequestId, setTelegramRequestId] = useState("");
  const [telegramStartUrl, setTelegramStartUrl] = useState("");
  const [acceptedLegal, setAcceptedLegal] = useState(false);
  const [acceptedGuestLegal, setAcceptedGuestLegal] = useState(false);
  const [authBusy, setAuthBusy] = useState(false);
  const [showDocuments, setShowDocuments] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [openCategoryId, setOpenCategoryId] = useState<string | null>(null);
  const [openFolderKey, setOpenFolderKey] = useState<string | null>(null);
  const [folderMenuKey, setFolderMenuKey] = useState<string | null>(null);
  const [selectedFolderKey, setSelectedFolderKey] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const stepTwo = useRef<HTMLElement>(null);
  const stepThree = useRef<HTMLElement>(null);
  const folderLongPressTimer = useRef<number | null>(null);
  const folderLongPressActivated = useRef(false);

  const loadDocuments = useCallback(async (currentSession: Session) => {
    try {
      const result = await api<FlyDocument[]>(
        "/documents",
        {},
        currentSession.accessToken,
      );
      setDocuments(result);
    } catch (requestError) {
      setError((requestError as Error).message);
    }
  }, []);

  useEffect(() => {
    void api<Category[]>("/categories")
      .then((result) => {
        setCategories(result);
        setCategoryId((current) =>
          result.some((category) => category.id === current)
            ? current
            : result[0]?.id || "",
        );
      })
      .catch((requestError: Error) => setError(requestError.message));

    void api<OtpDeliveryOptions>("/auth/otp/options")
      .then((options) => setTelegramEnabled(options.telegramEnabled))
      .catch(() => setTelegramEnabled(false));

    const sessionTimer = window.setTimeout(() => {
      const stored = window.sessionStorage.getItem("flyae:session");
      if (!stored) return;
      try {
        const parsed = JSON.parse(stored) as Session;
        if (new Date(parsed.expiresAt).getTime() > Date.now()) {
          setSession(parsed);
          void loadDocuments(parsed);
        } else {
          window.sessionStorage.removeItem("flyae:session");
        }
      } catch {
        window.sessionStorage.removeItem("flyae:session");
      }
    }, 0);

    return () => window.clearTimeout(sessionTimer);
  }, [loadDocuments]);

  function continueToUpload() {
    setError("");
    if (!categoryId || (!isJustDocument(selectedCategory) && !msn.trim())) {
      setError(
        `Select a document category and enter the ${identifierField(selectedCategory).label}.`,
      );
      return;
    }
    setUploadState(selectedFiles.length ? "ready" : "idle");
    setWorkflowStep(2);
    if (!window.matchMedia("(min-width: 1100px)").matches) {
      window.setTimeout(() => stepTwo.current?.scrollIntoView({ block: "nearest" }), 0);
    }
  }

  async function requestOtp(event: FormEvent) {
    event.preventDefault();
    setAuthBusy(true);
    setAuthError("");
    try {
      if (authenticationMethod === "TELEGRAM") {
        const accepted = await api<TelegramLoginAccepted>(
          "/auth/telegram/request",
          { method: "POST" },
        );
        setTelegramRequestId(accepted.requestId);
        setTelegramStartUrl(accepted.telegramStartUrl);
      } else {
        await api<void>("/auth/otp/request", {
          method: "POST",
          body: JSON.stringify({ email }),
        });
      }
      setOtpCode("");
      setAuthStep("code");
    } catch (requestError) {
      setAuthError((requestError as Error).message);
    } finally {
      setAuthBusy(false);
    }
  }

  async function verifyOtp(event: FormEvent) {
    event.preventDefault();
    if (!acceptedLegal) return;
    setAuthBusy(true);
    setAuthError("");
    try {
      const verificationPath =
        authenticationMethod === "TELEGRAM"
          ? "/auth/telegram/verify"
          : "/auth/otp/verify";
      const verificationIdentity =
        authenticationMethod === "TELEGRAM"
          ? { requestId: telegramRequestId }
          : { email };
      const nextSession = await api<Session>(verificationPath, {
        method: "POST",
        body: JSON.stringify({
          ...verificationIdentity,
          code: otpCode,
          acceptedLegal,
          termsVersion: TERMS_VERSION,
          privacyVersion: PRIVACY_VERSION,
        }),
      });
      setSession(nextSession);
      window.sessionStorage.setItem("flyae:session", JSON.stringify(nextSession));
      if (pendingGuestClaim) {
        try {
          const claimed = await claimGuestDocument(pendingGuestClaim, nextSession);
          replaceClaimedUpload(claimed, nextSession.accessToken);
        } catch (claimError) {
          setError(
            `You are signed in, but the document could not be saved: ${(claimError as Error).message}`,
          );
        }
        setPendingGuestClaim(null);
      }
      setAuthOpen(false);
      setMobileMenuOpen(false);
      setAccountMenuOpen(false);
      setUploadState(
        pendingGuestClaim ? "approved" : selectedFiles.length ? "ready" : "idle",
      );
      await loadDocuments(nextSession);
    } catch (requestError) {
      setAuthError((requestError as Error).message);
    } finally {
      setAuthBusy(false);
    }
  }

  function selectUploadFiles(files: File[]) {
    setError("");
    if (!files.length) return;
    const unsupportedFile = files.find((file) => !supportedUploadMimeType(file));
    if (unsupportedFile) {
      setError(
        `${unsupportedFile.name} is not supported. Choose a PDF, image, video, or archive: ZIP, 7Z, RAR, TAR, GZ, BZ2, and XZ are accepted.`,
      );
      return;
    }
    const maxFileSize = session
      ? AUTHENTICATED_MAX_FILE_SIZE
      : GUEST_MAX_FILE_SIZE;
    const oversizedFile = files.find((file) => file.size > maxFileSize);
    if (oversizedFile) {
      setError(
        session
          ? `${oversizedFile.name} is larger than the 3 GB per-file limit.`
          : `${oversizedFile.name} is larger than the 100 MB per-file guest limit. Log in to upload files up to 3 GB.`,
      );
      return;
    }
    setSelectedFiles((currentFiles) => {
      const uniqueFiles = new Map(
        currentFiles.map((file) => [
          `${file.name}:${file.size}:${file.lastModified}`,
          file,
        ]),
      );
      files.forEach((file) => {
        uniqueFiles.set(`${file.name}:${file.size}:${file.lastModified}`, file);
      });
      return Array.from(uniqueFiles.values());
    });
    setUploadState("ready");
    setUploadProgress(0);
    setActiveUploads([]);
  }

  function chooseFile(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    selectUploadFiles(files);
  }

  function dropFile(event: DragEvent<HTMLButtonElement>) {
    event.preventDefault();
    selectUploadFiles(Array.from(event.dataTransfer.files));
  }

  function removeSelectedFile(index: number) {
    setSelectedFiles((currentFiles) => {
      const nextFiles = currentFiles.filter((_, fileIndex) => fileIndex !== index);
      if (!nextFiles.length) {
        setUploadState("idle");
        setAcceptedGuestLegal(false);
      }
      return nextFiles;
    });
    setUploadProgress(0);
    setActiveUploads([]);
    setError("");
  }

  async function pollUntilProcessed(
    documentId: string,
    accessToken: string,
  ): Promise<FlyDocument> {
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const document = await api<FlyDocument>(
        `/documents/${documentId}`,
        {},
        accessToken,
      );
      if (document.status === "APPROVED") return document;
      if (["FAILED", "REJECTED"].includes(document.status)) {
        return document;
      }
      await new Promise((resolve) => window.setTimeout(resolve, 500));
    }
    throw new Error("Processing is taking longer than expected. Keep this page open and retry.");
  }

  async function startUpload() {
    if (
      !selectedFiles.length ||
      !categoryId ||
      (!isJustDocument(selectedCategory) && !msn.trim())
    ) return;
    if (!session && !acceptedGuestLegal) {
      setError("Accept the Terms and Privacy Policy to upload without email.");
      return;
    }
    const maxFileSize = session
      ? AUTHENTICATED_MAX_FILE_SIZE
      : GUEST_MAX_FILE_SIZE;
    const oversizedFile = selectedFiles.find((file) => file.size > maxFileSize);
    if (oversizedFile) {
      setError(
        session
          ? `${oversizedFile.name} is larger than the 3 GB per-file limit.`
          : `${oversizedFile.name} is larger than the 100 MB per-file guest limit. Log in to upload files up to 3 GB.`,
      );
      return;
    }
    const currentSession = session;
    const unsupportedFile = selectedFiles.find((file) => !supportedUploadMimeType(file));
    if (unsupportedFile) {
      setError("Choose a supported PDF, image, video, or archive file.");
      return;
    }
    setError("");
    setUploadProgress(0);
    setUploadState("preparing");
    setWorkflowStep(2);

    const createdUploads: ActiveUpload[] = [];
    let uppy: Uppy<UploadMeta, UploadBody> | null = null;
    let uploadFinished = false;
    try {
      const currentGuestSession = currentSession
        ? null
        : await api<GuestSession>("/guest/sessions", {
            method: "POST",
            body: JSON.stringify({
              acceptedLegal: true,
              termsVersion: TERMS_VERSION,
              privacyVersion: PRIVACY_VERSION,
            }),
          });
      const accessToken =
        currentSession?.accessToken ?? currentGuestSession?.accessToken;
      if (!accessToken) throw new Error("Could not create a secure upload session.");

      for (const file of selectedFiles) {
        const uploadMimeType = supportedUploadMimeType(file);
        if (!uploadMimeType) throw new Error(`${file.name} is not a supported file type.`);
        const document = await api<FlyDocument>(
          "/documents",
          {
            method: "POST",
            body: JSON.stringify({
              categoryId,
              msn: isJustDocument(selectedCategory) ? GENERAL_DOCUMENT_MSN : msn.trim(),
              filename: file.name,
              mimeType: uploadMimeType,
              sizeBytes: file.size,
            }),
          },
          accessToken,
        );
        createdUploads.push({ document, accessToken });
      }
      setActiveUploads(createdUploads);

      uppy = new Uppy<UploadMeta, UploadBody>({
        autoProceed: false,
        allowMultipleUploadBatches: false,
        restrictions: {
          allowedFileTypes: UPPY_ALLOWED_FILE_TYPES,
          maxFileSize,
          maxNumberOfFiles: selectedFiles.length,
        },
      });

      uppy.use(AwsS3<UploadMeta, UploadBody>, {
        shouldUseMultipart: true,
        getChunkSize: () => 10 * 1024 * 1024,
        createMultipartUpload: async (file) =>
          api<{ uploadId: string; key: string }>(
            `/documents/${file.meta.documentId}/multipart`,
            { method: "POST" },
            accessToken,
          ),
        listParts: async (): Promise<AwsS3Part[]> => [],
        signPart: async (file, { uploadId, partNumber }) => {
          const signed = await api<{
            url: string;
            headers: Record<string, string>;
          }>(
            `/documents/${file.meta.documentId}/multipart/${encodeURIComponent(uploadId)}/parts/${partNumber}`,
            {},
            accessToken,
          );
          return {
            method: "PUT" as const,
            url: signed.url,
            headers: signed.headers,
          };
        },
        completeMultipartUpload: async (file, { uploadId, parts }) => {
          const completed = await api<FlyDocument>(
            `/documents/${file.meta.documentId}/multipart/${encodeURIComponent(uploadId)}/complete`,
            {
              method: "POST",
              body: JSON.stringify({
                parts: parts.map((part) => ({
                  partNumber: part.PartNumber,
                  etag: part.ETag,
                })),
              }),
            },
            accessToken,
          );
          setActiveUploads((currentUploads) =>
            currentUploads.map((upload) =>
              upload.document.id === completed.id
                ? { ...upload, document: completed }
                : upload,
            ),
          );
          return { location: completed.shareUrl ?? undefined };
        },
        abortMultipartUpload: async (file, { uploadId }) => {
          if (!uploadId) return;
          await api<void>(
            `/documents/${file.meta.documentId}/multipart/${encodeURIComponent(uploadId)}`,
            { method: "DELETE" },
            accessToken,
          );
        },
      });

      uppy.on("progress", (progress) => {
        setUploadState("uploading");
        setUploadProgress(progress);
      });
      selectedFiles.forEach((file, index) => {
        const document = createdUploads[index].document;
        uppy?.addFile({
          name: file.name,
          type: document.mimeType,
          data: file,
          meta: { documentId: document.id },
        });
      });

      const result = await uppy.upload();
      uploadFinished = true;
      const successfulDocumentIds = new Set(
        result?.successful?.map((file) => file.meta.documentId) ?? [],
      );
      const failedUploads = createdUploads.filter(
        (upload) => !successfulDocumentIds.has(upload.document.id),
      );
      if (failedUploads.length) {
        await Promise.allSettled(
          failedUploads.map((upload) =>
            api<void>(
              `/documents/${upload.document.id}`,
              { method: "DELETE" },
              upload.accessToken,
            ),
          ),
        );
      }
      const successfulUploads = createdUploads.filter((upload) =>
        successfulDocumentIds.has(upload.document.id),
      );
      if (!successfulUploads.length) {
        throw result?.failed?.[0]?.error ?? new Error("Upload failed.");
      }
      setUploadProgress(100);
      setUploadState("processing");
      const processedDocuments = await Promise.all(
        successfulUploads.map((upload) =>
          pollUntilProcessed(upload.document.id, upload.accessToken),
        ),
      );
      const processedUploads = processedDocuments.map((document) => ({
        document,
        accessToken,
      }));
      setActiveUploads(processedUploads);
      if (currentSession) await loadDocuments(currentSession);

      const approvedUploads = processedUploads.filter(
        (upload) => upload.document.status === "APPROVED" && upload.document.shareUrl,
      );
      if (!approvedUploads.length) {
        setUploadState("failed");
        setError("The files were uploaded but could not be approved.");
        return;
      }
      setUploadState("approved");
      setWorkflowStep(3);
      if (approvedUploads.length < selectedFiles.length) {
        setError(
          `${approvedUploads.length} of ${selectedFiles.length} files were approved. Files that failed verification were not shared.`,
        );
      }
      if (!window.matchMedia("(min-width: 1100px)").matches) {
        window.setTimeout(() => stepThree.current?.scrollIntoView({ block: "nearest" }), 0);
      }
    } catch (requestError) {
      if (!uploadFinished && createdUploads.length) {
        await Promise.allSettled(
          createdUploads.map((upload) =>
            api<void>(
              `/documents/${upload.document.id}`,
              { method: "DELETE" },
              upload.accessToken,
            ),
          ),
        );
      }
      setUploadState("failed");
      setError((requestError as Error).message);
    } finally {
      uppy?.destroy();
    }
  }

  async function deleteDocument(documentId: string) {
    if (!session || !window.confirm("Delete this item and its uploaded file?")) {
      return;
    }
    setError("");
    try {
      await api<void>(
        `/documents/${documentId}`,
        { method: "DELETE" },
        session.accessToken,
      );
      setActiveUploads((currentUploads) =>
        currentUploads.filter((upload) => upload.document.id !== documentId),
      );
      await loadDocuments(session);
    } catch (requestError) {
      setError((requestError as Error).message);
    }
  }

  async function deleteActiveDocument(documentId: string) {
    const activeUpload = activeUploads.find(
      (upload) => upload.document.id === documentId,
    );
    if (
      !activeUpload ||
      !window.confirm("Delete this item and its uploaded file?")
    ) {
      return;
    }
    setError("");
    try {
      await api<void>(
        `/documents/${documentId}`,
        { method: "DELETE" },
        activeUpload.accessToken,
      );
      const remainingUploads = activeUploads.filter(
        (upload) => upload.document.id !== documentId,
      );
      setActiveUploads(remainingUploads);
      if (!remainingUploads.length) {
        setSelectedFiles([]);
        setUploadState("idle");
        setWorkflowStep(1);
      }
      if (session) await loadDocuments(session);
    } catch (requestError) {
      setError((requestError as Error).message);
    }
  }

  async function copyShareLink(link: string) {
    try {
      await navigator.clipboard.writeText(link);
    } catch {
      setError("Copy failed. Select the link manually.");
    }
  }

  async function claimGuestDocument(
    claim: GuestDocumentClaim,
    currentSession: Session,
  ): Promise<FlyDocument> {
    return api<FlyDocument>(
      `/documents/${claim.documentId}/claim`,
      {
        method: "POST",
        body: JSON.stringify({ guestAccessToken: claim.guestAccessToken }),
      },
      currentSession.accessToken,
    );
  }

  function replaceClaimedUpload(document: FlyDocument, accessToken: string) {
    setActiveUploads((currentUploads) =>
      currentUploads.map((upload) =>
        upload.document.id === document.id
          ? { document, accessToken }
          : upload,
      ),
    );
  }

  async function saveGuestUpload(upload: ActiveUpload) {
    const claim = {
      documentId: upload.document.id,
      guestAccessToken: upload.accessToken,
    };
    if (!session) {
      setPendingGuestClaim(claim);
      prepareAuthDialog();
      return;
    }

    setClaimBusyDocumentId(upload.document.id);
    setError("");
    try {
      const claimed = await claimGuestDocument(claim, session);
      replaceClaimedUpload(claimed, session.accessToken);
      await loadDocuments(session);
    } catch (claimError) {
      setError((claimError as Error).message);
    } finally {
      setClaimBusyDocumentId(null);
    }
  }

  async function copyFolderLinks(folderDocuments: FlyDocument[]) {
    const links = folderDocuments.flatMap((document) =>
      document.shareUrl ? [document.shareUrl] : [],
    );
    setFolderMenuKey(null);
    setSelectedFolderKey(null);
    if (!links.length) {
      setError("This folder does not have any approved share links yet.");
      return;
    }
    await copyShareLink(links.join("\n"));
  }

  async function downloadFolderDocuments(folderDocuments: FlyDocument[]) {
    const links = folderDocuments.flatMap((document) =>
      document.shareUrl ? [document.shareUrl] : [],
    );
    setFolderMenuKey(null);
    setSelectedFolderKey(null);
    if (!links.length) {
      setError("This folder does not have any approved documents to download yet.");
      return;
    }

    setError("");
    try {
      const downloads = await Promise.all(
        links.map(async (link) => {
          const token = new URL(link, window.location.origin).pathname
            .split("/")
            .filter(Boolean)
            .at(-1);
          if (!token) throw new Error("The document share link is invalid.");
          return api<{ downloadUrl: string }>(
            `/shares/${encodeURIComponent(decodeURIComponent(token))}`,
          );
        }),
      );

      downloads.forEach(({ downloadUrl }) => {
        const downloadLink = document.createElement("a");
        downloadLink.href = downloadUrl;
        downloadLink.target = "_blank";
        downloadLink.rel = "noopener noreferrer";
        document.body.appendChild(downloadLink);
        downloadLink.click();
        downloadLink.remove();
      });
    } catch (requestError) {
      setError((requestError as Error).message);
    }
  }

  async function deleteFolderDocuments(folderDocuments: FlyDocument[]) {
    if (
      !session ||
      !window.confirm(
        `Delete all ${folderDocuments.length} ${folderDocuments.length === 1 ? "document" : "documents"} in this folder?`,
      )
    ) {
      return;
    }

    setError("");
    setFolderMenuKey(null);
    setSelectedFolderKey(null);
    try {
      await Promise.all(
        folderDocuments.map((document) =>
          api<void>(
            `/documents/${document.id}`,
            { method: "DELETE" },
            session.accessToken,
          ),
        ),
      );
      setOpenFolderKey(null);
      await loadDocuments(session);
    } catch (requestError) {
      setError((requestError as Error).message);
    }
  }

  function startFolderLongPress(folderKey: string) {
    if (!window.matchMedia("(max-width: 820px)").matches) return;
    if (folderLongPressTimer.current !== null) {
      window.clearTimeout(folderLongPressTimer.current);
    }
    folderLongPressActivated.current = false;
    folderLongPressTimer.current = window.setTimeout(() => {
      folderLongPressActivated.current = true;
      setSelectedFolderKey(folderKey);
      setFolderMenuKey(null);
    }, 550);
  }

  function cancelFolderLongPress() {
    if (folderLongPressTimer.current !== null) {
      window.clearTimeout(folderLongPressTimer.current);
      folderLongPressTimer.current = null;
    }
  }

  function openFolderItem(item: FolderViewItem) {
    if (folderLongPressActivated.current) {
      folderLongPressActivated.current = false;
      return;
    }
    setFolderMenuKey(null);
    setSelectedFolderKey(null);
    if (item.folderKey) {
      setOpenFolderKey(item.folderKey);
      return;
    }
    setOpenCategoryId(item.categoryId);
  }

  function resetUploadFlow() {
    setMsn("");
    setSelectedFiles([]);
    setUploadState("idle");
    setUploadProgress(0);
    setActiveUploads([]);
    setAcceptedGuestLegal(false);
    setError("");
    setWorkflowStep(1);
  }

  function showUploadView() {
    setShowDocuments(false);
    setMobileMenuOpen(false);
    setAccountMenuOpen(false);
    setFolderMenuKey(null);
    setSelectedFolderKey(null);
  }

  function showDocumentsView() {
    setShowDocuments(true);
    setMobileMenuOpen(false);
    setAccountMenuOpen(false);
    setFolderMenuKey(null);
    setSelectedFolderKey(null);
    if (session) void loadDocuments(session);
  }

  function prepareAuthDialog() {
    setAuthStep("method");
    setAuthError("");
    setAuthenticationMethod("EMAIL");
    setOtpCode("");
    setTelegramRequestId("");
    setTelegramStartUrl("");
    setAcceptedLegal(false);
    setAuthOpen(true);
  }

  function openAuth() {
    setPendingGuestClaim(null);
    prepareAuthDialog();
  }

  function closeAuth() {
    setAuthOpen(false);
    setAuthError("");
    setPendingGuestClaim(null);
  }

  function logOut() {
    window.sessionStorage.removeItem("flyae:session");
    setSession(null);
    setDocuments([]);
    setShowDocuments(false);
    setMobileMenuOpen(false);
    setAccountMenuOpen(false);
    setOpenCategoryId(null);
    setOpenFolderKey(null);
    setFolderMenuKey(null);
    setSelectedFolderKey(null);
    setUploadState(selectedFiles.length ? "ready" : "idle");
    setWorkflowStep(1);
    setActiveUploads([]);
  }

  const selectedCategory = categories.find((category) => category.id === categoryId);
  const documentDetailsReady = Boolean(
    categoryId && (isJustDocument(selectedCategory) || msn.trim()),
  );
  const uploadBusy = ["preparing", "uploading", "processing"].includes(uploadState);
  const selectedFilesSize = selectedFiles.reduce((total, file) => total + file.size, 0);
  const approvedUploads = activeUploads.filter(
    (upload) => upload.document.status === "APPROVED" && upload.document.shareUrl,
  );
  const documentFolders = groupDocumentsIntoFolders(documents);
  const categoryFolders = groupFoldersIntoCategories(documentFolders);
  const openCategory = categoryFolders.find(
    (folder) => folder.category.id === openCategoryId,
  );
  const openFolder = documentFolders.find((folder) => folder.key === openFolderKey);
  const visibleFolderItems: FolderViewItem[] = openCategory
    ? openCategory.folders.map((folder) => ({
        key: `document:${folder.key}`,
        label: isJustDocument(folder.category) ? "General documents" : folder.msn,
        description: `${folder.documents.length} ${folder.documents.length === 1 ? "document" : "documents"}`,
        documents: folder.documents,
        categoryId: folder.category.id,
        folderKey: folder.key,
      }))
    : categoryFolders.map((folder) => ({
        key: folder.key,
        label: folder.category.name,
        description: `${folder.documents.length} ${folder.documents.length === 1 ? "document" : "documents"}`,
        documents: folder.documents,
        categoryId: folder.category.id,
        folderKey: null,
      }));
  const selectedFolder = visibleFolderItems.find(
    (folder) => folder.key === selectedFolderKey,
  );
  const userDisplayName =
    session?.user.displayName ??
    session?.user.email ??
    session?.user.telegramUsername ??
    "User";
  const userInitials = userDisplayName.replace(/^@/, "");

  return (
    <main className="product-app">
      <header className="topbar product-topbar" aria-label="Primary">
        <button className="brand-button" onClick={showUploadView}>
          <Brand />
        </button>
        <nav className="primary-nav" aria-label="Product">
          <button
            className={!showDocuments ? "nav-active" : ""}
            onClick={showUploadView}
          >
            Upload
          </button>
          <button
            className={showDocuments ? "nav-active" : ""}
            onClick={showDocumentsView}
          >
            My Documents
          </button>
        </nav>
        <div className="header-actions">
          {session ? (
            <div className="user-control">
              <button
                className="avatar user-avatar"
                type="button"
                aria-label="Open account menu"
                aria-expanded={accountMenuOpen}
                onClick={() => setAccountMenuOpen((open) => !open)}
              >
                <span className="desktop-avatar-initial">
                  {userInitials.trim().charAt(0)}
                </span>
                <span className="mobile-avatar-initial">
                  {userInitials.slice(0, 2)}
                </span>
              </button>
              {accountMenuOpen && (
                <div className="account-menu" role="menu">
                  <div className="account-menu-identity" role="none">
                    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <circle cx="12" cy="8" r="3.5" />
                      <path d="M5.5 20c.6-4 2.8-6 6.5-6s5.9 2 6.5 6" />
                    </svg>
                    <span>{userDisplayName}</span>
                  </div>
                  <button type="button" role="menuitem" onClick={logOut}>
                    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <path d="M10 5H5v14h5M14 8l4 4-4 4M8 12h10" />
                    </svg>
                    <span>Log out</span>
                  </button>
                </div>
              )}
            </div>
          ) : (
            <>
              <button className="text-button desktop-login" onClick={openAuth}>
                Log in
              </button>
              <button
                className="mobile-login-button"
                onClick={openAuth}
                aria-label="Log in"
              >
                Login
              </button>
            </>
          )}
          <button
            className="mobile-menu-button"
            onClick={() => {
              setAccountMenuOpen(false);
              setMobileMenuOpen((open) => !open);
            }}
            aria-label="Open navigation menu"
            aria-expanded={mobileMenuOpen}
          >
            <i aria-hidden="true" />
          </button>
        </div>
      </header>

      {mobileMenuOpen && (
        <div
          className="mobile-navigation-overlay"
          role="presentation"
          onMouseDown={() => setMobileMenuOpen(false)}
        >
          <aside
            className="mobile-navigation"
            role="dialog"
            aria-modal="true"
            aria-label="Navigation"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="mobile-navigation-top">
              <Brand />
              <button
                type="button"
                className="mobile-navigation-close"
                onClick={() => setMobileMenuOpen(false)}
                aria-label="Close navigation menu"
              >
                ×
              </button>
            </div>
            <nav aria-label="Mobile product navigation">
              <button
                type="button"
                className={!showDocuments ? "nav-active" : ""}
                onClick={showUploadView}
              >
                Upload
              </button>
              <button
                type="button"
                className={showDocuments ? "nav-active" : ""}
                onClick={showDocumentsView}
              >
                My Documents
              </button>
            </nav>
            {session ? (
              <div className="mobile-session">
                <span>{userDisplayName}</span>
                <button type="button" onClick={logOut}>Log out</button>
              </div>
            ) : (
              <button
                type="button"
                className="button button-primary mobile-navigation-login"
                onClick={() => {
                  setMobileMenuOpen(false);
                  openAuth();
                }}
              >
                Login
              </button>
            )}
            <nav className="mobile-navigation-legal" aria-label="Legal">
              <Link href="/terms">Terms and Conditions</Link>
              <Link href="/privacy">Privacy Policy</Link>
            </nav>
          </aside>
        </div>
      )}

      {showDocuments ? (
        <section className="documents-view" aria-labelledby="documents-title">
          <div className="app-section-heading">
            <div>
              <p className="eyebrow">
                {openFolder
                  ? openFolder.category.name
                  : openCategory
                    ? "My Documents"
                    : "Private workspace"}
              </p>
              <div className="documents-title-row">
                {(openCategory || openFolder) && (
                  <button
                    className="folder-back-button"
                    type="button"
                    aria-label="Go back"
                    onClick={() => {
                      setFolderMenuKey(null);
                      setSelectedFolderKey(null);
                      if (openFolder) {
                        setOpenFolderKey(null);
                      } else {
                        setOpenCategoryId(null);
                      }
                    }}
                  >
                    ←
                  </button>
                )}
                <h1 id="documents-title">
                  {openFolder
                    ? isJustDocument(openFolder.category)
                      ? "General documents"
                      : openFolder.msn
                    : openCategory?.category.name ?? "My Documents"}
                </h1>
              </div>
            </div>
            <button className="button button-primary" onClick={showUploadView}>
              Upload document
            </button>
          </div>

          {!session ? (
            <div className="empty-app-state">
              <h2>Log in to view your documents</h2>
              <p>My Documents is available after you sign in.</p>
              <button className="button button-primary" onClick={openAuth}>
                Log in
              </button>
            </div>
          ) : documents.length ? (
            <div
              className="documents-library desktop-documents-library"
              onClick={() => setFolderMenuKey(null)}
            >
              {openFolder ? (
                <section
                  className="folder-contents"
                  aria-label={
                    isJustDocument(openFolder.category)
                      ? openFolder.category.name
                      : `${openFolder.category.name} ${identifierField(openFolder.category).label} ${openFolder.msn}`
                  }
                >
                  <div className="folder-contents-heading">
                    <div>
                      <p className="eyebrow">{openFolder.category.name}</p>
                      <h2>
                        {isJustDocument(openFolder.category)
                          ? "General documents"
                          : `${identifierField(openFolder.category).label} ${openFolder.msn}`}
                      </h2>
                    </div>
                  </div>
                  <div className="document-table">
                    {openFolder.documents.map((document) => (
                      <article className="document-item" key={document.id}>
                        <span className="file-mark" aria-hidden="true" />
                        <div className="document-name">
                          <strong>{document.filename}</strong>
                          <span>{formatBytes(document.sizeBytes)}</span>
                        </div>
                        <span className={`document-status status-${document.status.toLowerCase()}`}>
                          <i aria-hidden="true" />
                          {statusLabel(document.status)}
                        </span>
                        <div className="document-actions">
                          {document.shareUrl && (
                            <button onClick={() => void copyShareLink(document.shareUrl!)}>
                              Copy link
                            </button>
                          )}
                          <button
                            className="danger-action"
                            onClick={() => void deleteDocument(document.id)}
                          >
                            Delete
                          </button>
                        </div>
                      </article>
                    ))}
                  </div>
                </section>
              ) : (
                <>
                  {selectedFolder && (
                    <div className="folder-selection-toolbar" role="toolbar" aria-label={`${selectedFolder.label} actions`}>
                      <strong>{selectedFolder.label}</strong>
                      <div>
                        <button type="button" aria-label="Copy folder links" onClick={() => void copyFolderLinks(selectedFolder.documents)}>↗</button>
                        <button type="button" aria-label="Download folder" onClick={() => void downloadFolderDocuments(selectedFolder.documents)}>↓</button>
                        <button type="button" aria-label="Delete all folder documents" onClick={() => void deleteFolderDocuments(selectedFolder.documents)}>⌫</button>
                        <button type="button" aria-label="Close folder actions" onClick={() => setSelectedFolderKey(null)}>×</button>
                      </div>
                    </div>
                  )}
                  <div className="document-folder-grid">
                    {visibleFolderItems.map((folder) => {
                      const isSelected = folder.key === selectedFolderKey;
                      const menuOpen = folder.key === folderMenuKey;

                      return (
                        <article
                          className={`document-folder-tile ${isSelected || menuOpen ? "folder-selected" : ""}`}
                          key={folder.key}
                          onContextMenu={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            setFolderMenuKey(folder.key);
                            setSelectedFolderKey(null);
                          }}
                        >
                          <button
                            className="document-folder-button"
                            type="button"
                            aria-haspopup="menu"
                            aria-expanded={menuOpen}
                            onPointerDown={() => startFolderLongPress(folder.key)}
                            onPointerUp={cancelFolderLongPress}
                            onPointerCancel={cancelFolderLongPress}
                            onPointerLeave={cancelFolderLongPress}
                            onClick={(event) => {
                              event.stopPropagation();
                              openFolderItem(folder);
                            }}
                          >
                            <span className="folder-art" aria-hidden="true" />
                            <strong className="folder-tile-label">{folder.label}</strong>
                            <span className="folder-tile-meta">{folder.description}</span>
                          </button>
                          <button
                            className="folder-more-button"
                            type="button"
                            aria-label={`Show actions for ${folder.label}`}
                            onClick={(event) => {
                              event.stopPropagation();
                              setSelectedFolderKey(folder.key);
                              setFolderMenuKey(null);
                            }}
                          >
                            ⋮
                          </button>
                          {menuOpen && (
                            <div className="folder-context-menu" role="menu" onClick={(event) => event.stopPropagation()}>
                              <button type="button" role="menuitem" onClick={() => void copyFolderLinks(folder.documents)}>↗ <span>Copy link</span></button>
                              <button type="button" role="menuitem" onClick={() => void downloadFolderDocuments(folder.documents)}>↓ <span>Download</span></button>
                              <button className="danger-action" type="button" role="menuitem" onClick={() => void deleteFolderDocuments(folder.documents)}>⌫ <span>Delete all</span></button>
                            </div>
                          )}
                        </article>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="empty-app-state empty-documents-state">
              <strong>No documents yet</strong>
            </div>
          )}
        </section>
      ) : (
        <section className="upload-workspace" aria-labelledby="upload-title">
          <aside className="desktop-category-sidebar" aria-label="Document details">
            <h2>Document details</h2>
            <div className="desktop-category-list">
              {CATEGORY_CARD_CATALOG.map((card) => {
                const category = categories.find((item) => item.code === card.code);
                const isSelected = category
                  ? category.id === categoryId
                  : card.code === "AIRCRAFT" && !categoryId;
                const imageSource =
                  card.code === "AIRCRAFT" && isSelected
                    ? "/category-aircraft-selected.svg"
                    : CATEGORY_CARD_IMAGES[card.code];

                if (!imageSource) return null;

                return (
                  <button
                    key={card.code}
                    type="button"
                    className={`desktop-category-card ${
                      isSelected ? "is-selected" : ""
                    } ${card.code === "AIRCRAFT" ? "is-aircraft" : ""}`}
                    aria-pressed={isSelected}
                    aria-label={card.name}
                    disabled={!category}
                    onClick={() => {
                      if (!category) return;
                      setCategoryId(category.id);
                      if (isJustDocument(category)) setMsn("");
                    }}
                  >
                    <Image
                      src={imageSource}
                      alt=""
                      width={216}
                      height={78}
                      aria-hidden="true"
                      priority={card.code === "AIRCRAFT"}
                    />
                    {isSelected && card.code !== "AIRCRAFT" && (
                      <span className="desktop-category-check" aria-hidden="true">✓</span>
                    )}
                  </button>
                );
              })}
            </div>
            <nav className="desktop-category-legal" aria-label="Legal">
              <Link href="/privacy">Privacy Policy</Link>
              <Link href="/terms">Terms and Conditions</Link>
            </nav>
          </aside>

          <div className="workspace-main">
            <div className="workspace-intro">
              <p className="eyebrow">Secure document transfer</p>
              <h1 id="upload-title">Upload an aviation file</h1>
              <p>
                Upload a PDF, image, video, or archive up to 3 GB. First upload up to 100 MB—no
                email required.
              </p>
            </div>

          <ol className="progress-steps" aria-label="Upload steps">
            <li
              className={workflowStep === 1 ? "step-current" : "step-complete"}
              aria-current={workflowStep === 1 ? "step" : undefined}
            >
              <span>{workflowStep > 1 ? "✓" : "01"}</span>
              Describe
            </li>
            <li
              className={
                workflowStep === 2
                  ? "step-current"
                  : workflowStep > 2
                    ? "step-complete"
                    : "step-locked"
              }
              aria-current={workflowStep === 2 ? "step" : undefined}
            >
              <span>{workflowStep > 2 ? "✓" : "02"}</span>
              Upload
            </li>
            <li
              className={workflowStep === 3 ? "step-current" : "step-locked"}
              aria-current={workflowStep === 3 ? "step" : undefined}
            >
              <span>03</span>
              Share
            </li>
          </ol>

          <div className="upload-layout wizard-flow">
            {workflowStep > 2 && (
              <article className="step-summary" aria-label="Document details completed">
                <span className="step-summary-number" aria-hidden="true">✓</span>
                <div>
                  <small>Step 01 complete</small>
                  <strong>
                    {selectedCategory?.name ?? "Document"}
                    {!isJustDocument(selectedCategory) &&
                      ` · ${identifierField(selectedCategory).label} ${msn}`}
                  </strong>
                </div>
              </article>
            )}

            {workflowStep < 3 && (
              <section
                className={`workflow-card wizard-panel describe-panel ${
                  workflowStep === 2 ? "step-panel-complete" : ""
                }`}
              >
                <div className="card-heading">
                  <span>01</span>
                  <div>
                    <h2>Document details</h2>
                    <p>
                      {isJustDocument(selectedCategory)
                        ? "Upload a general aviation-related document without an identifier."
                        : `Select the category and enter the ${identifierField(selectedCategory).label}.`}
                    </p>
                  </div>
                </div>

                <label className="field category-field">
                  <span>Category <i>*</i></span>
                  <select
                    aria-label="Category"
                    value={categoryId}
                    onChange={(event) => {
                      const nextCategory = categories.find(
                        (category) => category.id === event.target.value,
                      );
                      setCategoryId(event.target.value);
                      if (isJustDocument(nextCategory)) setMsn("");
                    }}
                  >
                    <option value="" disabled>
                      {categories.length ? "Select category" : "Loading categories…"}
                    </option>
                    {categories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                </label>

                {isJustDocument(selectedCategory) ? (
                  <div className="general-document-note">
                    <strong>No identifier required</strong>
                    <p>
                      You can upload a purchase order, invoice, or general data,
                      but it must be aviation-related. Anything unrelated will be
                      deleted.
                    </p>
                  </div>
                ) : (
                  <label className="field msn-field">
                    <span>{identifierField(selectedCategory).label} <i>*</i></span>
                    <input
                      value={msn}
                      onChange={(event) => setMsn(event.target.value)}
                      placeholder={identifierField(selectedCategory).placeholder}
                      maxLength={64}
                    />
                    <small className="identifier-examples">
                      {identifierField(selectedCategory).helper}
                    </small>
                  </label>
                )}

                <button className="button button-primary continue-button" onClick={continueToUpload}>
                  Continue to file upload
                </button>
              </section>
            )}

            {workflowStep > 2 && selectedFiles.length > 0 && (
              <article className="step-summary" aria-label="File upload completed">
                <span className="step-summary-number" aria-hidden="true">✓</span>
                <div>
                  <small>Step 02 complete</small>
                  <strong>
                    {selectedFiles.length} {selectedFiles.length === 1 ? "file" : "files"} ·{" "}
                    {formatBytes(selectedFilesSize)}
                  </strong>
                </div>
                <span className="summary-status">
                  {approvedUploads.length === selectedFiles.length
                    ? "Approved"
                    : `${approvedUploads.length}/${selectedFiles.length} approved`}
                </span>
              </article>
            )}

            {workflowStep < 3 && (
              <section
                className={`workflow-card wizard-panel upload-panel ${
                  workflowStep === 1 ? "step-panel-pending" : ""
                }`}
                ref={stepTwo}
              >
                <div className="card-heading">
                  <span>02</span>
                  <div>
                    <h2>File upload</h2>
                    <p>
                      PDF, image, video, or archive (ZIP, 7Z, RAR, TAR, GZ, BZ2, XZ) · maximum{" "}
                      {session ? "3 GB" : "100 MB as guest"} per file · multiple files allowed.
                    </p>
                  </div>
                </div>

                <input
                  ref={fileInput}
                  className="visually-hidden"
                  type="file"
                  multiple
                  accept={SUPPORTED_UPLOAD_ACCEPT}
                  onChange={chooseFile}
                />

                <div className="upload-drop-area">
                  <button
                    className={`app-drop-zone ${selectedFiles.length ? "file-selected" : ""}`}
                    disabled={uploadBusy}
                    onClick={() => fileInput.current?.click()}
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={dropFile}
                  >
                    <span className="upload-icon" aria-hidden="true">
                      <svg viewBox="0 0 24 24" fill="none">
                        <path d="M7 3.5h7l3 3v14H7z" />
                        <path d="M14 3.5v3h3M12 16v-6m-3 3 3-3 3 3" />
                      </svg>
                    </span>
                    <span>
                      <strong>Choose files or drag &amp; drop them here</strong>
                      <small>
                        {session ? "Maximum 3 GB per file" : "Maximum 100 MB per file"}
                      </small>
                    </span>
                  </button>

                  <div className="aviation-notice">
                    Please upload only materials related to aviation components.
                    Every file is subject to verification.
                  </div>
                </div>

                {selectedFiles.length > 0 && (
                  <div className="selected-upload-list" aria-label="Selected files">
                    {selectedFiles.map((file, index) => (
                      <div
                        className="selected-upload-row"
                        key={`${file.name}:${file.size}:${file.lastModified}`}
                      >
                        <span className="selected-check" aria-hidden="true">✓</span>
                        <span className="selected-file-icon" aria-hidden="true" />
                        <div>
                          <strong>{file.name}</strong>
                          <small>{formatBytes(file.size)}</small>
                        </div>
                        {!uploadBusy && (
                          <button
                            type="button"
                            className="remove-upload"
                            onClick={() => removeSelectedFile(index)}
                            aria-label={`Remove ${file.name}`}
                          >
                            <i aria-hidden="true" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {!session && selectedFiles.length > 0 && !uploadBusy && (
                  <div className="guest-upload-options">
                    <p>
                      Upload these files as a guest. My Documents requires sign-in.
                    </p>
                    <label className="legal-check">
                      <input
                        type="checkbox"
                        checked={acceptedGuestLegal}
                        onChange={(event) => setAcceptedGuestLegal(event.target.checked)}
                      />
                      <span>
                        I accept the{" "}
                        <Link href="/terms" target="_blank" rel="noopener noreferrer">
                          Terms
                        </Link>{" "}
                        and{" "}
                        <Link href="/privacy" target="_blank" rel="noopener noreferrer">
                          Privacy Policy
                        </Link>
                        .
                      </span>
                    </label>
                    <button
                      type="button"
                      className="guest-login-link"
                      onClick={() => {
                        openAuth();
                      }}
                    >
                      Log in to upload up to 3 GB and use My Documents
                    </button>
                  </div>
                )}

                {uploadBusy && (
                  <div className="upload-progress" aria-live="polite">
                    <div>
                      <strong>
                        {uploadState === "preparing" && "Preparing secure upload"}
                        {uploadState === "uploading" &&
                          `Uploading ${selectedFiles.length} ${selectedFiles.length === 1 ? "file" : "files"} · ${uploadProgress}%`}
                        {uploadState === "processing" && "Verifying files"}
                      </strong>
                      <span>
                        {uploadState === "processing"
                          ? "The uploaded files are being processed."
                          : "Files are sent directly to private object storage."}
                      </span>
                    </div>
                    <div className="progress-track">
                      <span
                        style={{
                          width:
                            uploadState === "processing"
                              ? "100%"
                              : `${Math.max(uploadProgress, 4)}%`,
                        }}
                      />
                    </div>
                  </div>
                )}

                {selectedFiles.length > 0 && !uploadBusy && (
                  <button
                    className="button button-primary upload-button"
                    disabled={
                      !documentDetailsReady || (!session && !acceptedGuestLegal)
                    }
                    onClick={() => void startUpload()}
                  >
                    {documentDetailsReady
                      ? selectedFiles.length === 1
                        ? "Upload securely"
                        : `Upload ${selectedFiles.length} files securely`
                      : "Complete document details to upload"}
                  </button>
                )}
              </section>
            )}

            {workflowStep === 3 && approvedUploads.length > 0 && (
              <section
                className="share-result wizard-share-result"
                aria-live="polite"
                ref={stepThree}
              >
                <div className="success-mark" aria-hidden="true">✓</div>
                <div>
                  <p className="eyebrow">Step 03 · Approved</p>
                  <h2>
                    {approvedUploads.length === 1
                      ? "Your secure link is ready"
                      : "Your secure links are ready"}
                  </h2>
                  <p>Recipients can use these links to access the approved files.</p>
                </div>
                <div className="share-result-actions">
                  <div className="share-link-list">
                    {approvedUploads.map((upload) => {
                      const { document } = upload;
                      const isGuestDocument = upload.accessToken.startsWith("gst_");
                      return (
                        <div className="share-link-item" key={document.id}>
                          <strong>{document.filename}</strong>
                          <code>{document.shareUrl}</code>
                          <div className="share-link-buttons">
                            <button
                              className="button button-success"
                              onClick={() => void copyShareLink(document.shareUrl!)}
                            >
                              Copy link
                            </button>
                            {isGuestDocument && (
                              <button
                                className="button button-primary"
                                disabled={claimBusyDocumentId === document.id}
                                onClick={() => void saveGuestUpload(upload)}
                              >
                                {claimBusyDocumentId === document.id
                                  ? "Saving…"
                                  : "Save to My Documents"}
                              </button>
                            )}
                            <button
                              className="button button-secondary"
                              onClick={() => void deleteActiveDocument(document.id)}
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <button className="button button-secondary" onClick={resetUploadFlow}>
                    Upload more files
                  </button>
                </div>
              </section>
            )}
          </div>

          {error && (
            <div className="app-error" role="alert">
              <strong>Something needs attention</strong>
              <span>{error}</span>
            </div>
          )}
          </div>
        </section>
      )}

      <section className="mission-section" aria-labelledby="mission-title">
        <div>
          <p className="eyebrow">Purpose-built for aviation</p>
          <h2 id="mission-title">Mission of fly.ae</h2>
        </div>
        <div className="mission-copy">
          <p>
            There is no product on the market today built specifically for aviation
            experts to securely store and share proprietary data. If you’re tired of
            dropping your files into boxes or relying on yet another way to transfer
            them, fly.ae gives your aviation data a place of its own.
          </p>
          <p>
            For now, fly.ae is free to use. You can store your files for up to one year
            with virtually unlimited space. We know that VBSI data can take up a lot of
            it, so you’ve come to the right place—and you won’t be disappointed.
          </p>
          <p>
            One warning: anything unrelated to flying machines—including personal
            files, entertainment videos, or pornographic content—will be deleted, and
            the associated account may be blocked. fly.ae is exclusively for aviation
            data. For everything else, please find another box—or another way to
            transfer it. Don’t overstay your welcome.
          </p>
        </div>
      </section>

      <footer className="product-footer">
        <Brand />
        <p>Secure aviation file transfer.</p>
        <nav aria-label="Project">
          <Link href="/terms">Terms</Link>
          <Link href="/privacy">Privacy</Link>
        </nav>
      </footer>

      {authOpen && (
        <div className="overlay" role="presentation" onMouseDown={closeAuth}>
          <section
            className="dialog login-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="auth-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="dialog-top">
              <Brand />
              <button className="close" onClick={closeAuth} aria-label="Close">
                ×
              </button>
            </div>

            {authError && (
              <div className="app-error auth-dialog-error" role="alert">
                <strong>
                  {authStep === "method" ? "Unable to start sign-in" : "Unable to verify the code"}
                </strong>
                <span>{authError}</span>
              </div>
            )}

            {authStep === "method" ? (
              <form onSubmit={requestOtp}>
                <h2 id="auth-title">
                  {pendingGuestClaim ? "Save to My Documents" : "Log in"}
                </h2>
                <p className="info-box">
                  {pendingGuestClaim
                    ? "Verify your email to add this guest document to My Documents without uploading it again."
                    : "Log in to keep a My Documents history and upload files up to 3 GB. Choose email or Telegram. Each method creates its own fly.ae account."}
                </p>
                {telegramEnabled && !pendingGuestClaim && (
                  <fieldset className="otp-delivery-options">
                    <legend>Sign in with</legend>
                    <div>
                      <button
                        type="button"
                        className={authenticationMethod === "EMAIL" ? "selected" : ""}
                        aria-pressed={authenticationMethod === "EMAIL"}
                        onClick={() => setAuthenticationMethod("EMAIL")}
                      >
                        <span aria-hidden="true">✉</span>
                        Email
                      </button>
                      <button
                        type="button"
                        className={authenticationMethod === "TELEGRAM" ? "selected" : ""}
                        aria-pressed={authenticationMethod === "TELEGRAM"}
                        onClick={() => setAuthenticationMethod("TELEGRAM")}
                      >
                        <span aria-hidden="true">↗</span>
                        Telegram
                      </button>
                    </div>
                  </fieldset>
                )}
                {authenticationMethod === "EMAIL" ? (
                  <label>
                    Email
                    <input
                      autoFocus
                      type="email"
                      required
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      placeholder="name@company.com"
                    />
                  </label>
                ) : (
                  <p className="code-copy">
                    No email is required. Open our bot, press Start, and it will send
                    you a six-digit code.
                  </p>
                )}
                <button
                  className="primary-button"
                  disabled={
                    authBusy ||
                    (authenticationMethod === "EMAIL" && !email.trim())
                  }
                >
                  {authBusy
                    ? "Sending…"
                    : authenticationMethod === "TELEGRAM"
                      ? "Continue with Telegram"
                      : "Get one-time code"}
                </button>
              </form>
            ) : (
              <form onSubmit={verifyOtp}>
                <button
                  type="button"
                  className="back-link"
                  onClick={() => {
                    setAuthError("");
                    setOtpCode("");
                    setAuthStep("method");
                  }}
                >
                  ← Change sign-in method
                </button>
                <h2 id="auth-title">Enter your code</h2>
                {authenticationMethod === "TELEGRAM" ? (
                  <div className="telegram-code-instructions">
                    <p className="code-copy">
                      Open the bot, press Start, then enter the code it sends you.
                    </p>
                    <a
                      className="telegram-open-button"
                      href={telegramStartUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Open Telegram bot
                    </a>
                  </div>
                ) : (
                  <p className="code-copy">
                    Enter the six-digit code sent to <strong>{email}</strong>.
                  </p>
                )}
                <label>
                  One-time code
                  <input
                    autoFocus
                    className="otp-input"
                    inputMode="numeric"
                    pattern="[0-9]{6}"
                    maxLength={6}
                    required
                    value={otpCode}
                    onChange={(event) =>
                      setOtpCode(event.target.value.replace(/\D/g, "").slice(0, 6))
                    }
                    placeholder="000000"
                  />
                </label>
                <label className="legal-check">
                  <input
                    type="checkbox"
                    checked={acceptedLegal}
                    onChange={(event) => setAcceptedLegal(event.target.checked)}
                  />
                  <span>
                    I accept the{" "}
                    <Link href="/terms" target="_blank" rel="noopener noreferrer">
                      Terms
                    </Link>{" "}
                    and{" "}
                    <Link href="/privacy" target="_blank" rel="noopener noreferrer">
                      Privacy Policy
                    </Link>
                    .
                  </span>
                </label>
                <button
                  className="primary-button"
                  disabled={authBusy || otpCode.length !== 6 || !acceptedLegal}
                >
                  {authBusy ? "Verifying…" : "Verify and continue"}
                </button>
              </form>
            )}
          </section>
        </div>
      )}
    </main>
  );
}

export default function Home() {
  return MAINTENANCE_MODE ? <MaintenancePage /> : <HomeContent />;
}
