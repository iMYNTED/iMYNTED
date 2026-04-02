import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "iMYNTED",
    template: "%s | iMYNTED",
  },
  description: "The control layer above all brokers.",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "iMYNTED",
  },
  manifest: "/manifest.json",
  icons: {
    icon: "/brand/imynted-mark-512.png",
    apple: "/brand/imynted-mark-512.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#050d14",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full bg-[#070B12] text-white antialiased overscroll-none">
        {children}
      </body>
    </html>
  );
}
