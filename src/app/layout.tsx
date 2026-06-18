import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Assistant Vocal - Secretariat Medical",
  description:
    "Assistant vocal local pour secretariat medical — donnees fictives uniquement.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr">
      <body style={{ backgroundColor: "var(--background-color)", color: "var(--text-color)" }}>{children}</body>
    </html>
  );
}
