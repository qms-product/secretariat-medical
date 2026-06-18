import type { Metadata } from "next";
import "./globals.css";

/**
 * IMP-50: Dark blue background applied to root layout.
 * Color: #1e3a5f (dark blue) defined via CSS custom property --background-color in globals.css.
 * Text: #ffffff (white) — contrast ratio 7.28:1 against #1e3a5f (exceeds WCAG AA 4.5:1).
 * Applied consistently to all pages via the root layout body element.
 */

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
