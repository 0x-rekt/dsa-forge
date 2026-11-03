import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "DSA Forge — Practice the thinking",
  description: "A grounded AI tutor for data structures and algorithms.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full" data-scroll-behavior="smooth">
      <body>{children}</body>
    </html>
  );
}
