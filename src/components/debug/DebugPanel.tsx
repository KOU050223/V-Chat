"use client";

import { useFeature } from "@growthbook/growthbook-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { Bug, Code, Database, Mic, TestTube } from "lucide-react";

interface DebugPanelProps {
  className?: string;
}

export default function DebugPanel({ className }: DebugPanelProps) {
  // 開発環境かどうかを判定
  const isDev = process.env.NODE_ENV === "development";

  // Feature Flagでデバッグパネルの表示を制御
  const showDebugPanel = useFeature("debug-panel").on;

  // 開発環境でない場合は何も表示しない
  if (!isDev && !showDebugPanel) {
    return null;
  }

  const debugLinks = [
    {
      href: "/debug/session-info",
      title: "セッション情報",
      description: "Firebase/NextAuth セッション詳細",
      icon: Database,
      variant: "secondary" as const,
    },
    {
      href: "/debug/vrm-model",
      title: "VRMモデル",
      description: "VRMモデルのテストとデバッグ",
      icon: TestTube,
      variant: "secondary" as const,
    },
    {
      href: "/mic-test",
      title: "マイクテスト",
      description: "マイク/カメラ機能のテスト",
      icon: Mic,
      variant: "secondary" as const,
    },
    {
      href: "/test",
      title: "テストページ",
      description: "機能テスト用ページ",
      icon: Code,
      variant: "secondary" as const,
    },
  ];

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center space-x-2">
          <Bug className="h-5 w-5 text-orange-500" />
          <CardTitle className="text-orange-700">デバッグツール</CardTitle>
          <Badge variant="outline" className="text-xs">
            {isDev ? "DEV" : "FEATURE FLAG"}
          </Badge>
        </div>
        <CardDescription>開発者向けデバッグ機能とテストツール</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {debugLinks.map((link) => {
            const IconComponent = link.icon;
            return (
              <Link key={link.href} href={link.href}>
                <Button
                  variant={link.variant}
                  className="w-full h-auto p-3 flex items-start space-x-3 text-left"
                >
                  <IconComponent className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium">{link.title}</div>
                    <div className="text-xs text-muted-foreground">
                      {link.description}
                    </div>
                  </div>
                </Button>
              </Link>
            );
          })}
        </div>

        {isDev && (
          <div className="mt-4 pt-4 border-t">
            <div className="text-xs text-muted-foreground">
              <div>環境: {process.env.NODE_ENV}</div>
              <div>表示条件: 開発環境またはfeature flag有効</div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
