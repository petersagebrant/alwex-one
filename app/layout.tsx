import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { AuthRecoveryGate } from "@/components/auth/AuthRecoveryGate";
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
  title: {
    default: "LEIR",
    template: "%s | LEIR",
  },
  description: "Ledning, målstyrning och verksamhetsuppföljning",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="sv"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <AuthRecoveryGate />
        {children}
      </body>
    </html>
  );
}
