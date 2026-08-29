"use client";

import {
  ChangeEvent,
  DragEvent,
  FormEvent,
  KeyboardEvent,
  useEffect,
  useRef,
  useState,
} from "react";

type FlyFile = {
  id: string;
  name: string;
  size: string;
  ready: boolean;
};

type HistoryItem = {
  id: string;
  aircraft: string;
  msn: string;
  created: string;
  files: number;
  status: "Active" | "Opened";
};

type Dialog = "login" | "code" | "upload" | "sharing" | null;

const demoFiles: FlyFile[] = [
  { id: "demo-1", name: "AMM-32-11.pdf", size: "8.6 MB", ready: true },
  { id: "demo-2", name: "release-certificate.pdf", size: "1.2 MB", ready: true },
  { id: "demo-3", name: "landing-gear.jpg", size: "940 KB", ready: true },
];

function humanFileSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function makeShareId() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

export default function Home() {
  const [dialog, setDialog] = useState<Dialog>(null);
  const [files, setFiles] = useState<FlyFile[]>([]);
  const [signedIn, setSignedIn] = useState(false);
  const [loginMode, setLoginMode] = useState<"email" | "phone">("email");
  const [loginValue, setLoginValue] = useState("");
  const [code, setCode] = useState(["", "", "", ""]);
  const [aircraft, setAircraft] = useState("");
  const [msn, setMsn] = useState("");
  const [apu, setApu] = useState("");
  const [engine, setEngine] = useState("");
  const [copied, setCopied] = useState(false);
  const [shareId, setShareId] = useState("7F4K2Q");
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const fileInput = useRef<HTMLInputElement>(null);
  const addFileInput = useRef<HTMLInputElement>(null);
  const codeInputs = useRef<Array<HTMLInputElement | null>>([]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const storedHistory = window.localStorage.getItem("flyae:history");
      const storedLogin = window.localStorage.getItem("flyae:signed-in");
      const seenLogin = window.localStorage.getItem("flyae:welcome-seen");

      if (storedHistory) {
        try {
          setHistory(JSON.parse(storedHistory) as HistoryItem[]);
        } catch {
          window.localStorage.removeItem("flyae:history");
        }
      }
      if (storedLogin === "true") setSignedIn(true);
      if (!seenLogin && storedLogin !== "true") setDialog("login");
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!dialog) return;
    const closeOnEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (dialog === "login" || dialog === "code") {
        window.localStorage.setItem("flyae:welcome-seen", "true");
      }
      setDialog(null);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [dialog]);

  function closeDialog() {
    if (dialog === "login" || dialog === "code") {
      window.localStorage.setItem("flyae:welcome-seen", "true");
    }
    setDialog(null);
  }

  function addFiles(selected: FileList | File[]) {
    const next = Array.from(selected)
      .filter((file) => file.size <= 20 * 1024 * 1024)
      .map((file) => ({
        id: `${file.name}-${file.lastModified}-${Math.random()}`,
        name: file.name,
        size: humanFileSize(file.size),
        ready: true,
      }));

    if (!next.length) return;
    setFiles((current) => [...current, ...next]);
    setDialog("upload");
  }

  function handleFiles(event: ChangeEvent<HTMLInputElement>) {
    if (event.target.files) addFiles(event.target.files);
    event.target.value = "";
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    addFiles(event.dataTransfer.files);
  }

  function openDemo() {
    setFiles(demoFiles);
    setAircraft("737-800");
    setMsn("34567");
    setApu("Honeywell 131-9A / P-123456");
    setEngine("CFM56-7B24 / 876543");
    setDialog("upload");
  }

  function removeFile(id: string) {
    setFiles((current) => current.filter((file) => file.id !== id));
  }

  function submitLogin(event: FormEvent) {
    event.preventDefault();
    if (!loginValue.trim()) return;
    setDialog("code");
    window.setTimeout(() => codeInputs.current[0]?.focus(), 50);
  }

  function updateCode(value: string, index: number) {
    const digit = value.replace(/\D/g, "").slice(-1);
    setCode((current) =>
      current.map((item, itemIndex) => (itemIndex === index ? digit : item)),
    );
    if (digit && index < 3) codeInputs.current[index + 1]?.focus();
  }

  function codeKeyDown(event: KeyboardEvent<HTMLInputElement>, index: number) {
    if (event.key === "Backspace" && !code[index] && index > 0) {
      codeInputs.current[index - 1]?.focus();
    }
  }

  function finishLogin(event: FormEvent) {
    event.preventDefault();
    if (code.join("").length !== 4) return;
    setSignedIn(true);
    window.localStorage.setItem("flyae:signed-in", "true");
    window.localStorage.setItem("flyae:welcome-seen", "true");
    setDialog(null);
  }

  function openSharing() {
    if (!files.length || !aircraft.trim() || !msn.trim()) return;
    setShareId(makeShareId());
    setCopied(false);
    setDialog("sharing");
  }

  async function copyLink() {
    const link = `https://fly.ae/share/${shareId}`;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
    } catch {
      setCopied(true);
    }
  }

  function completeFlow() {
    const item: HistoryItem = {
      id: shareId,
      aircraft,
      msn,
      files: files.length,
      created: new Intl.DateTimeFormat("en", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }).format(new Date()),
      status: "Active",
    };
    const next = [item, ...history].slice(0, 5);
    setHistory(next);
    window.localStorage.setItem("flyae:history", JSON.stringify(next));
    setDialog(null);
    setFiles([]);
    setAircraft("");
    setMsn("");
    setApu("");
    setEngine("");
  }

  function logOut() {
    setSignedIn(false);
    window.localStorage.removeItem("flyae:signed-in");
  }

  const canShare = Boolean(files.length && aircraft.trim() && msn.trim());
  const shareLink = `https://fly.ae/share/${shareId}`;

  return (
    <main className="site-shell">
      <header className="topbar" aria-label="Primary">
        <button className="brand brand-small" onClick={() => window.scrollTo(0, 0)}>
          <span className="brand-mark" aria-hidden="true">
            ∞
          </span>
          <span className="brand-word">fly.ae</span>
        </button>
        <nav className="primary-nav" aria-label="Product">
          <a href="#upload">Upload</a>
          <a href="#history-title">My specifications</a>
        </nav>
        {signedIn ? (
          <button className="avatar" onClick={logOut} aria-label="Log out">
            U
          </button>
        ) : (
          <button className="text-button" onClick={() => setDialog("login")}>
            Log in
          </button>
        )}
      </header>

      <section className="hero" id="upload" aria-labelledby="main-title">
        <h1 className="brand" id="main-title">
          <span className="brand-mark" aria-hidden="true">
            ∞
          </span>
          <span className="brand-word">fly.ae</span>
        </h1>
        <p className="tagline">
          Share technical documentation exclusively for aircraft parts:
          <br />
          manuals, certificates, specifications, photos, and videos.
        </p>

        <div
          className="drop-zone"
          onDragOver={(event) => event.preventDefault()}
          onDrop={handleDrop}
        >
          <input
            ref={fileInput}
            className="visually-hidden"
            type="file"
            multiple
            onChange={handleFiles}
            aria-label="Upload technical documents"
          />
          <button className="upload-prompt" onClick={() => fileInput.current?.click()}>
            <span className="upload-icon" aria-hidden="true">
              ↑
            </span>
            <span>
              <strong>upload file</strong>
              <span className="or-copy">or drag&amp;drop</span>
            </span>
          </button>
          <p className="verification-note">
            Please upload only materials related to aviation components—every file
            is subject to verification.
          </p>
        </div>

        <button className="demo-link" onClick={openDemo}>
          Explore the demo screenflow
        </button>
      </section>

      <section className="flow-strip" aria-label="How fly.ae works">
        <article>
          <span>01</span>
          <h2>Upload</h2>
          <p>Add technical files up to 20 MB each.</p>
        </article>
        <article>
          <span>02</span>
          <h2>Describe</h2>
          <p>Enter the aircraft and component details.</p>
        </article>
        <article>
          <span>03</span>
          <h2>Share</h2>
          <p>Copy a secure single-use link for the recipient.</p>
        </article>
      </section>

      <section className="history-section" aria-labelledby="history-title">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Private workspace</p>
            <h2 id="history-title">History</h2>
          </div>
          {!signedIn && (
            <button className="outline-button" onClick={() => setDialog("login")}>
              Log in to save
            </button>
          )}
        </div>

        {history.length ? (
          <div className="history-list">
            {history.map((item) => (
              <article className="history-row" key={item.id}>
                <div className="file-mark" aria-hidden="true" />
                <div className="history-main">
                  <strong>
                    {item.aircraft} / {item.msn}
                  </strong>
                  <span>
                    {item.files} files · {item.created}
                  </span>
                </div>
                <span className="status">
                  <i aria-hidden="true" />
                  {item.status}
                </span>
                <button
                  className="copy-history"
                  onClick={() =>
                    navigator.clipboard?.writeText(`https://fly.ae/share/${item.id}`)
                  }
                >
                  Copy link
                </button>
              </article>
            ))}
          </div>
        ) : (
          <div className="empty-history">
            <div className="empty-folder-card">
              <span className="folder-label">Aircraft</span>
              <strong>Your shared specifications will appear here.</strong>
              <span>Empty</span>
            </div>
          </div>
        )}
      </section>

      <footer>
        <span className="brand footer-brand">
          <span className="brand-mark" aria-hidden="true">
            ∞
          </span>
          <span className="brand-word">fly.ae</span>
        </span>
        <p>Securely moving aircraft documentation.</p>
        <nav aria-label="Legal">
          <a href="#privacy">Privacy</a>
          <a href="#terms">Terms</a>
        </nav>
      </footer>

      {(dialog === "login" || dialog === "code") && (
        <div className="overlay" role="presentation" onMouseDown={closeDialog}>
          <section
            className="dialog login-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="login-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="dialog-top">
              <span className="brand brand-dialog">
                <span className="brand-mark" aria-hidden="true">
                  ∞
                </span>
                <span className="brand-word">fly.ae</span>
              </span>
              <button className="close" onClick={closeDialog} aria-label="Close login">
                ×
              </button>
            </div>

            {dialog === "login" ? (
              <form onSubmit={submitLogin}>
                <h2 id="login-title">Log in</h2>
                <p className="info-box">
                  Log in to save your created specifications, or use the service
                  without registration. In this case, your specifications will not
                  be saved.
                </p>
                <label>
                  {loginMode === "email" ? "Email" : "Phone number"}
                  <input
                    autoFocus
                    type={loginMode === "email" ? "email" : "tel"}
                    placeholder={
                      loginMode === "email" ? "Enter your email" : "+971 50 123 4567"
                    }
                    value={loginValue}
                    onChange={(event) => setLoginValue(event.target.value)}
                  />
                </label>
                <p className="privacy-copy">
                  <strong>We keep your data safe:</strong> we don’t share your
                  details with third parties and use them only to operate the
                  service.
                </p>
                <button className="primary-button" disabled={!loginValue.trim()}>
                  Get a code
                </button>
                <button
                  type="button"
                  className="switch-login"
                  onClick={() => {
                    setLoginMode((current) =>
                      current === "email" ? "phone" : "email",
                    );
                    setLoginValue("");
                  }}
                >
                  Log in with {loginMode === "email" ? "phone number" : "email"}
                </button>
              </form>
            ) : (
              <form onSubmit={finishLogin}>
                <button
                  type="button"
                  className="back-link"
                  onClick={() => setDialog("login")}
                >
                  ← Back
                </button>
                <h2 id="login-title">Enter your code</h2>
                <p className="code-copy">
                  We sent a four-digit code to <strong>{loginValue}</strong>.
                </p>
                <div className="code-grid" aria-label="Verification code">
                  {code.map((digit, index) => (
                    <input
                      key={index}
                      ref={(element) => {
                        codeInputs.current[index] = element;
                      }}
                      inputMode="numeric"
                      maxLength={1}
                      value={digit}
                      onChange={(event) => updateCode(event.target.value, index)}
                      onKeyDown={(event) => codeKeyDown(event, index)}
                      aria-label={`Digit ${index + 1}`}
                    />
                  ))}
                </div>
                <button className="primary-button" disabled={code.join("").length < 4}>
                  Log in
                </button>
                <button type="button" className="switch-login">
                  Request a new code
                </button>
              </form>
            )}
          </section>
        </div>
      )}

      {dialog === "upload" && (
        <div className="overlay" role="presentation">
          <section
            className="dialog upload-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="upload-title"
          >
            <div className="dialog-top">
              <h2 id="upload-title">Uploading</h2>
              <button className="close" onClick={closeDialog} aria-label="Close upload">
                ×
              </button>
            </div>

            <div className="file-list">
              {files.map((file) => (
                <div className="file-row" key={file.id}>
                  <span className="ready-mark" aria-label="Upload complete">
                    ✓
                  </span>
                  <span className="file-mark" aria-hidden="true" />
                  <span className="file-name">
                    <strong>{file.name}</strong>
                    <small>{file.size}</small>
                  </span>
                  <button
                    className="remove-file"
                    onClick={() => removeFile(file.id)}
                    aria-label={`Remove ${file.name}`}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>

            <div className="add-file">
              <input
                ref={addFileInput}
                className="visually-hidden"
                type="file"
                multiple
                onChange={handleFiles}
              />
              <button onClick={() => addFileInput.current?.click()}>↑ Add file</button>
            </div>

            <div className="detail-grid">
              <label>
                Aircraft <span>*</span>
                <input
                  value={aircraft}
                  onChange={(event) => setAircraft(event.target.value)}
                  placeholder="737-800"
                />
              </label>
              <label>
                MSN <span>*</span>
                <input
                  value={msn}
                  onChange={(event) => setMsn(event.target.value)}
                  placeholder="34567"
                />
              </label>
              <label>
                APU / Serial number
                <input
                  value={apu}
                  onChange={(event) => setApu(event.target.value)}
                  placeholder="131-9A / P-123456"
                />
              </label>
              <label>
                Engine / Serial number
                <input
                  value={engine}
                  onChange={(event) => setEngine(event.target.value)}
                  placeholder="CFM56-7B24 / 876543"
                />
              </label>
            </div>

            {!signedIn && (
              <button className="auth-reminder" onClick={() => setDialog("login")}>
                To track the link status and store uploaded attachments, complete a
                simple authorization.
              </button>
            )}

            <div className="dialog-actions">
              <button
                className="primary-button compact"
                disabled={!canShare}
                onClick={openSharing}
              >
                Share
              </button>
            </div>
          </section>
        </div>
      )}

      {dialog === "sharing" && (
        <div className="overlay" role="presentation">
          <section
            className="dialog sharing-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="sharing-title"
          >
            <div className="dialog-top">
              <h2 id="sharing-title">Sharing</h2>
              <button
                className="close"
                onClick={() => setDialog("upload")}
                aria-label="Close sharing"
              >
                ×
              </button>
            </div>
            <p className="single-use-copy">
              This secure link is single-use and remains active for 24 hours.
            </p>
            <div className="share-field">
              <span>{shareLink}</span>
              <button onClick={copyLink}>{copied ? "Copied" : "Copy"}</button>
            </div>
            <div className="dialog-actions">
              <button className="primary-button compact" onClick={completeFlow}>
                Complete
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
