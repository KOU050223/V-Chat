# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## プロジェクト概要

V-Chatは、3Dアバター（VRM）を使用したビデオチャットアプリケーションです。ユーザーは顔を隠しながらリアルタイムでコミュニケーションを取ることができます。

**Figmaデザイン**: https://www.figma.com/design/DTJ9Jwy5LTYN3KiW2Poxpm/V-Chat?node-id=0-1&t=wsYWw2Vgjr2JQQ0h-1

## コマンド

### 開発コマンド
```bash
# 開発サーバーの起動（Turbopack使用）
npm run dev

# プロダクションビルド
npm run build

# 本番サーバーの起動
npm start
```

### 品質管理コマンド
```bash
# TypeScriptの型チェック
npm run type-check

# ESLintによるコードチェック
npm run lint

# ESLintによる自動修正
npm run lint:fix

# Prettierによるコードフォーマット
npm run format

# フォーマットチェック
npm run format:check
```

## アーキテクチャ

### 技術スタック

**フロントエンド**
- Next.js 15 (App Router)
- React 19
- TypeScript
- Tailwind CSS v4 + shadcn/ui (new-york style)
- React Three Fiber (3D描画)
- MediaPipe Holistic (モーションキャプチャ)
- LiveKit Client SDK (リアルタイム通信)
- Vroid Web API (V体モデル取得)

**バックエンド**
- Vercel Edge Functions (API)
- Neon PostgreSQL (データ永続化)
- Upstash Redis (マッチングキュー)

**外部サービス**
- Firebase Authentication (認証)
- LiveKit Cloud (SFU)
- Cloudflare R2 (VRMファイル保存)
- Vroid Web API (V体モデル提供)

### プロジェクト構成
```
src/
├── app/
│   ├── (auth)/
│   │   ├── login/
│   │   └── register/
│   ├── (dashboard)/
│   │   ├── profile/
│   │   ├── matching/
│   │   └── room/[roomId]/
│   └── api/
│       ├── auth/
│       ├── matching/
│       ├── rooms/
│       └── vrm/
├── components/
│   ├── auth/
│   ├── avatar/
│   ├── matching/
│   ├── room/
│   └── ui/
├── lib/
│   ├── auth/
│   ├── livekit/
│   ├── mediapipe/
│   ├── three/
│   └── utils/
└── types/
```

### 認証アーキテクチャ
- Firebase Authenticationを使用
- `AuthContext`でアプリ全体の認証状態を管理
- SSRサポート（サーバーサイドでは認証機能を無効化）
- 環境変数による設定管理と検証

### 重要な設定
- TypeScript strict モード有効
- `@/*` パスエイリアスで src/ 配下を参照
- shadcn/ui は "new-york" スタイルを使用
- CSS変数を使用したテーマ管理

## 開発ガイドライン

### 実装方針
- 一度に一つのタスクに集中
- 各タスク完了後にユーザーレビューを実施
- 要件に基づいた実装を優先

### コード品質
- TypeScriptの型安全性を最大限活用
- ESLint/Prettierによるコード品質維持
- 再利用可能なコンポーネント設計

### React コンポーネント
- 関数コンポーネントを使用
- Props の型定義を必須
- カスタムフックの活用
- メモ化（useMemo, useCallback）の適切な使用

### ファイル構成
- 機能ごとにディレクトリを分割
- 共通コンポーネントは `src/components/ui/`
- ビジネスロジックは `src/lib/`
- 型定義は `src/types/`

### エラーハンドリング
- try-catch文の適切な使用
- ユーザーフレンドリーなエラーメッセージ
- ログ出力の実装

## コミットルール

GitHubコピロット用のコミットルールが.github/copilot-instructions.mdで定義されています：

### 形式
```
<type>(<scope>): <description>
```

### 主要なタイプ
- `feat`: 新機能の追加
- `fix`: バグ修正
- `docs`: ドキュメント変更
- `style`: フォーマットなどの変更
- `refactor`: リファクタリング
- `test`: テスト関連
- `chore`: ビルドプロセスやツール変更

### 例
```
feat(auth): ユーザー登録機能を追加
fix(api): ユーザー検索時の500エラーを修正
docs(readme): インストール手順を更新
```

## 環境設定

### 必要な環境変数
Firebase設定用の環境変数を `.env.local` に設定：
```
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=
```

詳細は `docs/Firebase設定.md` を参照してください。

## プロジェクト管理

### 要件文書
- `.kiro/specs/v-chat-core/requirements.md`: 機能要件
- `.kiro/specs/v-chat-core/design.md`: 設計文書
- `.kiro/specs/v-chat-core/tasks.md`: 実装計画

### 開発文書
- `.kiro/steering/development-guidelines.md`: 開発ガイドライン
- `.kiro/steering/task-execution-rules.md`: タスク実行ルール
- `.kiro/steering/tech.md`: 技術仕様書
- `.kiro/steering/product.md`: プロダクト仕様書

## 核心技術

### 3D Avatar System
- VRM形式のアバターをサポート
- React Three Fiberによる3D描画
- MediaPipeによる表情・姿勢キャプチャ
- リアルタイムモーション同期

### リアルタイム通信
- LiveKit CloudによるSFU
- WebRTCによるP2P通信
- モーションデータの低遅延配信

### マッチング機能
- ランダムマッチング
- 選択マッチング
- Redisによるキューイング管理

### セキュリティ
- Firebase Security Rules
- JWT トークン管理
- HTTPS通信の強制
- 入力値検証