import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/contexts/AuthContext";
import { VModelProvider } from "@/contexts/VModelContext";
import SessionProvider from "@/components/providers/SessionProvider";
import { CleanupServiceProvider } from "@/components/providers/CleanupServiceProvider";
import GrowthBookProvider from "@/components/providers/GrowthBookProvider";
import { LoggerProvider } from "@/components/LoggerProvider";
import { Toaster } from "@/components/ui/toaster";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// 安全なURL構築: 不正な形式の場合はフォールバック
function createSafeMetadataBaseUrl(): URL {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://v-chat.uomi.dev";
  const fallbackUrl = "https://v-chat.uomi.dev";

  try {
    return new URL(baseUrl);
  } catch {
    // スキームが欠けている可能性があるため、httpsを追加して再試行
    try {
      return new URL(`https://${baseUrl}`);
    } catch {
      // それでも失敗する場合は、既知の安全なデフォルトにフォールバック
      console.warn(
        `Invalid NEXT_PUBLIC_BASE_URL: ${baseUrl}, falling back to ${fallbackUrl}`
      );
      return new URL(fallbackUrl);
    }
  }
}

export const metadata: Metadata = {
  metadataBase: createSafeMetadataBaseUrl(),
  title: "V-Chat - 3Dアバターチャット",
  description:
    "3Dモデルを用いて顔を相手に見せることなくカジュアルなコミュニケーション",
  icons: {
    icon: "/v-chat_icon.png",
    shortcut: "/v-chat_icon.png",
    apple: "/v-chat_icon.png",
  },
  openGraph: {
    type: "website",
    locale: "ja_JP",
    url: "/",
    siteName: "V-Chat",
    title: "V-Chat - 3Dアバターチャット",
    description:
      "3Dモデルを用いて顔を相手に見せることなくカジュアルなコミュニケーション",
    images: [
      {
        url: "/v-chat_icon.png",
        width: 512,
        height: 512,
        alt: "V-Chat Icon",
      },
    ],
  },
  twitter: {
    card: "summary",
    title: "V-Chat - 3Dアバターチャット",
    description:
      "3Dモデルを用いて顔を相手に見せることなくカジュアルなコミュニケーション",
    images: ["/v-chat_icon.png"],
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
                  <Toaster />
                </VModelProvider>
              </AuthProvider>
            </SessionProvider>
          </CleanupServiceProvider>
        </LoggerProvider>
      </body>
    </html>
  );
}
