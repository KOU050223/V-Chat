"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui";
import Link from "next/link";
import { Bug, Code, Database, Mic, TestTube, Home } from "lucide-react";

export default function DebugPage() {
  const { user, nextAuthSession } = useAuth();
  const currentUser = user || nextAuthSession?.user;
  const [userAgent, setUserAgent] = useState<string>("");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setUserAgent(window.navigator.userAgent);
  }, []);

  const debugLinks = [
    {
      href: "/debug/session-info",
      title: "セッション情報",
      description: "Firebase/NextAuth セッション詳細",
      icon: Database,
    },
    {
      href: "/debug/vrm-model",
      title: "VRMモデル",
      description: "VRMモデルのテストとデバッグ",
      icon: TestTube,
    },
    {
      href: "/mic-test",
      title: "マイクテスト",
      description: "マイク/カメラ機能のテスト",
      icon: Mic,
    },
    {
      href: "/test",
      title: "テストページ",
      description: "機能テスト用ページ",
      icon: Code,
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-red-50">
      {/* ヘッダー */}
      <header className="bg-white/80 backdrop-blur-sm border-b sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-14">
            <div className="flex items-center gap-3">
              <Bug className="h-6 w-6 text-orange-600" />
              <h1 className="text-lg font-semibold text-gray-900">
                デバッグツール
              </h1>
              <Badge variant="outline" className="text-xs">
                {process.env.NODE_ENV === "development" ? "DEV" : "PROD"}
              </Badge>
            </div>
            <Link href="/dashboard">
              <Button variant="ghost" size="sm">
                <Home className="h-4 w-4 mr-2" />
                ダッシュボード
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* ユーザー情報 */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>現在のユーザー情報</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">ユーザー名:</span>
                <span className="font-mono">
                  {currentUser?.name || "未設定"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">メール:</span>
                <span className="font-mono">
                  {currentUser?.email || "未設定"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">認証タイプ:</span>
                <span className="font-mono">
                  {nextAuthSession
                    ? "NextAuth (VRoid)"
                    : user
                      ? "Firebase"
                      : "未認証"}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* デバッグツールリスト */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2 mb-2">
              <Bug className="h-5 w-5 text-orange-600" />
              <CardTitle>デバッグツール一覧</CardTitle>
            </div>
            <CardDescription>
              開発者向けデバッグ機能とテストツール
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {debugLinks.map((link) => {
                const IconComponent = link.icon;
                return (
                  <Link key={link.href} href={link.href}>
                    <Card className="hover:shadow-md transition-shadow cursor-pointer">
                      <CardContent className="pt-6">
                        <div className="flex items-start gap-3">
                          <div className="p-2 bg-orange-100 rounded-lg">
                            <IconComponent className="h-5 w-5 text-orange-600" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-semibold text-gray-900">
                              {link.title}
                            </div>
                            <div className="text-sm text-gray-500 mt-1">
                              {link.description}
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                );
              })}
            </div>

            {mounted && (
              <div className="mt-6 pt-6 border-t">
                <div className="text-xs text-gray-500 space-y-1">
                  <div>環境: {process.env.NODE_ENV}</div>
                  <div>User Agent: {userAgent}</div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
