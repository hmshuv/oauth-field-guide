import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import { SettingsButton } from "@/components/settings";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "OAuth Field Guide — how long until your users can connect?",
  description:
    "Evidence-graded guides for creating and getting OAuth apps approved, plus a live agent that investigates any app.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <header className="no-print sticky top-0 z-40 border-b border-line bg-bg/85 backdrop-blur">
          <div className="mx-auto flex h-14 max-w-6xl items-center gap-6 px-4 sm:px-6">
            <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
              <span className="flex h-6 w-6 items-center justify-center rounded-md bg-accent text-white" aria-hidden>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                  <circle cx="8" cy="15" r="4" />
                  <path d="M11 12l9-9M17 6l3 3M14 9l2 2" />
                </svg>
              </span>
              OAuth Field Guide
            </Link>
            <nav className="flex items-center gap-4 text-sm text-muted">
              <Link href="/" className="hover:text-ink">
                Library
              </Link>
              <Link href="/method" className="hover:text-ink">
                How it works
              </Link>
            </nav>
            <div className="ml-auto">
              <SettingsButton />
            </div>
          </div>
        </header>
        <main className="flex-1">{children}</main>
        <footer className="no-print border-t border-line py-6 text-center text-xs text-muted">
          Guides grade every claim: Tested · Source-backed · Community-reported · Uncertain. Always confirm in the
          provider&apos;s console before launch.
        </footer>
      </body>
    </html>
  );
}
