import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import "../styles/globals.css";

export const metadata: Metadata = {
  title: "Gymition",
  description: "A local gym gamification prototype.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
      <html lang="zh-Hant">
        <body>{children}</body>
      </html>
    </ClerkProvider>
  );
}
