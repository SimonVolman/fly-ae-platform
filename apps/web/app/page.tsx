"use client";

import AwsS3, { type AwsS3Part } from "@uppy/aws-s3";
import Uppy from "@uppy/core";
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
const AUTHENTICATED_MAX_FILE_SIZE = 100 * 1024 * 1024;
const GUEST_MAX_FILE_SIZE = 10 * 1024 * 1024;
const GENERAL_DOCUMENT_MSN = "GENERAL";
const MAINTENANCE_MODE = process.env.NEXT_PUBLIC_MAINTENANCE_MODE === "true";

type Category = {
  id: string;
  code: string;
  name: string;
};

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

function HomeContent() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryId, setCategoryId] = useState("");
  const [msn, setMsn] = useState("");
  const [session, setSession] = useState<Session | null>(null);
  const [documents, setDocuments] = useState<FlyDocument[]>([]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadState, setUploadState] = useState<UploadState>("idle");
  const [workflowStep, setWorkflowStep] = useState<WorkflowStep>(1);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [activeDocument, setActiveDocument] = useState<FlyDocument | null>(null);
  const [activeDocumentAccessToken, setActiveDocumentAccessToken] = useState("");
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
  const [openFolderKey, setOpenFolderKey] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const stepTwo = useRef<HTMLElement>(null);
  const stepThree = useRef<HTMLElement>(null);

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
        setCategoryId((current) => current || result[0]?.id || "");
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
      setError("Select a document category and enter the MSN.");
      return;
    }
    setUploadState(selectedFile ? "ready" : "idle");
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
      setAuthOpen(false);
      setMobileMenuOpen(false);
      setAccountMenuOpen(false);
      setUploadState(selectedFile ? "ready" : "idle");
      await loadDocuments(nextSession);
    } catch (requestError) {
      setAuthError((requestError as Error).message);
    } finally {
      setAuthBusy(false);
    }
  }

  function selectPdfFile(file?: File) {
    setError("");
    if (!file) return;
    if (file.type !== "application/pdf" || !file.name.toLowerCase().endsWith(".pdf")) {
      setError("Choose a text PDF document.");
      return;
    }
    const maxFileSize = session
      ? AUTHENTICATED_MAX_FILE_SIZE
      : GUEST_MAX_FILE_SIZE;
    if (file.size > maxFileSize) {
      setError(
        session
          ? "The PDF must be no larger than 100 MB."
          : "Guest uploads are limited to 10 MB. Log in to upload up to 100 MB.",
      );
      return;
    }
    setSelectedFile(file);
    setUploadState("ready");
    setUploadProgress(0);
    setActiveDocument(null);
  }

  function chooseFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    selectPdfFile(file);
  }

  function dropFile(event: DragEvent<HTMLButtonElement>) {
    event.preventDefault();
    selectPdfFile(event.dataTransfer.files?.[0]);
  }

  function removeSelectedFile() {
    setSelectedFile(null);
    setUploadState("idle");
    setUploadProgress(0);
    setActiveDocument(null);
    setActiveDocumentAccessToken("");
    setAcceptedGuestLegal(false);
    setError("");
  }

  async function pollUntilProcessed(
    documentId: string,
    accessToken: string,
    currentSession: Session | null,
  ) {
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const document = await api<FlyDocument>(
        `/documents/${documentId}`,
        {},
        accessToken,
      );
      setActiveDocument(document);
      if (document.status === "APPROVED") {
        setUploadState("approved");
        setWorkflowStep(3);
        if (!window.matchMedia("(min-width: 1100px)").matches) {
          window.setTimeout(() => stepThree.current?.scrollIntoView({ block: "nearest" }), 0);
        }
        if (currentSession) await loadDocuments(currentSession);
        return;
      }
      if (["FAILED", "REJECTED"].includes(document.status)) {
        setUploadState("failed");
        if (currentSession) await loadDocuments(currentSession);
        return;
      }
      setUploadState("processing");
      await new Promise((resolve) => window.setTimeout(resolve, 500));
    }
    throw new Error("Processing is taking longer than expected. Keep this page open and retry.");
  }

  async function startUpload() {
    if (
      !selectedFile ||
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
    if (selectedFile.size > maxFileSize) {
      setError(
        session
          ? "The PDF must be no larger than 100 MB."
          : "Guest uploads are limited to 10 MB. Log in to upload up to 100 MB.",
      );
      return;
    }
    const currentSession = session;
    setError("");
    setUploadProgress(0);
    setUploadState("preparing");
    setWorkflowStep(2);

    let document: FlyDocument | null = null;
    let uppy: Uppy<UploadMeta, UploadBody> | null = null;
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

      document = await api<FlyDocument>(
        "/documents",
        {
          method: "POST",
          body: JSON.stringify({
            categoryId,
            msn: isJustDocument(selectedCategory) ? GENERAL_DOCUMENT_MSN : msn.trim(),
            filename: selectedFile.name,
            mimeType: selectedFile.type,
            sizeBytes: selectedFile.size,
          }),
        },
        accessToken,
      );
      setActiveDocument(document);
      setActiveDocumentAccessToken(accessToken);

      uppy = new Uppy<UploadMeta, UploadBody>({
        autoProceed: false,
        allowMultipleUploadBatches: false,
        restrictions: {
          allowedFileTypes: ["application/pdf", ".pdf"],
          maxFileSize,
          maxNumberOfFiles: 1,
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
          setActiveDocument(completed);
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

      uppy.on("upload-progress", (_file, progress) => {
        if (!progress.bytesTotal) return;
        setUploadState("uploading");
        setUploadProgress(
          Math.min(100, Math.round((progress.bytesUploaded / progress.bytesTotal) * 100)),
        );
      });
      uppy.addFile({
        name: selectedFile.name,
        type: selectedFile.type,
        data: selectedFile,
        meta: { documentId: document.id },
      });

      const result = await uppy.upload();
      if (result?.failed?.length) {
        throw result.failed[0].error ?? new Error("Upload failed.");
      }
      setUploadProgress(100);
      setUploadState("processing");
      await pollUntilProcessed(document.id, accessToken, currentSession);
    } catch (requestError) {
      setUploadState("failed");
      setError((requestError as Error).message);
    } finally {
      uppy?.destroy();
    }
  }

  async function deleteDocument(documentId: string) {
    if (!session || !window.confirm("Delete this document and its uploaded PDF?")) {
      return;
    }
    setError("");
    try {
      await api<void>(
        `/documents/${documentId}`,
        { method: "DELETE" },
        session.accessToken,
      );
      if (activeDocument?.id === documentId) setActiveDocument(null);
      await loadDocuments(session);
    } catch (requestError) {
      setError((requestError as Error).message);
    }
  }

  async function deleteActiveDocument() {
    const accessToken = activeDocumentAccessToken;
    if (
      !accessToken ||
      !activeDocument ||
      !window.confirm("Delete this document and its uploaded PDF?")
    ) {
      return;
    }
    setError("");
    try {
      await api<void>(
        `/documents/${activeDocument.id}`,
        { method: "DELETE" },
        accessToken,
      );
      setActiveDocument(null);
      setActiveDocumentAccessToken("");
      setSelectedFile(null);
      setUploadState("idle");
      setWorkflowStep(1);
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

  function resetUploadFlow() {
    setMsn("");
    setSelectedFile(null);
    setUploadState("idle");
    setUploadProgress(0);
    setActiveDocument(null);
    setActiveDocumentAccessToken("");
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

  function openAuth() {
    setAuthStep("method");
    setAuthError("");
    setAuthenticationMethod("EMAIL");
    setOtpCode("");
    setTelegramRequestId("");
    setTelegramStartUrl("");
    setAcceptedLegal(false);
    setAuthOpen(true);
  }

  function closeAuth() {
    setAuthOpen(false);
    setAuthError("");
  }

  function logOut() {
    window.sessionStorage.removeItem("flyae:session");
    setSession(null);
    setDocuments([]);
    setShowDocuments(false);
    setMobileMenuOpen(false);
    setAccountMenuOpen(false);
    setUploadState("idle");
    setWorkflowStep(1);
    setActiveDocument(null);
    setActiveDocumentAccessToken("");
  }

  const selectedCategory = categories.find((category) => category.id === categoryId);
  const documentDetailsReady = Boolean(
    categoryId && (isJustDocument(selectedCategory) || msn.trim()),
  );
  const uploadBusy = ["preparing", "uploading", "processing"].includes(uploadState);
  const documentFolders = groupDocumentsIntoFolders(documents);
  const openFolder = documentFolders.find((folder) => folder.key === openFolderKey);
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
              <p className="eyebrow">Private workspace</p>
              <h1 id="documents-title">My Documents</h1>
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
            <>
            <div className="documents-library desktop-documents-library">
              <div className="document-folder-grid">
                {documentFolders.map((folder) => {
                  const isOpen = folder.key === openFolderKey;
                  const documentCount = folder.documents.length;

                  return (
                    <button
                      className={`folder-card document-folder-card ${isOpen ? "folder-open" : ""}`}
                      type="button"
                      key={folder.key}
                      aria-expanded={isOpen}
                      onClick={() => setOpenFolderKey(isOpen ? null : folder.key)}
                    >
                      <span className="folder-card-top">
                        <span>{folder.category.name}</span>
                        <strong aria-hidden="true">›</strong>
                      </span>
                      <strong className="folder-msn">
                        {isJustDocument(folder.category) ? "General documents" : folder.msn}
                      </strong>
                      <span className="folder-document-count">
                        {documentCount} {documentCount === 1 ? "document" : "documents"}
                      </span>
                    </button>
                  );
                })}
              </div>

              {openFolder && (
                <section
                  className="folder-contents"
                  aria-label={
                    isJustDocument(openFolder.category)
                      ? openFolder.category.name
                      : `${openFolder.category.name} MSN ${openFolder.msn}`
                  }
                >
                  <div className="folder-contents-heading">
                    <div>
                      <p className="eyebrow">{openFolder.category.name}</p>
                      <h2>
                        {isJustDocument(openFolder.category)
                          ? "General documents"
                          : `MSN ${openFolder.msn}`}
                      </h2>
                    </div>
                    <button type="button" onClick={() => setOpenFolderKey(null)}>Close</button>
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
              )}
            </div>
            <div className="document-table mobile-document-table">
              {documents.map((document) => (
                <article className="document-item" key={document.id}>
                  <span className="file-mark" aria-hidden="true" />
                  <div className="document-name">
                    <strong>{document.filename}</strong>
                    <span>
                      {document.category.name}
                      {!isJustDocument(document.category) && ` · MSN ${document.msn}`} ·{" "}
                      {formatBytes(document.sizeBytes)}
                    </span>
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
            </>
          ) : (
            <div className="empty-app-state empty-documents-state">
              <strong>No documents yet</strong>
            </div>
          )}
        </section>
      ) : (
        <section className="upload-workspace" aria-labelledby="upload-title">
          <div className="workspace-intro">
            <p className="eyebrow">Secure document transfer</p>
            <h1 id="upload-title">Upload an aviation document</h1>
            <p>
              Upload a text PDF up to 100 MB. First upload up to 10 MB—no email
              required.
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
                    {!isJustDocument(selectedCategory) && ` · MSN ${msn}`}
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
                        ? "Upload a general aviation-related document without an MSN."
                        : "Select the category and enter the manufacturer serial number."}
                    </p>
                  </div>
                </div>

                <div className="category-grid" role="radiogroup" aria-label="Category">
                  {categories.map((category) => (
                    <button
                      className={`category-option ${
                        categoryId === category.id ? "category-selected" : ""
                      }`}
                      key={category.id}
                      role="radio"
                      aria-checked={categoryId === category.id}
                      onClick={() => {
                        setCategoryId(category.id);
                        if (isJustDocument(category)) setMsn("");
                      }}
                    >
                      <span>{category.name}</span>
                      <i aria-hidden="true">✓</i>
                    </button>
                  ))}
                </div>

                {isJustDocument(selectedCategory) ? (
                  <div className="general-document-note">
                    <strong>No MSN required</strong>
                    <p>
                      You can upload a purchase order, invoice, or general data,
                      but it must be aviation-related. Anything unrelated will be
                      deleted.
                    </p>
                  </div>
                ) : (
                  <label className="field msn-field">
                    <span>MSN <i>*</i></span>
                    <input
                      value={msn}
                      onChange={(event) => setMsn(event.target.value)}
                      placeholder="ENTER MANUFACTURER SERIAL NUMBER"
                      maxLength={64}
                    />
                  </label>
                )}

                <button className="button button-primary continue-button" onClick={continueToUpload}>
                  Continue to PDF upload
                </button>
              </section>
            )}

            {workflowStep > 2 && selectedFile && (
              <article className="step-summary" aria-label="PDF upload completed">
                <span className="step-summary-number" aria-hidden="true">✓</span>
                <div>
                  <small>Step 02 complete</small>
                  <strong>{selectedFile.name} · {formatBytes(selectedFile.size)}</strong>
                </div>
                <span className="summary-status">Approved</span>
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
                    <h2>PDF upload</h2>
                    <p>
                      PDF only · maximum {session ? "100 MB" : "10 MB as guest"} · one
                      document per upload.
                    </p>
                  </div>
                </div>

                <input
                  ref={fileInput}
                  className="visually-hidden"
                  type="file"
                  accept="application/pdf,.pdf"
                  onChange={chooseFile}
                />

                <button
                  className={`app-drop-zone ${selectedFile ? "file-selected" : ""}`}
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
                    <strong>Choose a PDF or drag &amp; drop it here</strong>
                    <small>
                      {session ? "Maximum 100 MB file size" : "Maximum 10 MB file size"}
                    </small>
                  </span>
                </button>

                <div className="aviation-notice">
                  Please upload only materials related to aviation components.
                  Every document is subject to verification.
                </div>

                {selectedFile && (
                  <div className="selected-upload-row">
                    <span className="selected-check" aria-hidden="true">✓</span>
                    <span className="selected-file-icon" aria-hidden="true" />
                    <div>
                      <strong>{selectedFile.name}</strong>
                      <small>{formatBytes(selectedFile.size)}</small>
                    </div>
                    {!uploadBusy && (
                      <button
                        type="button"
                        className="remove-upload"
                        onClick={removeSelectedFile}
                        aria-label={`Remove ${selectedFile.name}`}
                      >
                        <i aria-hidden="true" />
                      </button>
                    )}
                  </div>
                )}

                {!session && selectedFile && !uploadBusy && (
                  <div className="guest-upload-options">
                    <p>
                      Upload as a guest. This temporary access is limited to this
                      document; My Documents requires sign-in.
                    </p>
                    <label className="legal-check">
                      <input
                        type="checkbox"
                        checked={acceptedGuestLegal}
                        onChange={(event) => setAcceptedGuestLegal(event.target.checked)}
                      />
                      <span>
                        I accept the <Link href="/terms">Terms</Link> and{" "}
                        <Link href="/privacy">Privacy Policy</Link>.
                      </span>
                    </label>
                    <button
                      type="button"
                      className="guest-login-link"
                      onClick={() => {
                        openAuth();
                      }}
                    >
                      Log in to upload up to 100 MB and use My Documents
                    </button>
                  </div>
                )}

                {uploadBusy && (
                  <div className="upload-progress" aria-live="polite">
                    <div>
                      <strong>
                        {uploadState === "preparing" && "Preparing secure upload"}
                        {uploadState === "uploading" && `Uploading · ${uploadProgress}%`}
                        {uploadState === "processing" && "Verifying document"}
                      </strong>
                      <span>
                        {uploadState === "processing"
                          ? "The local classifier is processing the PDF."
                          : "The PDF is sent directly to private object storage."}
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

                {selectedFile && !uploadBusy && (
                  <button
                    className="button button-primary upload-button"
                    disabled={
                      !documentDetailsReady || (!session && !acceptedGuestLegal)
                    }
                    onClick={() => void startUpload()}
                  >
                    {documentDetailsReady
                      ? "Upload securely"
                      : "Complete document details to upload"}
                  </button>
                )}
              </section>
            )}

            {workflowStep === 3 && activeDocument?.shareUrl && (
              <section
                className="share-result wizard-share-result"
                aria-live="polite"
                ref={stepThree}
              >
                <div className="success-mark" aria-hidden="true">✓</div>
                <div>
                  <p className="eyebrow">Step 03 · Approved</p>
                  <h2>Your secure link is ready</h2>
                  <p>The recipient can use this link to access the approved PDF.</p>
                </div>
                <div className="share-result-actions">
                  <code>{activeDocument.shareUrl}</code>
                  <button
                    className="button button-success"
                    onClick={() => void copyShareLink(activeDocument.shareUrl!)}
                  >
                    Copy link
                  </button>
                  <button className="button button-secondary" onClick={resetUploadFlow}>
                    Upload another document
                  </button>
                  <button
                    className="button button-secondary"
                    onClick={() => void deleteActiveDocument()}
                  >
                    Delete document
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
        </section>
      )}

      <section className="mission-section" aria-labelledby="mission-title">
        <div>
          <p className="eyebrow">Purpose-built for aviation</p>
          <h2 id="mission-title">Mission of fly.ae</h2>
        </div>
        <p>
          There is no product on the market today that gives aviation experts a
          dedicated way to share proprietary data. If you are tired of dropping
          files into generic boxes or transferring them through third parties,
          fly.ae gives you a secure, aviation-focused place to share them.
        </p>
      </section>

      <footer className="product-footer">
        <Brand />
        <p>Secure aviation document transfer.</p>
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
                <h2 id="auth-title">Log in</h2>
                <p className="info-box">
                  Log in to keep a My Documents history and upload PDFs up to 100 MB.
                  Choose email or Telegram. Each method creates its own fly.ae account.
                </p>
                {telegramEnabled && (
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
                    I accept the <Link href="/terms">Terms</Link> and{" "}
                    <Link href="/privacy">Privacy Policy</Link>.
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
