import type { Metadata } from "next";
import {
  Cormorant_Garamond,
  Hanken_Grotesk,
  JetBrains_Mono,
} from "next/font/google";
import "./globals.css";
import Nav from "./nav";
import { SmoothScroll, CursorGlow } from "./ui";

const display = Cormorant_Garamond({
  variable: "--font-display",
  weight: ["400", "500", "600"],
  subsets: ["latin"],
  display: "swap",
});

const sans = Hanken_Grotesk({
  variable: "--font-sans",
  subsets: ["latin"],
  display: "swap",
});

const mono = JetBrains_Mono({
  variable: "--font-mono",
  weight: ["400", "500"],
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Lucid — see yourself clearly",
  description:
    "An AI that quietly reads your digital life and reflects who you actually are.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${display.variable} ${sans.variable} ${mono.variable} h-full`}
    >
      <body className="min-h-full antialiased">
        <SmoothScroll />
        <CursorGlow />
        <Nav />
        {children}
      </body>
    </html>
  );
}
