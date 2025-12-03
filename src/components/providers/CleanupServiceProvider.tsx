"use client";

import { useEffect } from "react";
import { CleanupService } from "@/lib/cleanupService";

export function CleanupServiceProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  useEffect(() => {
    // アプリケーション起動時にクリーンアップサービスを開始
    console.log("🧹 Initializing cleanup service...");
    CleanupService.startAutoCleanup();

    // クリーンアップ（コンポーネントのアンマウント時）
    return () => {
      CleanupService.stopAutoCleanup();
    };
  }, []);

  return <>{children}</>;
}
