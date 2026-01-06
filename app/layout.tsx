import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MySentinelAtlas",
  description: "The control layer above all brokers.",
  icons: {
    icon: "/favicon.ico",
    apple: "/mysentinelatlas_icon_180x180.png",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
