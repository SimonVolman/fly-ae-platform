import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "fly.ae — Secure aircraft documentation",
  description:
    "Upload aviation PDF documents to private storage and share approved files through protected links.",
  icons: {
    icon: "/favicon-v2.svg",
    shortcut: "/favicon-v2.svg",
    apple: "/favicon-v2.svg",
  },
  openGraph: {
    title: "fly.ae",
    description: "Securely upload and share approved aviation PDF documents.",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "fly.ae",
    description: "Securely upload and share approved aviation PDF documents.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
