import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "VoiceAct Studio",
  description: "Coach IA pour voix off createur et doublage cinema.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" className="h-full antialiased" translate="no" suppressHydrationWarning>
      <body className="min-h-full flex flex-col" translate="no" suppressHydrationWarning>{children}</body>
    </html>
  );
}
