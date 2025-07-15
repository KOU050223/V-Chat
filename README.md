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

Firebase の設定値を `.env.local` に入力してください。詳細な設定手順は [Firebase設定ガイド](./docs/Firebase設定.md) を参照してください。

### 3. 開発サーバーの起動

```bash
npm run dev
```

アプリケーションは `http://localhost:3000` で利用できます。

## 📚 ドキュメント

- [Firebase設定ガイド](./docs/Firebase設定.md) - 認証機能の設定方法
- [Wiki](./docs/V-Chat.wiki/) - プロジェクトの詳細情報

## 🛠️ 技術スタック

- **フロントエンド**: Next.js 15, React 19, TypeScript
- **スタイリング**: Tailwind CSS, shadcn/ui
- **認証**: Firebase Authentication
- **デプロイ**: Vercel (予定)

## 📝 ライセンス

このプロジェクトはMITライセンスの下で公開されています。
