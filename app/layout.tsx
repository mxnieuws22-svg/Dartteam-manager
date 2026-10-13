import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Suspense } from "react";
import NavBar from "@/components/NavBar";
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
  title: "Dartteam",
  description: "Spelers, wedstrijden en opstelling van het dartteam",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="nl"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col"><Suspense fallback={null}>
          <NavBar />
        </Suspense>
        {children}
      </body>
    </html>
  );
}
