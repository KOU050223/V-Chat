# V-Chat 実装ガイド

## Task 2.2: NextAuth設定とVroid OAuth認証 - 実装完了報告

### 実装概要

V-Chatプロジェクトにおいて、ハイブリッド認証システムとVRoidアカウントリンク機能を正常に実装完了しました。

## 実装されたコンポーネント

### 1. 認証システムの中核

#### AuthContext (`/src/contexts/AuthContext.tsx`)
```typescript
// 主要な機能
- Firebase Authentication管理
- NextAuth.js セッション管理
- アカウントリンク機能
- 統合認証状態管理

// 新規追加されたメソッド
linkVRoidAccount(): Promise<void>     // VRoidアカウント連携
unlinkVRoidAccount(): Promise<void>   // VRoid連携解除
isVRoidLinked: boolean               // VRoid連携状態
```

#### NextAuth設定 (`/src/lib/auth.ts`)
```typescript
// VRoid Hub OAuth 2.0プロバイダー
- 認証エンドポイント: https://hub.vroid.com/oauth/authorize
- トークンエンドポイント: https://hub.vroid.com/oauth/token
- ユーザー情報エンドポイント: https://hub.vroid.com/api/account
- API バージョン: v11
- スコープ: default
```

### 2. UI/UXコンポーネント

#### ログインページ (`/src/components/auth/Login.tsx`)
```typescript
// 認証オプション
- Firebase: Google, GitHub, Email/Password
- NextAuth: VRoid Hub OAuth
- NextAuth統合サインインページオプション
```

#### ProtectedRoute (`/src/components/auth/ProtectedRoute.tsx`)
```typescript
// ハイブリッド認証対応
const isAuthenticated = user || nextAuthSession;

// 両方の認証方法をサポート
- Firebase認証チェック
- NextAuth認証チェック
- 統合認証状態管理
```

#### ダッシュボード (`/src/app/dashboard/page.tsx`)
```typescript
// VRoidアカウント連携UI
- 連携状態表示インジケーター
- VRoidアカウント連携ボタン
- 連携解除機能
- V体選択機能（VRoid連携時のみ有効）
```

### 3. プロバイダー設定

#### SessionProvider (`/src/components/providers/SessionProvider.tsx`)
```typescript
// NextAuth SessionProvider ラッパー
export default function SessionProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextAuthSessionProvider>
      {children}
    </NextAuthSessionProvider>
  );
}
```

#### Layout統合 (`/src/app/layout.tsx`)
```typescript
// プロバイダー階層
<SessionProvider>
  <AuthProvider>
    {children}
  </AuthProvider>
</SessionProvider>
```

## 設定ファイル

### 環境変数 (`.env.local`)
```env
# Firebase Configuration
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSyCmAaQLYezHVLM8nL6flaokzLvNqj2obbc
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=v-chat-a495e.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=v-chat-a495e
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=v-chat-a495e.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=127899298566
NEXT_PUBLIC_FIREBASE_APP_ID=1:127899298566:web:1b7cbc9d7ee5723e338c87
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=G-2XGLEYGQY4

# VRoid Hub Configuration
VROID_CLIENT_ID=YU6WviDCckXyhsC5IvxQctqIuYYJcbebHqAuE_-FeTM
VROID_CLIENT_SECRET=5FL6ldReh7_pzIcFi89s9mzsxFN0GUwuMCXSOw70XIg

# NextAuth Configuration
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=hwHcEVxA+Qy11EiNX0UTodo5GDlGkNwDIGEOUmmoqBU=
NEXTAUTH_DEBUG=true
```

### NextAuth APIルート (`/src/app/api/auth/[...nextauth]/route.ts`)
```typescript
import NextAuth from 'next-auth';
import { authOptions } from '@/lib/auth';

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
```

## 技術的な実装詳細

### 1. 認証フロー

#### プライマリ認証（Firebase）
```typescript
// Google認証
const loginWithGoogle = async () => {
  const provider = new GoogleAuthProvider();
  await signInWithPopup(auth, provider);
};

// GitHub認証  
const loginWithGithub = async () => {
  const provider = new GithubAuthProvider();
  await signInWithPopup(auth, provider);
};

// Email/Password認証
const login = async (email: string, password: string) => {
  await signInWithEmailAndPassword(auth, email, password);
};
```

