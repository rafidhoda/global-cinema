import type { Metadata } from "next";
import Script from "next/script";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Global Cinema",
  description: "Curated films by Rafid Hoda you can watch in any language.",
  openGraph: {
    title: "Global Cinema",
    description: "Curated films by Rafid Hoda you can watch in any language.",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "Global Cinema",
    description: "Curated films by Rafid Hoda you can watch in any language.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
        {/* Privacy-friendly analytics by Plausible */}
        <Script
          id="plausible-init"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              window.plausible=window.plausible||function(){(plausible.q=plausible.q||[]).push(arguments)};
              plausible.init=plausible.init||function(i){plausible.o=i||{}};
              plausible.init();
            `,
          }}
        />
        <Script
          src="https://plausible.io/js/pa-8ncJW4w7r3xQEuCdXjOGI.js"
          strategy="afterInteractive"
        />
      </body>
    </html>
  );
}
