import { ShareDocumentClient } from "./ShareDocumentClient";

export function generateStaticParams() {
  return [{ token: "__token__" }];
}

export default function SharedDocumentPage() {
  return <ShareDocumentClient />;
}
