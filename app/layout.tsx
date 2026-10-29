import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI Company OS",
  description: "Một công ty vận hành bởi 5 AI agent. Mọi con số minh bạch.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="vi">
      <body>{children}</body>
    </html>
  );
}
