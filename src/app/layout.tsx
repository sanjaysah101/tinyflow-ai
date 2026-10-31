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
  title: "TinyFlow AI — Multi-Agent Code Review Powered by Mozilla Otari",
  description:
    "Multi-agent AI code review powered by open-weight models via Mozilla Otari. Features pre-flight guardrails, live CVE web search, isolated sandbox code execution, and per-user budgets.",
  keywords: [
    "AI",
    "code review",
    "Mozilla Otari",
    "open weight",
    "Qwen 3",
    "security",
    "sandbox execution",
    "MozFest 2026",
  ],
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/favicon.ico" },
    ],
    shortcut: ["/icon.svg"],
    apple: [{ url: "/icon.svg" }],
  },
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
      <body className="min-h-full flex flex-col bg-[#09090b] font-sans">
        {children}
      </body>
    </html>
  );
}
