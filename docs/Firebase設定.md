# Firebase セットアップガイド

V-ChatアプリケーションでFirebase Authenticationを使用するための設定手順です。

## 前提条件

- Googleアカウント
- GitHubアカウント（GitHub認証を使用する場合）

## Firebase プロジェクトの作成

### 1. Firebase Consoleにアクセス

1. [Firebase Console](https://console.firebase.google.com/) にアクセス
2. 「プロジェクトを作成」をクリック
3. プロジェクト名を入力（例：v-chat-app）
4. Google Analytics の設定（任意）
5. プロジェクトを作成

### 2. Web アプリケーションの追加

1. プロジェクトのホーム画面で「</> ウェブ」アイコンをクリック
2. アプリのニックネーム（例：V-Chat Web）を入力
3. 「Firebase Hosting も設定する」にチェック（任意）
4. 「アプリを登録」をクリック
5. 設定ファイルの情報をメモ（後で`.env.local`に使用）

## Authentication の設定

### 1. Authentication サービスの有効化

1. 左サイドバーから「Authentication」をクリック
2. 「始める」をクリック

### 2. サインイン方法の設定

#### Email/Password 認証

1. 「Sign-in method」タブをクリック
2. 「メール / パスワード」をクリック
3. 「有効にする」をオンにする
4. 「保存」をクリック

#### GitHub 認証

1. 「Sign-in method」タブで「GitHub」をクリック
2. 「有効にする」をオンにする

##### GitHub OAuth App の作成

1. [GitHub Developer Settings](https://github.com/settings/developers) にアクセス
2. 「New OAuth App」をクリック
3. 以下を入力：
   - **Application name**: V-Chat
   - **Homepage URL**: `http://localhost:3000` (開発時) / `https://yourdomain.com` (本番時)
   - **Authorization callback URL**: `https://your-project-id.firebaseapp.com/__/auth/handler`
     - `your-project-id` はFirebaseプロジェクトIDに置換
4. 「Register application」をクリック
5. Client ID と Client Secret をコピー

##### Firebase での GitHub 設定

1. Firebase Console の GitHub 設定画面に戻る
2. コピーした Client ID と Client Secret を入力
3. 「保存」をクリック

## 環境変数の設定

### 1. 設定ファイルのコピー

```bash
cp .env.example .env.local
```

### 2. Firebase 設定値の取得

1. Firebase Console でプロジェクト設定を開く
2. 「全般」タブの「マイアプリ」セクションでウェブアプリを選択
3. 「構成」の設定値をコピー

### 3. .env.local ファイルの更新

```bash
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key_here
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=your_measurement_id
```

## セキュリティ設定

### API キーの制限（推奨）

1. [Google Cloud Console](https://console.cloud.google.com/) にアクセス
2. プロジェクトを選択
3. 「APIとサービス」→「認証情報」
4. ウェブAPIキーを選択
5. 「HTTPリファラー」制限を設定
6. 許可するドメインを追加：
   - `localhost:3000` (開発時)
   - `yourdomain.com` (本番時)

### Firestore セキュリティルール（将来のチャット機能用）

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // 認証済みユーザーのみアクセス可能
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    
    // チャットルームは参加者のみアクセス可能
    match /chatRooms/{roomId} {
      allow read, write: if request.auth != null && 
        request.auth.uid in resource.data.participants;
    }
  }
}
```

## トラブルシューティング

### よくあるエラー

#### "Firebase: Error (auth/configuration-not-found)"

- プロジェクトIDが正しく設定されているか確認
- `.env.local`ファイルが正しい場所にあるか確認

#### "Firebase: Error (auth/unauthorized-domain)"

- Firebase Console で承認済みドメインにlocalhost:3000を追加
- Authentication → Settings → Authorized domains

#### GitHub認証エラー

- GitHub OAuth App の callback URL が正しく設定されているか確認
- Firebase の GitHub 設定で Client ID/Secret が正しいか確認

## 参考リンク

- [Firebase Authentication ドキュメント](https://firebase.google.com/docs/auth)
- [Firebase Web SDK ガイド](https://firebase.google.com/docs/web/setup)
- [GitHub OAuth Apps](https://docs.github.com/en/developers/apps/building-oauth-apps)
