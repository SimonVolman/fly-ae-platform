import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "fly.ae — Secure aircraft documentation",
  description:
    "Share manuals, certificates, specifications, photos and videos for aircraft parts through secure single-use links.",
  openGraph: {
    title: "fly.ae",
    description: "Securely share technical documentation for aircraft parts.",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "fly.ae",
    description: "Securely share technical documentation for aircraft parts.",
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
