# 認証システム クイックリファレンス

## 🚀 クイックスタート

### 開発環境セットアップ

```bash
# 1. 依存関係のインストール
npm install

# 2. 環境変数設定
cp .env.example .env.local
# .env.local を編集して必要な環境変数を設定

# 3. 開発サーバー起動
npm run dev
```

### 必須環境変数

```env
# Firebase
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_domain
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id

# VRoid Hub
VROID_CLIENT_ID=your_client_id
VROID_CLIENT_SECRET=your_client_secret

# NextAuth
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your_secret_key
```

## 📚 API リファレンス

### useAuth Hook

```typescript
import { useAuth } from '@/contexts/AuthContext';

const {
  // 認証状態
  user,                    // Firebase ユーザー
  nextAuthSession,         // NextAuth セッション
  loading,                 // ロード状態
  isVRoidLinked,          // VRoid連携状態
  
  // Firebase認証
  login,                   // Email/Password ログイン
  register,                // ユーザー登録
  loginWithGoogle,         // Google認証
  loginWithGithub,         // GitHub認証
  
  // VRoidアカウント連携
  linkVRoidAccount,        // VRoid連携
  unlinkVRoidAccount,      // VRoid連携解除
  
  // 共通機能
  logout,                  // ログアウト
  resetPassword,           // パスワードリセット
  sendVerificationEmail,   // 確認メール送信
} = useAuth();
```

### 認証状態の判定

```typescript
// 基本的な認証チェック
const isAuthenticated = user || nextAuthSession;

// VRoid連携チェック
const hasVRoidAccess = isVRoidLinked;

// 現在のユーザー情報
const currentUser = user || nextAuthSession?.user;

// 認証プロバイダーの種類
const authProvider = user ? 'firebase' : 
                    nextAuthSession ? 'vroid' : 'none';
```

## 🔧 実装パターン

### 1. 認証が必要なページ

```typescript
import ProtectedRoute from '@/components/auth/ProtectedRoute';

export default function SecurePage() {
  const { user, nextAuthSession } = useAuth();
  
  return (
    <ProtectedRoute>
      <div>認証が必要なコンテンツ</div>
    </ProtectedRoute>
  );
}
```

### 2. VRoid連携が必要な機能

```typescript
export default function VRoidFeature() {
  const { isVRoidLinked, linkVRoidAccount } = useAuth();
  
  if (!isVRoidLinked) {
    return (
      <div>
        <p>VRoid連携が必要です</p>
        <Button onClick={linkVRoidAccount}>
          VRoidアカウントを連携
        </Button>
      </div>
    );
  }
  
  return <div>VRoid機能のコンテンツ</div>;
}
```

### 3. 条件付きUI表示

```typescript
export default function ConditionalUI() {
  const { user, nextAuthSession, isVRoidLinked } = useAuth();
  
  return (
    <div>
      {/* Firebase認証時のみ表示 */}
      {user && (
        <div>Firebase ユーザー: {user.email}</div>
      )}
      
      {/* VRoid認証時のみ表示 */}
      {nextAuthSession && (
        <div>
          VRoid ユーザー: {nextAuthSession.user?.name}
          <span className="badge">VRoid</span>
        </div>
      )}
      
      {/* VRoid連携時のみ有効 */}
      <Button disabled={!isVRoidLinked}>
        VRMモデルを選択
      </Button>
    </div>
  );
}
```

### 4. ログイン・ログアウト処理

```typescript
export default function AuthButtons() {
  const { 
    login, 
    loginWithGoogle, 
    loginWithGithub, 
    linkVRoidAccount, 
    logout 
  } = useAuth();
  
  const handleEmailLogin = async (email: string, password: string) => {
    try {
      await login(email, password);
    } catch (error) {
      console.error('ログインエラー:', error);
    }
  };
  
  const handleVRoidLink = async () => {
    try {
      await linkVRoidAccount();
      alert('VRoid連携が完了しました');
    } catch (error) {
      console.error('連携エラー:', error);
      alert('連携に失敗しました');
    }
  };
  
  return (
    <div>
      <Button onClick={loginWithGoogle}>Googleログイン</Button>
      <Button onClick={loginWithGithub}>GitHubログイン</Button>
      <Button onClick={handleVRoidLink}>VRoid連携</Button>
      <Button onClick={logout}>ログアウト</Button>
    </div>
  );
}
```

## 🔐 VRoid Hub API 利用

### アクセストークンの取得

