const SHOW_FUTURE_PRIVACY_COPY =
  process.env.NODE_ENV === "development" ||
  process.env.NEXT_PUBLIC_FUTURE_PRIVACY_COPY === "true";

export function FilePrivacy({
  expanded = false,
  futureCopy = SHOW_FUTURE_PRIVACY_COPY,
}: {
  expanded?: boolean;
  futureCopy?: boolean;
}) {
  if (futureCopy) {
    return (
      <aside className="file-privacy file-privacy-future" aria-label="File privacy and access">
        <p>Your files are encrypted and automatically checked by AI.</p>
        <p>
          Share files through private links. Anyone with your link can access the
          shared file.
        </p>
        <p><strong>Even fly.ae employees cannot read your files.</strong></p>
      </aside>
    );
  }

  return (
    <aside className="file-privacy" aria-label="File privacy and access">
      <p>
        <strong>Stored privately.</strong> You choose who gets your share link.
      </p>
      <details open={expanded}>
        <summary>Who can access my files?</summary>
        <div className="file-privacy-details">
          <p>
            Your document library is tied to your account. Anyone with a file’s
            share link can view and download that file without signing in,
            including anyone the link is forwarded to. Share links only with
            people you trust.
          </p>
          <p>
            fly.ae processes and stores files on its servers. Service
            administrators have technical access to stored files. Files are not
            end-to-end encrypted, so fly.ae can access their contents.
          </p>
          <p>
            Deleting a file disables its share link. Copies already downloaded by
            recipients remain with them. After a guest upload, use Save to My
            Documents to keep managing the file from your account.
          </p>
        </div>
      </details>
    </aside>
  );
}
