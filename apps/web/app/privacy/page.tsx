import Link from "next/link";
import { FilePrivacy } from "../components/FilePrivacy";

export default function PrivacyPage() {
  return (
    <main className="legal-page">
      <Link href="/" className="back-link">
        ← Back to fly.ae
      </Link>
      <p className="eyebrow">Privacy &amp; file access</p>
      <h1>Privacy Policy</h1>
      <FilePrivacy expanded futureCopy={false} />
      <div className="legal-content">
        <section>
          <h2>How files are checked</h2>
          <p>
            Automatic checks validate the file’s format and size. AI content
            filtering is not currently enabled. An approved status means the file
            is ready to share; it does not certify its contents or remove
            confidential information.
          </p>
        </section>
        <section>
          <h2>Service activity</h2>
          <p>
            fly.ae records upload and share-link activity, including file metadata,
            account or guest identifiers, timestamps and IP addresses when
            available. Configured service administrators can receive these events
            through Telegram notifications.
          </p>
        </section>
      </div>
      <div className="message message-warning">
        <strong>Content pending</strong>
        <p>
          The final Privacy Policy must be supplied and approved by the customer
          before production release. No document content or OTP value is written to
          production logs.
        </p>
      </div>
    </main>
  );
}
