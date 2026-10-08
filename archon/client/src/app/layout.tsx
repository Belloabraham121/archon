import type { Metadata } from "next";
import { Toaster } from "sonner";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://archon.dev"),
  title: {
    default: "Archon — Programmable onchain decisions",
    template: "%s — Archon",
  },
  description:
    "The programmable decision and execution layer for onchain finance.",
  icons: {
    icon: "/brand/archon-mark.svg",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="flex min-h-full flex-col">
        {children}
        <Toaster theme="dark" richColors closeButton position="bottom-right" gap={8} />
      </body>
    </html>
  );
}
