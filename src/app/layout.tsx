import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/contexts/AuthContext";
import { VModelProvider } from "@/contexts/VModelContext";
import SessionProvider from "@/components/providers/SessionProvider";
import { CleanupServiceProvider } from "@/components/providers/CleanupServiceProvider";
import GrowthBookProvider from "@/components/providers/GrowthBookProvider";
import { LoggerProvider } from "@/components/LoggerProvider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "V-Chat - 3Dアバターチャット",
  description:
    "3Dモデルを用いて顔を相手に見せることなくカジュアルなコミュニケーション",
  icons: {
    icon: "/v-chat_icon.png",
    shortcut: "/v-chat_icon.png",
    apple: "/v-chat_icon.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#3b82f6",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <LoggerProvider>
          <CleanupServiceProvider>
            <SessionProvider>
              <AuthProvider>
                <VModelProvider>
                  <GrowthBookProvider>{children}</GrowthBookProvider>
                </VModelProvider>
              </AuthProvider>
            </SessionProvider>
          </CleanupServiceProvider>
        </LoggerProvider>
      </body>
    </html>
  );
}
