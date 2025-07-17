# V-Chat プロジェクトコンテキスト

## プロジェクト概要

V-Chatは3Dモデルを用いて顔を相手に見せることなくカジュアルなコミュニケーションを目指すチャットアプリケーションです。

## 技術スタック

### フロントエンド
- **Next.js 15** - React フレームワーク
- **React 19** - UIライブラリ
- **TypeScript** - 型安全性
- **Tailwind CSS v4** - スタイリング（新形式の@import構文使用）
- **shadcn/ui** - UIコンポーネントライブラリ

### バックエンド・認証
- **Firebase Authentication** - ユーザー認証
- **Firebase Firestore** - データベース（予定）

### 開発ツール
- **ESLint** - コード品質チェック
- **Prettier** - コードフォーマット
- **TypeScript** - 型チェック

## プロジェクト構造

```
src/
├── app/                 # Next.js App Router
├── components/          # Reactコンポーネント
│   ├── auth/           # 認証関連コンポーネント
│   └── ui/             # shadcn/ui コンポーネント
├── contexts/           # React Context
├── lib/                # ユーティリティ関数
└── types/              # TypeScript型定義
```

## 重要な設定ファイル

### Tailwind CSS
- `src/app/globals.css` - Tailwind v4の新形式で設定済み
- 設定ファイル（tailwind.config.js等）は不要

### TypeScript
- 厳密な型チェック有効
- パスエイリアス `@/*` で `./src/*` を参照

### 環境変数
Firebase設定用の環境変数が必要：
- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
- `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- `NEXT_PUBLIC_FIREBASE_APP_ID`

## 開発ワークフロー

### 利用可能なコマンド
```bash
npm run dev          # 開発サーバー起動
npm run build        # プロダクションビルド
npm run type-check   # TypeScript型チェック
npm run lint         # ESLint実行
npm run lint:fix     # ESLint自動修正
npm run format       # Prettier実行
npm run format:check # Prettierチェック
```

## コーディング規約

### TypeScript
- 厳密な型定義を使用
- `any` 型の使用は警告
- 未使用変数はエラー
- `const` を優先、`var` は禁止

### スタイリング
- Tailwind CSS v4の新形式を使用
- CSS変数でテーマ管理
- ダークモード対応

### コンポーネント設計
- 関数コンポーネントを使用
- Props の型定義を必須
- 再利用可能なコンポーネントは `src/components/ui/` に配置

## 型定義

### 主要な型
- `User` - ユーザー情報
- `ChatRoom` - チャットルーム
- `Message` - メッセージ
- `ApiResponse<T>` - API レスポンス
- `FirebaseConfig` - Firebase設定

## 注意事項

1. **Tailwind CSS v4使用**: 従来のconfig.jsファイルは不要
2. **日本語対応**: UIテキストは日本語で実装
3. **Firebase設定**: 環境変数での設定が必須
4. **型安全性**: TypeScriptの厳密な型チェックを活用
5. **コードフォーマット**: Prettierによる自動フォーマット適用