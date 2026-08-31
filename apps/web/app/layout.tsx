import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";

const GOOGLE_ANALYTICS_ID = "G-3BR81SG070";

export const metadata: Metadata = {
  title: "fly.ae — Secure aircraft documentation",
  description:
    "Upload aviation documents, images, videos and archives to private storage and share approved files through protected links.",
  icons: {
    icon: "/favicon-v2.svg",
    shortcut: "/favicon-v2.svg",
    apple: "/favicon-v2.svg",
  },
  openGraph: {
    title: "fly.ae",
    description: "Securely upload and share approved aviation documents, images, videos and archives.",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "fly.ae",
    description: "Securely upload and share approved aviation documents, images, videos and archives.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        {children}
        <Script
          src={`https://www.googletagmanager.com/gtag/js?id=${GOOGLE_ANALYTICS_ID}`}
          strategy="afterInteractive"
        />
        <Script id="google-analytics" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', '${GOOGLE_ANALYTICS_ID}');
          `}
        </Script>
      </body>
    </html>
  );
}
