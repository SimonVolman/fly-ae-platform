import type { Metadata } from "next";
import Link from "next/link";
import { TERMS_LAST_UPDATED, TERMS_VERSION } from "../legal";

export const metadata: Metadata = {
  title: "Terms and Conditions — fly.ae",
  description: "Terms governing access to and use of the fly.ae platform.",
};

export default function TermsPage() {
  return (
    <main className="legal-page">
      <Link href="/" className="back-link">
        ← Back to fly.ae
      </Link>

      <header className="legal-header">
        <p className="eyebrow">Legal · draft for review</p>
        <h1>Terms and Conditions</h1>
        <p className="legal-updated">
          Version {TERMS_VERSION} · Last updated {TERMS_LAST_UPDATED}
        </p>
        <p className="legal-intro">
          These Terms and Conditions govern access to and use of fly.ae, including
          its document upload, processing, storage and sharing features.
        </p>
      </header>

      <div className="message message-warning legal-review-notice" role="note">
        <strong>Draft — not approved for production</strong>
        <p>
          The operator&apos;s legal name, licence, address, contact details and
          governing jurisdiction must be completed before launch. This English
          draft also requires UAE legal review and, where the service is offered to
          consumers, an appropriate Arabic version.
        </p>
      </div>

      <nav className="legal-toc" aria-label="Terms and Conditions sections">
        <h2>Contents</h2>
        <ol>
          <li><a href="#agreement">Agreement to these Terms</a></li>
          <li><a href="#service">The Service</a></li>
          <li><a href="#access">Eligibility and access</a></li>
          <li><a href="#documents">Your documents</a></li>
          <li><a href="#classification">Processing and classification</a></li>
          <li><a href="#sharing">Storage and sharing</a></li>
          <li><a href="#acceptable-use">Acceptable use</a></li>
          <li><a href="#privacy">Privacy and security</a></li>
          <li><a href="#intellectual-property">Intellectual property</a></li>
          <li><a href="#availability">Availability and changes</a></li>
          <li><a href="#suspension">Suspension and termination</a></li>
          <li><a href="#disclaimers">Disclaimers</a></li>
          <li><a href="#liability">Liability</a></li>
          <li><a href="#law">Governing law and disputes</a></li>
          <li><a href="#contact">Operator and contact details</a></li>
        </ol>
      </nav>

      <article className="legal-content">
        <section id="agreement">
          <h2>1. Agreement to these Terms</h2>
          <p>
            By accessing fly.ae, creating a session, uploading a document or
            selecting the acceptance checkbox, you agree to these Terms and to the
            <Link href="/privacy"> Privacy Policy</Link>. If you use the Service on
            behalf of a company or other organisation, you confirm that you have
            authority to bind that organisation, and “you” includes that
            organisation.
          </p>
          <p>
            If you do not agree, do not upload documents or use the Service. Your
            electronic acceptance and the version accepted may be recorded with a
            timestamp.
          </p>
        </section>

        <section id="service">
          <h2>2. The Service</h2>
          <p>
            fly.ae provides a workflow for uploading aviation-related documents,
            images and videos to private storage, processing them, viewing their
            status, managing files available to an authenticated user, and creating
            links through which approved files may be shared.
          </p>
          <p>
            Features, file-size limits, supported formats, session duration and
            other technical limits may differ by access method and will be shown
            in the Service. The current version does not process payments. Any
            future paid feature will be subject to pricing and additional terms
            disclosed before a charge is made.
          </p>
        </section>

        <section id="access">
          <h2>3. Eligibility and access</h2>
          <p>
            You must have legal capacity to accept these Terms. You must provide an
            email address you are authorised to use when requesting email access,
            keep one-time codes and access tokens confidential, and promptly tell
            us if you suspect unauthorised use.
          </p>
          <p>
            Guest access is temporary and may be limited to a single document.
            Email verification may provide access to additional features such as
            My Documents. You are responsible for activity performed using access
            credentials issued to you, except to the extent caused by our failure
            to apply legally required safeguards.
          </p>
        </section>

        <section id="documents">
          <h2>4. Your documents and responsibilities</h2>
          <p>
            You retain ownership of documents you upload. Before uploading or
            sharing any document, you must determine that you have all rights,
            licences, consents and authorisations needed to reproduce, upload,
            process and distribute it to each intended recipient. You confirm that:
          </p>
          <ul>
            <li>
              you own the document or have all permissions needed to upload,
              reproduce, process, store and distribute it through the Service;
            </li>
            <li>
              the document and your use of it comply with applicable law,
              confidentiality duties, intellectual-property rights, export-control
              and sanctions requirements, and any aviation-industry restrictions;
            </li>
            <li>
              the document does not contain malware, malicious code or content
              that is unlawful, misleading, harmful or intended to interfere with
              the Service; and
            </li>
            <li>
              the category, manufacturer serial number and other information you
              submit are accurate to the best of your knowledge.
            </li>
          </ul>
          <p>
            Do not upload personal, confidential, controlled or safety-sensitive
            information unless it is necessary, you are authorised to do so, and
            you have assessed whether the Service is appropriate for that
            information.
          </p>
          <p>
            The Operator provides technical tools and does not verify ownership,
            confidentiality restrictions or distribution rights for user content.
            Uploading, processing or assigning an “approved” status to a document
            does not mean that the Operator has reviewed, cleared or accepted
            responsibility for your right to use or distribute it. To the maximum
            extent permitted by law, you—not the Operator—are responsible for the
            documents you upload, your decision to share them, your choice of
            recipients and any unauthorised distribution arising from your actions
            or access credentials.
          </p>
        </section>

        <section id="classification">
          <h2>5. Processing and classification</h2>
          <p>
            The Service may automatically inspect a document and assign workflow
            statuses such as pending, processing, approved, rejected or failed.
            These statuses are provided only to operate the document-sharing
            workflow.
          </p>
          <p>
            An “approved” status does not certify a document&apos;s authenticity,
            accuracy, completeness, regulatory compliance, airworthiness,
            maintenance suitability or fitness for any purpose. The Service is not
            an aviation authority, approved maintenance organisation, engineering
            signatory or substitute for professional review. You and each recipient
            must independently verify a document before relying on it, especially
            for operational, maintenance, engineering, regulatory or safety-critical
            decisions.
          </p>
        </section>

        <section id="sharing">
          <h2>6. Storage, sharing and deletion</h2>
          <p>
            Documents are intended to be stored privately until you create a share
            link. Anyone who obtains a working share link may be able to access the
            associated document without signing in. Creating or sending a share link
            is your instruction to make the document available to its recipients;
            it is not a distribution decision made by the Operator. You are
            responsible for confirming that every intended recipient may lawfully
            receive the document, transmitting links securely and revoking or
            deleting access when it is no longer needed.
          </p>
          <p>
            Access links, sessions and stored documents may expire or become
            unavailable. Keep your own authoritative backup. Where deletion is
            available, we will process it subject to reasonable technical time and
            any retention required by law, security, dispute resolution or backup
            cycles, as further described in the Privacy Policy.
          </p>
        </section>

        <section id="acceptable-use">
          <h2>7. Acceptable use</h2>
          <p>You must not:</p>
          <ul>
            <li>use the Service for an unlawful, fraudulent or deceptive purpose;</li>
            <li>
              upload, reproduce or distribute content without the rights,
              permissions and authorisations required to do so;
            </li>
            <li>
              access another person&apos;s account, session or document without
              permission;
            </li>
            <li>
              probe, scan, bypass or interfere with security, rate limits, access
              controls or the operation of the Service;
            </li>
            <li>
              upload malware or use automated means that create an unreasonable
              load, except through an interface we expressly provide for that use;
              or
            </li>
            <li>
              copy, reverse engineer or exploit the Service except where applicable
              law does not permit that restriction.
            </li>
          </ul>
        </section>

        <section id="privacy">
          <h2>8. Privacy and security</h2>
          <p>
            Our handling of personal data is described in the
            <Link href="/privacy"> Privacy Policy</Link>. You are responsible for
            providing any notices and obtaining any permissions required for
            personal data contained in documents you upload.
          </p>
          <p>
            We use technical and organisational measures intended to protect the
            Service, but no internet transmission or storage system can be
            guaranteed completely secure. You should use suitable encryption or
            other controls before uploading information that requires additional
            protection.
          </p>
        </section>

        <section id="intellectual-property">
          <h2>9. Intellectual property</h2>
          <p>
            The Service, including its software, design, branding and documentation,
            is owned by the Operator or its licensors and is protected by applicable
            intellectual-property laws. Subject to these Terms, we grant you a
            limited, revocable, non-exclusive and non-transferable right to use the
            Service for its intended purpose.
          </p>
          <p>
            You grant the Operator and its service providers a limited licence to
            host, copy, transmit, inspect, process and display your documents only
            as needed to provide, secure, support and comply with legal obligations
            relating to the Service. This licence ends when the relevant document
            is deleted, subject to lawful retention and backup cycles.
          </p>
        </section>

        <section id="availability">
          <h2>10. Availability, third parties and changes</h2>
          <p>
            The Service may depend on third-party hosting, storage, email and network
            providers. We may maintain, update, replace or discontinue features and
            may impose reasonable technical limits. We do not promise uninterrupted
            or error-free availability.
          </p>
          <p>
            We may update these Terms to reflect changes to the Service or law. The
            updated version and date will be published here. Where required by law
            or where a change materially affects your rights, we will provide
            appropriate notice and request renewed acceptance.
          </p>
        </section>

        <section id="suspension">
          <h2>11. Suspension and termination</h2>
          <p>
            You may stop using the Service at any time and may delete documents when
            that feature is available. We may restrict or suspend access where
            reasonably necessary to protect the Service or another person, address
            a security risk, comply with law, investigate suspected misuse, or
            respond to a material breach of these Terms.
          </p>
          <p>
            Where reasonable and legally permitted, we will provide notice and an
            opportunity to remedy the issue. Terms that by their nature should
            survive termination, including ownership, lawful retention, disclaimers
            and liability provisions, will continue to apply.
          </p>
        </section>

        <section id="disclaimers">
          <h2>12. Disclaimers</h2>
          <p>
            To the maximum extent permitted by law, the Service is provided “as is”
            and “as available”. We do not give warranties that a document will be
            accepted, processed without error, preserved indefinitely, suitable for
            a particular workflow or available at a particular time.
          </p>
          <p>
            Nothing in these Terms overrides any express written service commitment
            signed by the Operator or any warranty or consumer right that cannot
            lawfully be excluded.
          </p>
        </section>

        <section id="liability">
          <h2>13. Liability</h2>
          <p>
            Nothing in these Terms excludes or limits liability, remedies or rights
            that applicable law does not allow to be excluded or limited.
          </p>
          <p>
            Subject to that rule and to the maximum extent permitted by law, the
            Operator will not be liable for indirect, incidental or consequential
            loss, loss of profit, revenue, business opportunity or goodwill, or loss
            arising from a user&apos;s failure to keep an authoritative backup, secure
            a share link, verify a document independently or obtain permission to
            use uploaded content.
          </p>
          <p>
            If you use the Service for a business or organisation, that organisation
            will be responsible for third-party claims arising from its unlawful
            upload or distribution of content, infringement of another
            person&apos;s rights or material breach of these Terms, except to the
            extent the claim was caused by the Operator.
          </p>
        </section>

        <section id="law">
          <h2>14. Governing law and disputes</h2>
          <div className="legal-placeholder">
            <strong>To be completed before production</strong>
            <p>
              Insert the law and courts applicable to the Operator&apos;s confirmed UAE
              licensing jurisdiction, together with any agreed escalation or
              arbitration process.
            </p>
          </div>
          <p>
            Before starting formal proceedings, please contact us and provide enough
            information for us to investigate. We will try to resolve the dispute
            promptly and fairly. Nothing in this section prevents a consumer from
            using a competent consumer-protection authority or a mandatory forum
            available under applicable law.
          </p>
        </section>

        <section id="contact">
          <h2>15. Operator and contact details</h2>
          <div className="legal-placeholder">
            <strong>Required operator information</strong>
            <dl>
              <div>
                <dt>Legal name</dt>
                <dd>[LEGAL ENTITY NAME]</dd>
              </div>
              <div>
                <dt>Legal form and licence</dt>
                <dd>[LEGAL FORM, LICENCE NUMBER AND LICENSING AUTHORITY]</dd>
              </div>
              <div>
                <dt>Registered address</dt>
                <dd>[REGISTERED ADDRESS, EMIRATE, UNITED ARAB EMIRATES]</dd>
              </div>
              <div>
                <dt>Support and legal notices</dt>
                <dd>[CONTACT EMAIL AND TELEPHONE]</dd>
              </div>
            </dl>
          </div>
        </section>
      </article>
    </main>
  );
}
