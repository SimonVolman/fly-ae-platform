import Link from "next/link";

export default function PrivacyPage() {
  return (
    <main className="legal-page">
      <Link href="/" className="back-link">
        ← Back to fly.ae
      </Link>
      <p className="eyebrow">Legal · customer copy required</p>
      <h1>Privacy Policy</h1>
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
