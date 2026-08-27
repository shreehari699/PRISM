import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import { ThemeScript } from "@/components/theme-script";
import { VoiceConsultantProvider } from "@/lib/voice/voice-context";

import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "PRISM — Problem Research & Intelligence Strategy Matrix",
  description:
    "Turn a problem statement into an evidence-backed build decision. A Zero Degree product.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} dark h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <ThemeScript />
      </head>
      <body className="flex min-h-full flex-col bg-background text-foreground">
        <VoiceConsultantProvider>{children}</VoiceConsultantProvider>
      </body>
    </html>
  );
}
