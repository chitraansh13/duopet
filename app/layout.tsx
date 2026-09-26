import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "DuoPet",
  description: "A shared habit tracker for two.",
  applicationName: "DuoPet",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "DuoPet", statusBarStyle: "default" },
  icons: { icon: "/brownie-icon.svg", apple: "/apple-touch-icon.png" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F7F5F2" },
    { media: "(prefers-color-scheme: dark)", color: "#111113" },
  ],
};

const themeScript = `(()=>{try{const m=localStorage.getItem('duopet-theme');if(m==='light'||m==='dark')document.documentElement.dataset.theme=m}catch{}})()`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" data-scroll-behavior="smooth" suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: themeScript }} /></head>
      <body className="min-h-screen font-sans antialiased">{children}</body>
    </html>
  );
}
