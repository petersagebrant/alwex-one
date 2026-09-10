import type { Metadata, Viewport } from "next";
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
  applicationName: "LEIR",
  description: "Ledning, målstyrning och verksamhetsuppföljning",
  appleWebApp: {
    capable: true,
    title: "LEIR",
    statusBarStyle: "black",
  },
  // Next 16 appleWebApp.capable emits mobile-web-app-capable only.
  other: {
    "apple-mobile-web-app-capable": "yes",
  },
};

// Header chrome `bg-[#111827]`. viewport-fit=cover so iPhone safe-area
// insets (home indicator / Dynamic Island) work in standalone; desktop
// insets stay 0.
export const viewport: Viewport = {
  themeColor: "#111827",
  viewportFit: "cover",
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
