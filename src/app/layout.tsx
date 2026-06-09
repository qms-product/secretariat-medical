import type { Metadata } from "next";

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
      <body>{children}</body>
    </html>
  );
}