```typescript
import { useSession } from 'next-auth/react';

export default function VRoidAPIExample() {
  const { data: session } = useSession();
  
  const callVRoidAPI = async () => {
    if (!session?.accessToken) {
      throw new Error('VRoid認証が必要です');
    }
    
    const response = await fetch('https://hub.vroid.com/api/character_models', {
      headers: {
        'Authorization': `Bearer ${session.accessToken}`,
        'X-Api-Version': '11',
      },
    });
    
    if (!response.ok) {
      throw new Error('VRoid API エラー');
    }
    
    return await response.json();
  };
  
  return (
    <Button onClick={callVRoidAPI}>
      VRoidモデル一覧を取得
    </Button>
  );
}
```

### 利用可能なVRoid API エンドポイント

```typescript
// ユーザー情報
GET https://hub.vroid.com/api/account

// キャラクターモデル一覧
GET https://hub.vroid.com/api/character_models

// いいねしたモデル
GET https://hub.vroid.com/api/character_models/liked

// マイモデル
GET https://hub.vroid.com/api/character_models/my

// 必要なヘッダー
headers: {
  'Authorization': `Bearer ${accessToken}`,
  'X-Api-Version': '11',
}
```

## 🐛 トラブルシューティング

### よくあるエラーと解決法

#### 1. 認証エラー

```typescript
// 問題: ログイン後に /login にリダイレクトされる
// 解決: ProtectedRoute が両方の認証をチェックしているか確認

const { user, nextAuthSession } = useAuth();
const isAuthenticated = user || nextAuthSession; // 両方をチェック
```

#### 2. VRoid認証エラー

```typescript
// 問題: VRoid OAuth で AccessDenied エラー
// 解決: VRoid Hub 開発者コンソールの設定を確認

// 確認項目:
// - Redirect URI: http://localhost:3000/api/auth/callback/vroid
// - Client ID/Secret が正しい
// - アプリケーションがActive状態
```

#### 3. 環境変数エラー

```typescript
// 問題: 環境変数が undefined
// 解決: .env.local ファイルを確認し、開発サーバーを再起動

console.log('環境変数チェック:', {
  firebaseApiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  vroidClientId: process.env.VROID_CLIENT_ID,
  nextAuthSecret: process.env.NEXTAUTH_SECRET,
});
```

### デバッグ用コード

```typescript
// 認証状態の詳細ログ
export function useAuthDebug() {
  const auth = useAuth();
  
  useEffect(() => {
    console.log('🔍 認証状態デバッグ:', {
      'Firebase User': auth.user ? '✅' : '❌',
      'NextAuth Session': auth.nextAuthSession ? '✅' : '❌',
      'VRoid Linked': auth.isVRoidLinked ? '✅' : '❌',
      'Loading': auth.loading,
      'User Email': auth.user?.email || 'N/A',
      'Session Provider': auth.nextAuthSession?.provider || 'N/A',
    });
  }, [auth]);
  
  return auth;
}
```

## 📋 チェックリスト

### 開発環境セットアップ

- [ ] Firebase プロジェクト作成・設定完了
- [ ] VRoid Hub アプリケーション登録完了
- [ ] 環境変数 (.env.local) 設定完了
- [ ] 依存関係インストール完了
- [ ] 開発サーバー起動確認

### 機能テスト

- [ ] Firebase Google認証テスト
- [ ] Firebase GitHub認証テスト
- [ ] Firebase Email認証テスト
- [ ] VRoid OAuth認証テスト
- [ ] VRoidアカウント連携テスト
- [ ] 認証状態の永続化テスト
- [ ] ログアウト機能テスト

### UI/UX確認

- [ ] ログインページの表示確認
- [ ] ダッシュボードの表示確認
- [ ] VRoid連携UI の動作確認
- [ ] エラーメッセージの表示確認
- [ ] ローディング状態の表示確認

## 🔗 関連リンク

- [Firebase Console](https://console.firebase.google.com/)
- [VRoid Hub 開発者コンソール](https://hub.vroid.com/oauth/applications/)
- [NextAuth.js ドキュメント](https://next-auth.js.org/)
- [VRoid Hub API ドキュメント](https://developer.vroid.com/en/api/)

## 📞 サポート

実装で困った場合は、以下のドキュメントを参照してください：

- `/docs/authentication-system.md` - 詳細な技術仕様
- `/docs/implementation-guide.md` - 完全な実装ガイド
- `/.kiro/specs/v-chat-core/` - プロジェクト要件書