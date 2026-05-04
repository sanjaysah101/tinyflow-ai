import type { Metadata } from "next";
import { Inter, JetBrains_Mono, Space_Grotesk } from "next/font/google";
import "./globals.css";

// Primary UI font — Inter is highly legible, modern, and widely used in SaaS
const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
  display: "swap",
});

// Display font for headlines — Space Grotesk has a distinctive modern geometric feel
const spaceGrotesk = Space_Grotesk({
  variable: "--font-display",
  subsets: ["latin"],
  display: "swap",
});

// Monospace font for code — JetBrains Mono is built for developers
const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "TinyFlow AI - Code Review with Tiny Models",
  description:
    "Multi-agent AI code review powered by models under 4B parameters. Finds bugs, security vulnerabilities, and performance issues at $0.00 cost.",
  keywords: ["AI", "code review", "tiny models", "security", "bugs", "open source"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${spaceGrotesk.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-[#09090b] font-sans">{children}</body>
    </html>
  );
}
