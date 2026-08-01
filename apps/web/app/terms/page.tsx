import Link from "next/link";

export default function TermsPage() {
  return (
    <main className="legal-page">
      <Link href="/" className="back-link">
        ← Back to fly.ae
      </Link>
      <p className="eyebrow">Legal · customer copy required</p>
      <h1>Terms and Conditions</h1>
      <div className="message message-warning">
        <strong>Content pending</strong>
        <p>
          The final Terms and Conditions must be supplied and approved by the
          customer before production release. V0 records the accepted document
          version during OTP verification.
        </p>
      </div>
    </main>
  );
}
