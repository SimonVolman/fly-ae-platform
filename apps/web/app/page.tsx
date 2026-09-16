"use client";

import type { AwsS3Part } from "@uppy/aws-s3";
import type Uppy from "@uppy/core";
import Image from "next/image";
import Link from "next/link";
import { QRCodeSVG } from "qrcode.react";
import {
  ChangeEvent,
  DragEvent,
  FormEvent,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { apiRequestError, type ApiProblem } from "./api-error";
import { Brand } from "./components/Brand";
import { MaintenancePage } from "./components/MaintenancePage";
import { Mission } from "./components/Mission";
import { FilePrivacy } from "./components/FilePrivacy";
import { DocumentsNavigation } from "./components/DocumentsNavigation";
import { DocumentIcon, FolderActions, FolderCard, type FolderAction } from "./components/Folder";
import {
  categoryItem, documentCount, folderItem, folderLabel, groupDocumentsIntoFolders,
  groupFoldersIntoCategories, resolveFolderLocation, shareableDocuments, folderShareText,
  type Category, type DocumentStatus, type FlyDocument, type FolderViewItem,
} from "./document-library";
import { PRIVACY_VERSION, TERMS_VERSION } from "./legal";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080/api/v1";
const DEFAULT_AUTHENTICATED_MAX_FILE_SIZE = 3 * 1024 * 1024 * 1024;
const configuredAuthenticatedMaxFileSize = Number(
  process.env.NEXT_PUBLIC_AUTHENTICATED_MAX_FILE_SIZE_BYTES,
);
const AUTHENTICATED_MAX_FILE_SIZE =
  Number.isSafeInteger(configuredAuthenticatedMaxFileSize) &&
  configuredAuthenticatedMaxFileSize > 0
    ? configuredAuthenticatedMaxFileSize
    : DEFAULT_AUTHENTICATED_MAX_FILE_SIZE;
const AUTHENTICATED_MAX_FILE_SIZE_LABEL = `${
  AUTHENTICATED_MAX_FILE_SIZE / (1024 * 1024 * 1024)
} GB`;
const GUEST_MAX_FILE_SIZE = 100 * 1024 * 1024;
const UPLOAD_PART_STALL_TIMEOUT_MS = 90 * 1000;
const UPLOAD_PART_RETRY_DELAYS = [0, 1_000, 5_000, 15_000, 30_000];
const MOBILE_SAFE_UPLOAD_CONCURRENCY = 2;
const DEFAULT_UPLOAD_CONCURRENCY = 6;
const GENERAL_DOCUMENT_MSN = "GENERAL";
const MAINTENANCE_MODE = process.env.NEXT_PUBLIC_MAINTENANCE_MODE === "true";
const TEMPORARY_SHARE_ENABLED =
  process.env.NODE_ENV === "development" ||
  process.env.NEXT_PUBLIC_TEMPORARY_SHARE_ENABLED === "true";

type TemporaryShare = {
  documentId: string;
  filename: string;
  accessToken: string;
  code: string;
  shortUrl: string;
  expiresAt: string;
};

type TemporaryShareDocument = Pick<FlyDocument, "id" | "filename">;

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

type UploadPartRequest = {
  signature: {
    url: string;
    headers?: Record<string, string>;
    method?: "PUT" | "POST";
  };
  body: Blob | FormData;
  size?: number;
  onProgress: (event: ProgressEvent<EventTarget>) => void;
  onComplete: (etag: string) => void;
  signal?: AbortSignal;
};

/**
 * Android browsers can leave an XMLHttpRequest open indefinitely after a radio
 * handoff. Uppy retries failed parts, but an XHR that never resolves is not a
 * failure. Treat an absence of upload progress as a retriable connection error.
 */
function uploadPartWithStallRecovery(
  { signature, body, size, onProgress, onComplete, signal }: UploadPartRequest,
  onStall: () => void,
): Promise<{ ETag: string }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    let settled = false;
    let stallTimer: ReturnType<typeof window.setTimeout> | null = null;

    const cleanup = () => {
      if (stallTimer !== null) window.clearTimeout(stallTimer);
      signal?.removeEventListener("abort", abortRequest);
    };
    const fail = (message: string, status: number) => {
      if (settled) return;
      settled = true;
      cleanup();
      const error = new Error(message) as Error & { source?: { status: number } };
      error.source = { status };
      reject(error);
    };
    const abortRequest = () => {
      if (settled) return;
      settled = true;
      cleanup();
      xhr.abort();
      reject(new DOMException("Upload cancelled", "AbortError"));
    };
    const resetStallTimer = () => {
      if (stallTimer !== null) window.clearTimeout(stallTimer);
      stallTimer = window.setTimeout(() => {
        if (settled) return;
        onStall();
        xhr.abort();
        fail("Upload connection stalled", 503);
      }, UPLOAD_PART_STALL_TIMEOUT_MS);
    };

    try {
      xhr.open(signature.method ?? "PUT", signature.url, true);
      Object.entries(signature.headers ?? {}).forEach(([name, value]) => {
        xhr.setRequestHeader(name, value);
      });
      xhr.upload.addEventListener("progress", (event) => {
        resetStallTimer();
        onProgress(event);
      });
      xhr.addEventListener("load", () => {
        if (xhr.status < 200 || xhr.status >= 300) {
          fail(
            xhr.status === 403 ? "Request has expired" : "Upload part failed",
            xhr.status || 503,
          );
          return;
        }
        const etag = xhr.getResponseHeader("ETag");
        if (!etag) {
          fail("Upload response did not include an ETag", 502);
          return;
        }
        if (settled) return;
        settled = true;
        cleanup();
        onProgress({
          loaded: size ?? (body instanceof Blob ? body.size : 0),
          lengthComputable: true,
        } as ProgressEvent<EventTarget>);
        onComplete(etag);
        resolve({ ETag: etag });
      });
      xhr.addEventListener("error", () => fail("Upload connection failed", xhr.status || 503));
      xhr.addEventListener("abort", () => {
        if (!settled) fail("Upload connection stalled", 503);
      });
      signal?.addEventListener("abort", abortRequest, { once: true });
      if (signal?.aborted) {
        abortRequest();
        return;
      }
      resetStallTimer();
      xhr.send(body);
    } catch (error) {
      fail(error instanceof Error ? error.message : "Could not start upload", 503);
    }
  });
}

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
  const [uploadRecoveryNotice, setUploadRecoveryNotice] = useState("");
  const [activeUploads, setActiveUploads] = useState<ActiveUpload[]>([]);
  const [pendingGuestClaim, setPendingGuestClaim] =
    useState<GuestDocumentClaim | null>(null);
  const [claimBusyDocumentId, setClaimBusyDocumentId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [authError, setAuthError] = useState("");
  const [authOpen, setAuthOpen] = useState(false);
  const [authStep, setAuthStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [acceptedLegal, setAcceptedLegal] = useState(false);
  const [acceptedGuestLegal, setAcceptedGuestLegal] = useState(false);
  const [authBusy, setAuthBusy] = useState(false);
  const [showDocuments, setShowDocuments] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [openCategoryId, setOpenCategoryId] = useState<string | null>(null);
  const [openFolderKey, setOpenFolderKey] = useState<string | null>(null);
  const [expandedDocumentCategories, setExpandedDocumentCategories] = useState<string[]>(["root"]);
  const [documentsLoading, setDocumentsLoading] = useState(false);
  const [documentsLoadError, setDocumentsLoadError] = useState("");
  const [folderActionBusy, setFolderActionBusy] = useState(false);
  const [documentNotice, setDocumentNotice] = useState<{ error: boolean; message: string } | null>(null);
  const [temporaryShare, setTemporaryShare] = useState<TemporaryShare | null>(null);
  const [temporaryShareBusyDocumentId, setTemporaryShareBusyDocumentId] = useState<string | null>(null);
  const [temporaryShareNow, setTemporaryShareNow] = useState(() => Date.now());
  const documentsHeading = useRef<HTMLHeadingElement>(null);
  const documentRequest = useRef(0);
  const folderActionInFlight = useRef(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const stepTwo = useRef<HTMLElement>(null);
  const stepThree = useRef<HTMLElement>(null);

  const loadDocuments = useCallback(async (currentSession: Session) => {
    if (folderActionInFlight.current) return;
    const request = ++documentRequest.current;
    setDocumentsLoading(true);
    setDocumentsLoadError("");
    try {
      const result = await api<FlyDocument[]>("/documents", {}, currentSession.accessToken);
      if (request === documentRequest.current) setDocuments(result);
    } catch (requestError) {
      if (request === documentRequest.current) setDocumentsLoadError((requestError as Error).message);
    } finally {
      if (request === documentRequest.current) setDocumentsLoading(false);
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

  useEffect(() => {
    if (!temporaryShare) return;
    const timer = window.setInterval(() => setTemporaryShareNow(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, [temporaryShare]);

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
      await api<void>("/auth/otp/request", {
        method: "POST",
        body: JSON.stringify({ email }),
      });
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
      const nextSession = await api<Session>("/auth/otp/verify", {
        method: "POST",
        body: JSON.stringify({
          email,
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
          ? `${oversizedFile.name} is larger than the ${AUTHENTICATED_MAX_FILE_SIZE_LABEL} per-file limit.`
          : `${oversizedFile.name} is larger than the 100 MB per-file guest limit. Log in to upload files up to ${AUTHENTICATED_MAX_FILE_SIZE_LABEL}.`,
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
          ? `${oversizedFile.name} is larger than the ${AUTHENTICATED_MAX_FILE_SIZE_LABEL} per-file limit.`
          : `${oversizedFile.name} is larger than the 100 MB per-file guest limit. Log in to upload files up to ${AUTHENTICATED_MAX_FILE_SIZE_LABEL}.`,
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
    setUploadRecoveryNotice("");
    setUploadState("preparing");
    setWorkflowStep(2);

    const createdUploads: ActiveUpload[] = [];
    let uppy: Uppy<UploadMeta, UploadBody> | null = null;
    let uploadFinished = false;
    try {
      // Load the upload engine only when a validated upload is started.
      // Resolve it before creating server records so a chunk failure is retryable.
      const [{ default: Uppy }, { default: AwsS3 }] = await Promise.all([
        import("@uppy/core"),
        import("@uppy/aws-s3"),
      ]);
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
        // Fewer simultaneous PUTs keeps memory and radio pressure manageable on phones.
        limit: window.matchMedia("(max-width: 820px)").matches
          ? MOBILE_SAFE_UPLOAD_CONCURRENCY
          : DEFAULT_UPLOAD_CONCURRENCY,
        retryDelays: UPLOAD_PART_RETRY_DELAYS,
        uploadPartBytes: (options) =>
          uploadPartWithStallRecovery(options, () => {
            setUploadRecoveryNotice("Connection paused. Retrying securely…");
          }),
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
        setUploadRecoveryNotice("");
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
    if (!session || folderActionInFlight.current || !window.confirm("Delete this item and its uploaded file?")) {
      return;
    }
    folderActionInFlight.current = true;
    setFolderActionBusy(true);
    documentRequest.current += 1;
    setDocumentsLoading(false);
    setDocumentNotice(null);
    try {
      await api<void>(
        `/documents/${documentId}`,
        { method: "DELETE" },
        session.accessToken,
      );
      setActiveUploads((currentUploads) =>
        currentUploads.filter((upload) => upload.document.id !== documentId),
      );
      setDocuments((current) => current.filter((document) => document.id !== documentId));
      setDocumentNotice({ error: false, message: "Document deleted." });
    } catch (requestError) {
      setDocumentNotice({ error: true, message: (requestError as Error).message });
    } finally {
      folderActionInFlight.current = false;
      setFolderActionBusy(false);
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

  async function openTemporaryShare(
    document: TemporaryShareDocument,
    accessToken: string,
  ) {
    setTemporaryShareBusyDocumentId(document.id);
    setError("");
    setDocumentNotice(null);
    try {
      const result = await api<Omit<TemporaryShare, "documentId" | "filename" | "accessToken">>(
        `/documents/${document.id}/temporary-share`,
        { method: "POST" },
        accessToken,
      );
      setTemporaryShareNow(Date.now());
      setTemporaryShare({
        ...result,
        documentId: document.id,
        filename: document.filename,
        accessToken,
      });
    } catch (requestError) {
      const message = (requestError as Error).message;
      if (showDocuments) setDocumentNotice({ error: true, message });
      else setError(message);
    } finally {
      setTemporaryShareBusyDocumentId(null);
    }
  }

  async function shareTemporaryLink() {
    if (!temporaryShare) return;
    try {
      if (navigator.share) {
        await navigator.share({
          title: temporaryShare.filename,
          text: `Open with code ${temporaryShare.code}. The link expires in 15 minutes.`,
          url: temporaryShare.shortUrl,
        });
      } else {
        await navigator.clipboard.writeText(temporaryShare.shortUrl);
      }
    } catch (shareError) {
      if ((shareError as DOMException).name !== "AbortError") {
        setError("Share failed. Copy the short link instead.");
      }
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

  async function performFolderAction(action: FolderAction, folder: FolderViewItem) {
    if (!session || folderActionInFlight.current) return;
    if (action === "delete" && !window.confirm(
      `Delete all ${documentCount(folder.documents.length)} in “${folder.label}” and their uploaded files? This cannot be undone.`,
    )) return;
    folderActionInFlight.current = true;
    setFolderActionBusy(true);
    if (action === "delete") {
      documentRequest.current += 1;
      setDocumentsLoading(false);
    }
    setDocumentNotice(null);
    try {
      const available = shareableDocuments(folder.documents);
      if (action === "copy") {
        if (!available.length) throw new Error("No approved share links are available yet.");
        await navigator.clipboard.writeText(folderShareText(folder));
        setDocumentNotice({
          error: false,
          message: `Copied ${available.length} labeled document ${available.length === 1 ? "link" : "links"} from “${folder.label}”.`,
        });
      } else if (action === "download") {
        if (!available.length) throw new Error("No approved documents are available to download yet.");
        const downloads = await Promise.all(available.map(async (document) => {
          const token = new URL(document.shareUrl!, window.location.origin).pathname.split("/").filter(Boolean).at(-1);
          if (!token) throw new Error("The document share link is invalid.");
          return api<{ downloadUrl: string }>(`/shares/${encodeURIComponent(decodeURIComponent(token))}`, {}, session.accessToken);
        }));
        downloads.forEach(({ downloadUrl }) => {
          const link = document.createElement("a");
          link.href = downloadUrl;
          link.target = "_blank";
          link.rel = "noopener noreferrer";
          document.body.appendChild(link);
          link.click();
          link.remove();
        });
        setDocumentNotice({ error: false, message: `Requested downloads for ${documentCount(downloads.length)}. Allow multiple downloads if your browser asks.` });
      } else {
        const results = await Promise.allSettled(folder.documents.map((document) =>
          api<void>(`/documents/${document.id}`, { method: "DELETE" }, session.accessToken),
        ));
        const deletedIds = new Set(folder.documents.filter((_, index) => results[index].status === "fulfilled").map((document) => document.id));
        setDocuments((current) => current.filter((document) => !deletedIds.has(document.id)));
        setActiveUploads((current) => current.filter((upload) => !deletedIds.has(upload.document.id)));
        const failed = results.length - deletedIds.size;
        setDocumentNotice({
          error: failed > 0,
          message: failed
            ? `Deleted ${documentCount(deletedIds.size)}. ${failed} could not be deleted. Please try again.`
            : `Deleted ${documentCount(deletedIds.size)} from “${folder.label}”.`,
        });
      }
    } catch (requestError) {
      setDocumentNotice({ error: true, message: action === "copy"
        ? "The links could not be copied. Please allow clipboard access and try again."
        : (requestError as Error).message });
    } finally {
      folderActionInFlight.current = false;
      setFolderActionBusy(false);
    }
  }

  function navigateDocuments(category: string | null, folder: string | null) {
    setOpenCategoryId(category);
    setOpenFolderKey(folder);
    setShowDocuments(true);
    setMobileMenuOpen(false);
    setAccountMenuOpen(false);
    setDocumentNotice(null);
    setExpandedDocumentCategories((current) => Array.from(new Set([...current, "root", ...(category ? [category] : [])])));
  }

  function toggleDocumentCategory(id: string) {
    setExpandedDocumentCategories((current) => current.includes(id)
      ? current.filter((item) => item !== id) : [...current, id]);
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
  }

  function showDocumentsView() {
    setShowDocuments(true);
    setMobileMenuOpen(false);
    setAccountMenuOpen(false);
    if (session) void loadDocuments(session);
  }

  function prepareAuthDialog() {
    setAuthStep("email");
    setAuthError("");
    setOtpCode("");
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
    documentRequest.current += 1;
    setDocumentsLoading(false);
    setDocumentsLoadError("");
    setDocumentNotice(null);
    setExpandedDocumentCategories(["root"]);
    window.sessionStorage.removeItem("flyae:session");
    setSession(null);
    setDocuments([]);
    setShowDocuments(false);
    setMobileMenuOpen(false);
    setAccountMenuOpen(false);
    setOpenCategoryId(null);
    setOpenFolderKey(null);
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
  const { category: openCategory, folder: openFolder } = resolveFolderLocation(categoryFolders, openCategoryId, openFolderKey);
  useLayoutEffect(() => {
    if (showDocuments && !mobileMenuOpen) documentsHeading.current?.focus();
  }, [showDocuments, mobileMenuOpen, openCategory?.key, openFolder?.key]);
  const visibleFolderItems = openCategory ? openCategory.folders.map(folderItem) : categoryFolders.map(categoryItem);
  const currentFolderItem = openFolder ? folderItem(openFolder) : openCategory ? categoryItem(openCategory) : null;
  const folderNavigation = (
    <DocumentsNavigation categories={categoryFolders} active={showDocuments}
      categoryId={openCategory?.category.id ?? null} folderKey={openFolder?.key ?? null}
      expanded={expandedDocumentCategories} onToggle={toggleDocumentCategory} onNavigate={navigateDocuments} />
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
            <div className="mobile-product-navigation">
              <nav aria-label="Mobile product navigation">
                <button type="button" className={!showDocuments ? "nav-active" : ""} onClick={showUploadView}>Upload</button>
                {!session && <button type="button" className={showDocuments ? "nav-active" : ""} onClick={showDocumentsView}>My Documents</button>}
              </nav>
              {session && folderNavigation}
            </div>
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
              <Link href="/terms" prefetch={false}>Terms and Conditions</Link>
              <Link href="/privacy" prefetch={false}>Privacy Policy</Link>
            </nav>
          </aside>
        </div>
      )}

      {showDocuments ? (
        <div className={`documents-workspace ${session ? "has-document-navigation" : ""}`}>
          {session && <aside className="documents-sidebar" aria-label="Documents sidebar">{folderNavigation}</aside>}
          <section className="documents-view" aria-labelledby="documents-title" aria-busy={documentsLoading || folderActionBusy}>
            <nav className="folder-breadcrumbs" aria-label="Folder path">
              <ol>
                <li>{openCategory
                  ? <button type="button" onClick={() => navigateDocuments(null, null)}>My Documents</button>
                  : <span aria-current="page">My Documents</span>}</li>
                {openCategory && <li>{openFolder
                  ? <button type="button" onClick={() => navigateDocuments(openCategory.category.id, null)}>{openCategory.category.name}</button>
                  : <span aria-current="page">{openCategory.category.name}</span>}</li>}
                {openFolder && <li><span aria-current="page" title={folderLabel(openFolder)}>{folderLabel(openFolder)}</span></li>}
              </ol>
            </nav>
            <div className="app-section-heading">
              <div className="documents-heading-main">
                <div className="documents-title-row">
                  {openCategory && <button className="folder-back-button" type="button"
                    aria-label={`Back to ${openFolder ? openCategory.category.name : "My Documents"}`}
                    onClick={() => navigateDocuments(openFolder ? openCategory.category.id : null, null)}>
                    <DocumentIcon name="back" />
                  </button>}
                  <h1 id="documents-title" ref={documentsHeading} tabIndex={-1}>
                    {openFolder ? folderLabel(openFolder) : openCategory?.category.name ?? "My Documents"}
                  </h1>
                  {currentFolderItem && <FolderActions folder={currentFolderItem} busy={folderActionBusy}
                    onAction={(action, folder) => void performFolderAction(action, folder)} />}
                </div>
                {session && <p className="documents-summary">{documentCount(currentFolderItem?.documents.length ?? documents.filter((document) => document.status !== "DELETED").length)}</p>}
              </div>
              <button className="button button-primary" onClick={showUploadView}>Upload document</button>
            </div>
            {documentNotice && <p className={`documents-notice ${documentNotice.error ? "is-error" : ""}`}
              role={documentNotice.error ? "alert" : "status"}>{documentNotice.message}</p>}
            {session && documentsLoadError && <div className="documents-notice is-error" role="alert">
              <span>{documentsLoadError}</span>
              <button type="button" onClick={() => void loadDocuments(session)}>Try again</button>
            </div>}
            {!session ? (
              <div className="empty-app-state">
                <h2>Log in to view your documents</h2>
                <p>My Documents is available after you sign in.</p>
                <button className="button button-primary" onClick={openAuth}>Log in</button>
              </div>
            ) : documentsLoading && !documents.length ? (
              <div className="empty-app-state" role="status">Loading documents…</div>
            ) : categoryFolders.length ? (
              <div className="documents-library desktop-documents-library">
                {openFolder ? (
                  <section className="folder-contents" aria-label={`${openFolder.category.name} ${folderLabel(openFolder)}`}>
                    <div className="document-table">
                      {openFolder.documents.map((document) => (
                        <article className="document-item" key={document.id}>
                          <DocumentIcon name="file" />
                          <div className="document-name">
                            <strong title={document.filename}>{document.filename}</strong>
                            <span>{formatBytes(document.sizeBytes)}</span>
                          </div>
                          <span className={`document-status status-${document.status.toLowerCase()}`}>
                            <i aria-hidden="true" />{statusLabel(document.status)}
                          </span>
                          <div className="document-actions">
                            {document.shareUrl && <button onClick={() => void copyShareLink(document.shareUrl!)}>Copy link</button>}
                            {TEMPORARY_SHARE_ENABLED && document.shareUrl && (
                              <button
                                disabled={temporaryShareBusyDocumentId === document.id}
                                onClick={() => void openTemporaryShare(document, session.accessToken)}
                              >
                                {temporaryShareBusyDocumentId === document.id ? "Creating…" : "QR & code"}
                              </button>
                            )}
                            <button className="danger-action" disabled={folderActionBusy} onClick={() => void deleteDocument(document.id)}>Delete</button>
                          </div>
                        </article>
                      ))}
                    </div>
                  </section>
                ) : (
                  <div className="document-folder-grid">
                    {visibleFolderItems.map((folder) => <FolderCard key={folder.key} folder={folder} busy={folderActionBusy}
                      onOpen={(item) => navigateDocuments(item.categoryId, item.folderKey)}
                      onAction={(action, item) => void performFolderAction(action, item)} />)}
                  </div>
                )}
              </div>
            ) : !documentsLoadError && (
              <div className="empty-app-state empty-documents-state"><strong>No documents yet</strong></div>
            )}
          </section>
        </div>
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
              <Link href="/privacy" prefetch={false}>Privacy Policy</Link>
              <Link href="/terms" prefetch={false}>Terms and Conditions</Link>
            </nav>
          </aside>

          <div className="workspace-main">
            <div className="workspace-intro">
              <p className="eyebrow">Secure document transfer</p>
              <h1 id="upload-title">Upload an aviation file</h1>
              <p>
                Upload a PDF, image, video, or archive up to {AUTHENTICATED_MAX_FILE_SIZE_LABEL} after signing in.
                Guest uploads: up to 100 MB per file, no email required.
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
                    disabled={categories.length === 0}
                    onChange={(event) => {
                      const nextCategory = categories.find(
                        (category) => category.id === event.target.value,
                      );
                      setCategoryId(event.target.value);
                      if (isJustDocument(nextCategory)) setMsn("");
                    }}
                  >
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
                      but it must be aviation-related. Unrelated materials may be
                      removed.
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
                      PDF, image, video, or archive (ZIP, 7Z, RAR, TAR, GZ, BZ2, XZ) · multiple files allowed.
                    </p>
                  </div>
                </div>

                <p className="upload-limit" id="upload-limit" aria-live="polite">
                  <strong>{session ? `Up to ${AUTHENTICATED_MAX_FILE_SIZE_LABEL} per file` : "Up to 100 MB per file"}</strong>
                  {!session && (
                    <button type="button" onClick={openAuth}>
                      Log in for up to {AUTHENTICATED_MAX_FILE_SIZE_LABEL}
                    </button>
                  )}
                </p>

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
                    aria-describedby="upload-limit"
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
                        {session
                          ? `Maximum ${AUTHENTICATED_MAX_FILE_SIZE_LABEL} per file`
                          : `Up to 100 MB per file as a guest. Log in to upload up to ${AUTHENTICATED_MAX_FILE_SIZE_LABEL} per file.`}
                      </small>
                    </span>
                  </button>

                  <div className="aviation-notice">
                    Please upload only materials related to aviation components.
                    Automatic checks verify file format and size.
                  </div>
                </div>

                <FilePrivacy />

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
                      Log in to upload up to {AUTHENTICATED_MAX_FILE_SIZE_LABEL} and use My Documents
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
                        {uploadRecoveryNotice || (uploadState === "processing"
                          ? "The uploaded files are being processed."
                          : "Files are sent directly to private object storage.")}
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
                  <p>
                    Anyone with a link can view and download that file without
                    signing in. Share links only with people you trust. Deleting a
                    file disables its link; copies already downloaded remain with
                    recipients.
                  </p>
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
                            {TEMPORARY_SHARE_ENABLED && (
                              <button
                                className="button button-primary"
                                disabled={temporaryShareBusyDocumentId === document.id}
                                onClick={() => void openTemporaryShare(document, upload.accessToken)}
                              >
                                {temporaryShareBusyDocumentId === document.id ? "Creating…" : "QR & code"}
                              </button>
                            )}
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

      <Mission />

      <footer className="product-footer">
        <Brand />
        <p>Secure aviation file transfer.</p>
        <nav aria-label="Project">
          <Link href="/terms" prefetch={false}>Terms</Link>
          <Link href="/privacy" prefetch={false}>Privacy</Link>
        </nav>
      </footer>

      {temporaryShare && (() => {
        const secondsRemaining = Math.max(
          0,
          Math.ceil((new Date(temporaryShare.expiresAt).getTime() - temporaryShareNow) / 1_000),
        );
        const minutes = Math.floor(secondsRemaining / 60);
        const seconds = String(secondsRemaining % 60).padStart(2, "0");
        const expired = secondsRemaining === 0;
        return (
          <div
            className="overlay"
            role="presentation"
            onMouseDown={() => setTemporaryShare(null)}
          >
            <section
              className="dialog temporary-share-dialog"
              role="dialog"
              aria-modal="true"
              aria-labelledby="temporary-share-title"
              onMouseDown={(event) => event.stopPropagation()}
              onKeyDown={(event) => {
                if (event.key === "Escape") setTemporaryShare(null);
              }}
            >
              <div className="dialog-top">
                <div>
                  <p className="eyebrow">Temporary access · DEV</p>
                  <h2 id="temporary-share-title">Scan or enter the code</h2>
                </div>
                <button className="close" onClick={() => setTemporaryShare(null)} aria-label="Close">
                  ×
                </button>
              </div>
              <div className={`temporary-share-content ${expired ? "is-expired" : ""}`}>
                <div className="temporary-share-qr" aria-label="QR code for temporary share link">
                  <QRCodeSVG
                    value={temporaryShare.shortUrl}
                    size={220}
                    level="M"
                    marginSize={2}
                    title={`Open ${temporaryShare.filename}`}
                  />
                </div>
                <div className="temporary-share-details">
                  <strong className="temporary-share-code">{temporaryShare.code}</strong>
                  <code>{temporaryShare.shortUrl}</code>
                  <p className="temporary-share-timer" role="timer">
                    {expired ? "This code has expired" : `Expires in ${minutes}:${seconds}`}
                  </p>
                  <p>Anyone with this code can download the file until it expires.</p>
                  <div className="temporary-share-actions">
                    {expired ? (
                      <button
                        className="button button-primary"
                        disabled={temporaryShareBusyDocumentId === temporaryShare.documentId}
                        onClick={() => void openTemporaryShare(
                          { id: temporaryShare.documentId, filename: temporaryShare.filename },
                          temporaryShare.accessToken,
                        )}
                      >
                        Generate new code
                      </button>
                    ) : (
                      <>
                        <button
                          className="button button-primary"
                          onClick={() => void shareTemporaryLink()}
                        >
                          Share
                        </button>
                        <button
                          className="button button-secondary"
                          onClick={() => void copyShareLink(temporaryShare.shortUrl)}
                        >
                          Copy short link
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </section>
          </div>
        );
      })()}

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
                  {authStep === "email" ? "Unable to start sign-in" : "Unable to verify the code"}
                </strong>
                <span>{authError}</span>
              </div>
            )}

            {authStep === "email" ? (
              <form onSubmit={requestOtp}>
                <h2 id="auth-title">
                  {pendingGuestClaim ? "Save to My Documents" : "Log in"}
                </h2>
                <p className="info-box">
                  {pendingGuestClaim
                    ? "Verify your email to add this guest document to My Documents without uploading it again."
                    : `Log in with your email to keep a My Documents history and upload files up to ${AUTHENTICATED_MAX_FILE_SIZE_LABEL}.`}
                </p>
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
                <button
                  className="primary-button"
                  disabled={authBusy || !email.trim()}
                >
                  {authBusy ? "Sending…" : "Get one-time code"}
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
                    setAuthStep("email");
                  }}
                >
                  ← Change email
                </button>
                <h2 id="auth-title">Enter your code</h2>
                <p className="code-copy">
                  Enter the six-digit code sent to <strong>{email}</strong>.
                </p>
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
