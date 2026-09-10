import { ShareDocumentClient } from "../../share/[token]/ShareDocumentClient";

export function generateStaticParams() {
  return [{ code: "__code__" }];
}

export default function TemporarySharedDocumentPage() {
  return <ShareDocumentClient />;
}
