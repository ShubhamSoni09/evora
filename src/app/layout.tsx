import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "evora · dementia companion",
  description: "Continuous emotional support for dementia patients and their caregivers",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`h-full ${inter.variable}`} style={{ background: "#fffef8" }}>
      <body className="min-h-full flex flex-col antialiased" style={{ background: "#fffef8", color: "#17110a" }}>{children}</body>
    </html>
  );
}