#### セカンダリ連携（VRoid）
```typescript
// VRoidアカウント連携
const linkVRoidAccount = async () => {
  if (!user) {
    throw new Error('Firebase認証が必要です。先にログインしてください。');
  }

  const result = await signIn('vroid', {
    redirect: false,
    callbackUrl: '/dashboard'
  });

  if (result?.error) {
    throw new Error('VRoidアカウントの連携に失敗しました');
  }

  setLinkedAccounts(prev => [...prev.filter(acc => acc !== 'vroid'), 'vroid']);
};
```

### 2. 状態管理

#### 認証状態の判定
```typescript
// 統合認証状態
const isAuthenticated = user || nextAuthSession;

// VRoid連携状態
const isVRoidLinked = nextAuthSession?.provider === 'vroid' || linkedAccounts.includes('vroid');

// 現在のユーザー情報
const currentUser = user || nextAuthSession?.user;
```

#### セッション管理
```typescript
// Firebase セッション
useEffect(() => {
  const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
    setUser(firebaseUser);
    setLoading(nextAuthStatus === 'loading');
  });
  return unsubscribe;
}, [nextAuthStatus]);

// NextAuth セッション
const { data: nextAuthSession, status: nextAuthStatus } = useSession();
```

### 3. VRoid Hub API統合

#### OAuth 2.0設定
```typescript
// VRoidプロバイダー設定
{
  id: 'vroid',
  name: 'VRoid Hub',
  type: 'oauth',
  authorization: {
    url: 'https://hub.vroid.com/oauth/authorize',
    params: {
      scope: 'default',
      response_type: 'code',
    },
  },
  token: 'https://hub.vroid.com/oauth/token',
  userinfo: {
    url: 'https://hub.vroid.com/api/account',
    async request({ tokens, provider }) {
      const response = await fetch('https://hub.vroid.com/api/account', {
        headers: {
          'X-Api-Version': '11',
          'Authorization': `Bearer ${tokens.access_token}`,
        },
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`VRoid API error: ${response.status} ${errorText}`);
      }
      
      return await response.json();
    }
  },
  clientId: process.env.VROID_CLIENT_ID,
  clientSecret: process.env.VROID_CLIENT_SECRET,
  profile(profile: any) {
    return {
      id: profile.id?.toString() || profile.user_id?.toString() || 'unknown',
      name: profile.name || profile.display_name || 'Unknown User',
      email: profile.email || null,
      image: profile.icon?.sq170?.url || profile.avatar_url || null,
      vroidProfile: profile,
    };
  },
}
```

#### APIコールバック管理
```typescript
// JWT管理
async jwt({ token, user, account }) {
  if (account && user) {
    token.accessToken = account.access_token;
    token.refreshToken = account.refresh_token;
    token.provider = account.provider;
    
    if (account.provider === 'vroid') {
      token.vroidProfile = (user as any).vroidProfile;
    }
  }
  return token;
}

// セッション管理
async session({ session, token }) {
  session.accessToken = token.accessToken as string;
  session.refreshToken = token.refreshToken as string;
  session.provider = token.provider as string;
  
  if (token.vroidProfile) {
    session.vroidProfile = token.vroidProfile;
  }
  
  return session;
}
```

## デバッグとエラーハンドリング

### 1. デバッグログ
```typescript
// AuthProvider デバッグ
console.log('AuthProvider state:', {
  user: user ? 'Firebase user found' : 'No Firebase user',
  nextAuthSession: nextAuthSession ? 'NextAuth session found' : 'No NextAuth session',
  nextAuthStatus,
  loading,
  isVRoidLinked,
  linkedAccounts
});

// ProtectedRoute デバッグ
console.log('ProtectedRoute check:', {
  requireAuth,
  isAuthenticated,
  user: user ? 'Firebase user' : 'No Firebase user',
  nextAuthSession: nextAuthSession ? 'NextAuth session' : 'No NextAuth session',
  loading
});
```

