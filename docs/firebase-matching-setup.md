# Firebase マッチング機能の設定手順

## 必要な環境変数

### 1. フロントエンド用環境変数（.env.local）

既存のFirebase設定に加えて、Firebase Admin SDK用の環境変数を追加：

```bash
# Firebase Admin SDK（サーバーサイド用）
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=your-service-account-email
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

### 2. Cloud Functions用環境変数

LiveKit設定をCloud Functionsに追加：

```bash
firebase functions:config:set livekit.api_key="YOUR_LIVEKIT_API_KEY"
firebase functions:config:set livekit.api_secret="YOUR_LIVEKIT_API_SECRET"
```

## セットアップ手順

### 1. Firebase プロジェクトの初期化

```bash
# Firebase CLIのインストール（未インストールの場合）
npm install -g firebase-tools

# Firebaseにログイン
firebase login

# Firebaseプロジェクトの初期化
firebase init
```

初期化時の選択：
- Firestore: Yes
- Functions: Yes
- Emulators: Yes (Firestore, Functions, UI)

### 2. サービスアカウントキーの取得

1. [Firebase Console](https://console.firebase.google.com/) にアクセス
2. プロジェクト設定 → サービスアカウント
3. 「新しい秘密鍵の生成」をクリック
4. ダウンロードしたJSONファイルから以下の値を`.env.local`にコピー：
   - `project_id` → `FIREBASE_PROJECT_ID`
   - `client_email` → `FIREBASE_CLIENT_EMAIL`
   - `private_key` → `FIREBASE_PRIVATE_KEY`

**注意**: `FIREBASE_PRIVATE_KEY`は改行を`\n`に置き換えてダブルクォートで囲む

### 3. Firestoreセキュリティルールのデプロイ

```bash
firebase deploy --only firestore:rules
```

### 4. Firestoreインデックスのデプロイ

```bash
firebase deploy --only firestore:indexes
```

### 5. Cloud Functionsのデプロイ

```bash
# functionsディレクトリで依存関係をインストール
cd functions
npm install
cd ..

# Cloud Functionsをデプロイ
firebase deploy --only functions
```

## ローカル開発

### Firebase Emulatorsの起動

```bash
firebase emulators:start
```

これにより、以下のエミュレータが起動します：
- Firestore: http://localhost:8080
- Functions: http://localhost:5001
- Emulator UI: http://localhost:4000

### エミュレータ使用時の設定

開発環境で`localhost`を使用する場合、以下の環境変数を設定：

```bash
# .env.local に追加
NEXT_PUBLIC_FIREBASE_EMULATOR=true
FIRESTORE_EMULATOR_HOST=localhost:8080
FIREBASE_AUTH_EMULATOR_HOST=localhost:9099
```

## トラブルシューティング

### Cloud Functionsのデプロイエラー

**エラー**: Node.jsバージョンの不一致

**解決策**: `functions/package.json`の`engines.node`を確認し、ローカルのNode.jsバージョンと一致させる

### Firestoreセキュリティルールエラー

**エラー**: Permission denied

**解決策**:
1. セキュリティルールが正しくデプロイされているか確認
2. 認証トークンが正しく送信されているか確認
3. Firebaseコンソールでルールシミュレータを使用してテスト

### LiveKitトークン生成エラー

**エラー**: LiveKit configuration is incomplete

**解決策**: Cloud Functions環境変数が正しく設定されているか確認

```bash
firebase functions:config:get
```

## デプロイチェックリスト

- [ ] Firebase プロジェクトが作成されている
- [ ] サービスアカウントキーが`.env.local`に設定されている
- [ ] LiveKit API キーとシークレットがCloud Functionsに設定されている
- [ ] Firestoreセキュリティルールがデプロイされている
- [ ] Firestoreインデックスがデプロイされている
- [ ] Cloud Functionsがデプロイされている
- [ ] 環境変数が本番環境（Vercelなど）に設定されている

## 参考リンク

- [Firebase Functions Documentation](https://firebase.google.com/docs/functions)
- [Firestore Security Rules](https://firebase.google.com/docs/firestore/security/get-started)
- [LiveKit Documentation](https://docs.livekit.io/)
