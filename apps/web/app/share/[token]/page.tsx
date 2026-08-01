"use client";

import Link from "next/link";
import { Brand } from "../../components/Brand";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080/api/v1";

type SharedDocument = {
  category: string;
  msn: string;
  filename: string;
  sizeBytes: number;
  downloadUrl: string;
};

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.ceil(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function SharedDocumentPage() {
  const { token } = useParams<{ token: string }>();
  const [document, setDocument] = useState<SharedDocument | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token) return;
    void fetch(`${API_URL}/shares/${encodeURIComponent(token)}`)
      .then(async (response) => {
        if (!response.ok) {
          const problem = (await response.json().catch(() => ({}))) as {
            detail?: string;
          };
          throw new Error(problem.detail ?? "This share link is unavailable.");
        }
        return response.json() as Promise<SharedDocument>;
      })
      .then(setDocument)
      .catch((requestError: Error) => setError(requestError.message));
  }, [token]);

  return (
    <main className="shared-page">
      <header>
        <Link href="/" className="shared-brand-link" aria-label="fly.ae home">
          <Brand />
        </Link>
        <span>Secure document share</span>
      </header>

      {document ? (
        <section className="shared-card">
          <div className="success-mark" aria-hidden="true">
            ✓
          </div>
          <p className="eyebrow">Approved aviation document</p>
          <h1>{document.filename}</h1>
          <dl>
            <div>
              <dt>Category</dt>
              <dd>{document.category}</dd>
            </div>
            <div>
              <dt>MSN</dt>
              <dd>{document.msn}</dd>
            </div>
            <div>
              <dt>Size</dt>
              <dd>{formatBytes(document.sizeBytes)}</dd>
            </div>
          </dl>
          <a className="button button-primary" href={document.downloadUrl}>
            Download PDF
          </a>
          <p className="message message-info">
            The download URL is short-lived. Open this page again to obtain a fresh
            protected URL.
          </p>
        </section>
      ) : error ? (
        <section className="shared-card shared-error">
          <p className="eyebrow">Link unavailable</p>
          <h1>Document not found</h1>
          <p>{error}</p>
        </section>
      ) : (
        <section className="shared-card">
          <p className="eyebrow">Checking secure link</p>
          <h1>Loading document…</h1>
        </section>
      )}
    </main>
  );
}
