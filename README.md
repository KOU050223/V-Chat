# V-Chat

3Dモデルを用いて顔を相手に見せることなくカジュアルなコミュニケーションを目指すチャットアプリケーションです。

## 🚀 クイックスタート

### 1. 依存関係のインストール

```bash
npm install
```

### 2. 環境設定

```bash
cp .env.example .env.local
```

Firebase と VRoid Hub の設定値を `.env.local` に入力してください。

**必要な環境変数:**
```env
# Firebase Authentication
NEXT_PUBLIC_FIREBASE_API_KEY=your_firebase_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
# ... その他のFirebase設定

# VRoid Hub OAuth
VROID_CLIENT_ID=your_vroid_client_id
VROID_CLIENT_SECRET=your_vroid_client_secret

# NextAuth
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your_secret_key
```

詳細な設定手順は [認証システムガイド](./docs/authentication-system.md) を参照してください。

### 3. 開発サーバーの起動

```bash
npm run dev
```

アプリケーションは `http://localhost:3000` で利用できます。

## 🔧 開発用コマンド

```bash
# 開発サーバーの起動
npm run dev

# プロダクションビルド
npm run build

# 型チェック
npm run type-check

# コードフォーマット
npm run format

# リンター実行
npm run lint

# リンター自動修正
npm run lint:fix
```

## 📚 ドキュメント

### 認証システム
- [認証システムガイド](./docs/authentication-system.md) - ハイブリッド認証システムの詳細
- [実装ガイド](./docs/implementation-guide.md) - 技術実装の詳細
- [クイックリファレンス](./docs/auth-quick-reference.md) - 開発者向けAPI リファレンス

### V体管理システム
- [V体管理システム](./docs/vmodel-system.md) - VRoid Web API統合とV体管理の詳細
- [LiveKit 3Dアバターシステム](./docs/livekit-avatar-system.md) - **[NEW]** リアルタイムモーション同期のアーキテクチャ

### 設定・その他
- [Firebase設定ガイド](./docs/Firebase設定.md) - Firebase 認証の設定方法
- [Wiki](./docs/V-Chat.wiki/) - プロジェクトの詳細情報

## 🛠️ 技術スタック

- **フロントエンド**: Next.js 15, React 19, TypeScript
- **スタイリング**: Tailwind CSS, shadcn/ui
- **認証**: ハイブリッド認証システム
  - Firebase Authentication (Google, GitHub, Email)
  - NextAuth.js (VRoid Hub OAuth)
- **デプロイ**: Vercel (予定)

## 🔐 認証機能

V-Chatでは、柔軟なハイブリッド認証システムを採用しています：

### サポート認証方法
- **Google認証** (Firebase)
- **GitHub認証** (Firebase)
- **Email/Password認証** (Firebase)
- **VRoid Hub OAuth** (NextAuth.js)

### アカウントリンク機能
- Firebase認証でログイン後、VRoidアカウントを追加で連携可能
- VRoidモデルへのアクセスが可能になります
- 複数の認証方法を組み合わせて使用できます

詳細は [認証システムガイド](./docs/authentication-system.md) をご覧ください。

## 🎭 V体管理システム

VRoid Hub APIと統合した包括的なV体管理機能を提供します：

### 主要機能
- **VRoidアカウント連携** - OAuth 2.0による安全な連携
- **モデル管理** - マイモデル、いいねモデルの一覧表示
- **モデル検索** - キーワードによる高速検索
- **VRMダウンロード** - ワンクリックでVRMファイルを取得
- **ライセンス確認** - モデルの利用条件を明確に表示

### V体選択フロー
1. **VRoidアカウント連携** - ダッシュボードから簡単連携
2. **モデル選択** - 3つのタブ（マイモデル/いいね/検索）から選択
3. **詳細確認** - ライセンス情報や統計を確認
4. **V体確定** - 選択したモデルをアプリで使用

### 設定管理
- **永続化** - ユーザー別に設定を自動保存
- **エクスポート/インポート** - 設定のバックアップと復元
- **カスタマイズ** - 表示設定や動作設定の調整

詳細は [V体管理システム](./docs/vmodel-system.md) をご覧ください。
