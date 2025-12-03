import { GrowthBook } from "@growthbook/growthbook-react";

// GrowthBookインスタンスを作成
export const growthbook = new GrowthBook({
  apiHost:
    process.env.NEXT_PUBLIC_GROWTHBOOK_API_HOST || "https://cdn.growthbook.io",
  clientKey: process.env.NEXT_PUBLIC_GROWTHBOOK_CLIENT_KEY || "",

  // 開発環境用のデフォルト設定
  enableDevMode: process.env.NODE_ENV === "development",

  // 開発環境では常にfeature flagsを有効にする
  features:
    process.env.NODE_ENV === "development"
      ? {
          "debug-panel": {
            defaultValue: true,
            rules: [
              {
                condition: {},
                force: true,
              },
            ],
          },
        }
      : {},
});

// 開発環境での初期化
if (process.env.NODE_ENV === "development") {
  growthbook.setFeatures({
    "debug-panel": {
      defaultValue: true,
    },
  });
}
