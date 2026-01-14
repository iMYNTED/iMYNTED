import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "My Sentinel Atlas",
  description: "Unified monitoring • Read-only aggregation • Not a broker",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full bg-[#070B12] text-white antialiased">
        {children}
      </body>
    </html>
  );
}