### 2. エラーハンドリング
```typescript
// VRoid連携エラー
const handleLinkVRoid = async () => {
  try {
    await linkVRoidAccount();
  } catch (error: any) {
    console.error('VRoid連携エラー:', error);
    alert(error.message);
  }
};

// 一般的なFirebaseエラー
const getErrorMessage = (error: string) => {
  if (error.includes('auth/user-not-found')) {
    return 'ユーザーが見つかりません';
  } else if (error.includes('auth/wrong-password')) {
    return 'パスワードが間違っています';
  }
  // その他のエラーハンドリング...
  return error;
};
```

## テスト手順

### 1. Firebase認証テスト
```bash
1. http://localhost:3000 にアクセス
2. ログインページで Google/GitHub/Email のいずれかを選択
3. 認証完了後、ダッシュボードにリダイレクトされることを確認
4. ユーザー情報が正しく表示されることを確認
```

### 2. VRoidアカウント連携テスト
```bash
1. Firebase認証でログイン済みの状態でダッシュボードへ
2. 「VRoidアカウント連携」カードで連携状態が「未連携」であることを確認
3. 「VRoidアカウントを連携」ボタンをクリック
4. VRoid Hub OAuth認証を完了
5. 連携状態が「連携済み」に変わることを確認
6. 「V体を選択」ボタンが有効になることを確認
```

### 3. VRoid単体認証テスト
```bash
1. ログアウト状態でログインページへ
2. 「VRoid Hubでログイン」ボタンをクリック
3. VRoid Hub OAuth認証を完了
4. ダッシュボードにリダイレクトされることを確認
5. VRoidバッジが表示されることを確認
```

## パフォーマンス最適化

### 1. セッション管理の最適化
```typescript
// ロード状態の最適化
useEffect(() => {
  if (!auth) {
    setLoading(nextAuthStatus === 'loading');
    return;
  }

  const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
    setUser(firebaseUser);
    setLoading(nextAuthStatus === 'loading');
  });

  return unsubscribe;
}, [nextAuthStatus]);
```

### 2. 条件付きレンダリング
```typescript
// 認証状態に基づく条件付きレンダリング
{isVRoidLinked ? (
  <VRoidLinkedUI />
) : (
  <VRoidLinkButton />
)}

// 機能の有効/無効制御
<Button disabled={!isVRoidLinked}>
  V体を選択
</Button>
```

## セキュリティ実装

### 1. 環境変数保護
- クライアントサイド変数: `NEXT_PUBLIC_` プレフィックス
- サーバーサイド変数: NextAuth secrets

### 2. CSRF保護
- NextAuth内蔵のCSRF保護
- Firebase Auth内蔵のセキュリティ

### 3. トークン管理
- Firebase: 自動リフレッシュ
- NextAuth: JWT with refresh token

## 今後の改善点

### 1. データベース統合
```typescript
// ユーザープロフィール永続化
interface UserProfile {
  uid: string;
  firebaseUid?: string;
  vroidUserId?: string;
  linkedAccounts: string[];
  preferences: UserPreferences;
}
```

### 2. エラー改善
```typescript
// より詳細なエラーハンドリング
try {
  await linkVRoidAccount();
} catch (error) {
  if (error instanceof VRoidAPIError) {
    // VRoid固有のエラー処理
  } else if (error instanceof FirebaseError) {
    // Firebase固有のエラー処理
  }
}
```

### 3. UI/UX改善
- ローディングインジケーターの改善
- エラーメッセージのtoast表示
- 認証状態のリアルタイム更新

## 総括

Task 2.2「NextAuth設定とVroid OAuth認証」は、以下の成果をもって完了しました：

✅ **ハイブリッド認証システムの実装**
✅ **VRoidアカウントリンク機能の実装**  
✅ **統合認証状態管理の実装**
✅ **ユーザーフレンドリーなUI/UXの提供**
✅ **セキュアなOAuth 2.0フローの実装**
✅ **包括的なエラーハンドリング**
✅ **デバッグ機能とログの実装**

これにより、ユーザーは柔軟な認証オプションを選択でき、VRoidモデルへのアクセスも含めたフル機能のV-Chatアプリケーションを利用できるようになりました。