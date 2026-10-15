import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Kun je? - Darten met je Hart",
  robots: { index: false, follow: false },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
