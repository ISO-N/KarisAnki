import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import "katex/dist/katex.min.css";
import { AppProviders } from "@/lib/app-providers";
import { AppNav } from "@/components/app-nav";
import { PageTransition } from "@/components/page-transition";
import { TooltipProvider } from "@/components/ui/tooltip";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "KarisAnki",
  description: "Self-hosted spaced repetition flashcards",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      >
        <TooltipProvider delay={250}>
          <AppProviders>
            <div className="app-shell">
              <AppNav />
              <main className="app-main">
                <PageTransition>{children}</PageTransition>
              </main>
            </div>
          </AppProviders>
        </TooltipProvider>
      </body>
    </html>
  );
}
