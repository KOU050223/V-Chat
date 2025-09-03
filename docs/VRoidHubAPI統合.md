# VRoid Hub API統合ガイド

## 概要

V-ChatアプリケーションにVRoid Hub APIを統合し、ユーザーが投稿した・いいねしたVRMモデルをアプリ内で使用できるようにします。

参考リポジトリ: [pixiv/VRoidHub-API-Example](https://github.com/pixiv/VRoidHub-API-Example)

## 実装目標

1. **ユーザーが投稿したモデル取得**: ユーザー自身が投稿したVRMモデル一覧を取得
2. **ユーザーがいいねしたモデル取得**: ユーザーがハートを付けたモデル一覧を取得
3. **モデル検索機能**: 公開モデルの検索とフィルタリング
4. **VRMファイルダウンロード**: ライセンス確認付きでのVRMファイル取得
5. **3D表示統合**: @pixiv/three-vrmを使用した3D表示

## VRoid Hub開発者設定

### 1. 開発者登録
1. VRoid Hubにアクセス
2. 開発者アカウントを登録
3. OAuth アプリケーションを作成

### 2. OAuth設定
- **スコープ**: `default`（基本情報とモデル一覧取得）
- **リダイレクトURI**: `http://localhost:3000/api/auth/callback/vroid`
- **本番環境**: `https://yourdomain.com/api/auth/callback/vroid`

### 3. 環境変数設定
```bash
# .env.local
VROID_CLIENT_ID=your_client_id
VROID_CLIENT_SECRET=your_client_secret
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your_nextauth_secret
```

## API実装

### 主要エンドポイント

#### 1. ユーザーが投稿したモデル一覧
```typescript
GET /api/account/character_models
```

**パラメータ:**
- `max_id`: ページネーション用の最大ID
- `count`: 取得件数（デフォルト20、最大100）
- `publication`: 公開状態フィルタ（'all' | 'public' | 'private'）

#### 2. ユーザーがいいねしたモデル一覧
```typescript
GET /api/hearts
```

**パラメータ:**
- `application_id`: 必須のアプリケーションID
- `max_id`: ページネーション用の最大ID
- `count`: 取得件数（デフォルト20、最大100）
- `is_downloadable`: ダウンロード可能フィルタ
- ライセンス関連フィルタ（性的表現、暴力表現、商用利用など）

#### 3. モデル検索
```typescript
GET /api/search/character_models
```

**パラメータ:**
- `keyword`: 検索キーワード（必須）
- `search_after[]`: ページネーション
- `count`: 取得件数
- `sort`: ソート順（'relevance' | 'publication_time'）
- ライセンス関連フィルタ

#### 4. ダウンロードライセンス取得（新API仕様）
```typescript
POST /api/download_licenses
```

**ヘッダー:**
- `X-Api-Version: 11` （必須）
- `Authorization: Bearer {access_token}`
- `Content-Type: application/json`

**リクエストボディ:**
```typescript
{
  character_model_id: string; // ダウンロードしたいモデルID
}
```

**レスポンス:**
```typescript
{
  data: {
    id: string;                    // ライセンスID
    character_model_id: string;    // モデルID
    character_model_version_id: string;
    is_public_visibility: boolean;
    is_private_visibility: boolean;
    expires_at: string;           // 有効期限
  },
  error: {
    code: string;
    message: string;
    details: {};
  },
  _links: {
    next?: {
      href: string;
    }
  },
  rand: string;
}
```

#### 5. VRMファイルダウンロード
```typescript
GET /api/download_licenses/{license_id}/download
```

**ヘッダー:**
- `X-Api-Version: 11` （必須）
- `Authorization: Bearer {access_token}`

**レスポンス:** 302リダイレクト（AWS S3のpresigned URLへ）

## 使用フロー

### 1. OAuth認証
```typescript
// NextAuthを使用したVRoid Hub認証
import { signIn } from 'next-auth/react';

const handleVRoidLogin = async () => {
  await signIn('vroid', { 
    redirect: false,
    callbackUrl: '/dashboard'
  });
};
```

### 2. APIクライアント作成
```typescript
import { createVRoidClient } from '@/lib/vroid';
import { useSession } from 'next-auth/react';

const { data: session } = useSession();
const vroidClient = createVRoidClient(session);
```

### 3. モデル一覧取得
```typescript
// ユーザーが投稿したモデル
const myModels = await vroidClient.getMyCharacterModels({
  count: 20,
  publication: 'all'
});

// ユーザーがいいねしたモデル
const likedModels = await vroidClient.getLikedCharacterModels({
  application_id: process.env.VROID_CLIENT_ID!,
  count: 20,
  is_downloadable: true
});
```

### 4. VRMファイルダウンロード
```typescript
// ダウンロードライセンス取得
const license = await vroidClient.getCharacterModelDownloadLicense(modelId);

// VRMファイルをダウンロード
const response = await fetch(license.data.url);
const vrmBlob = await response.blob();
```

### 5. 3D表示
```typescript
import { VRMLoader } from '@pixiv/three-vrm';
import * as THREE from 'three';

// VRMローダーでモデルを読み込み
const loader = new VRMLoader();
const vrm = await loader.loadAsync(vrmUrl);

// Three.jsシーンに追加
scene.add(vrm.scene);
```

## データ型定義

### VRoidCharacterModel
```typescript
interface VRoidCharacterModel {
  id: string;
  name: string | null;
  is_private: boolean;
  is_downloadable: boolean;
  is_hearted: boolean;
  portrait_image: {
    original: { url: string; width: number; height: number };
    w600: { url: string; width: number; height: number };
    sq300: { url: string; width: number; height: number };
  };
  character: {
    id: string;
    name: string;
    user: VRoidUser;
  };
  license?: {
    modification: 'default' | 'disallow' | 'allow';
    sexual_expression: 'default' | 'disallow' | 'allow';
    commercial_use: 'default' | 'disallow' | 'allow';
    // その他ライセンス項目
  };
  created_at: string;
  heart_count: number;
  download_count: number;
  tags: Array<{
    name: string;
    locale: string | null;
  }>;
}
```

## ライセンス考慮事項

### 使用前チェック項目
1. **ダウンロード可能性**: `is_downloadable`フラグの確認
2. **使用許可**: `characterization_allowed_user`の確認
3. **商用利用**: `commercial_use`関連フラグの確認
4. **表現制限**: `sexual_expression`、`violent_expression`の確認
5. **改変許可**: `modification`フラグの確認

### 実装例
```typescript
const canUseModel = (model: VRoidCharacterModel): boolean => {
  if (!model.is_downloadable) return false;
  if (!model.is_other_users_available) return false;
  
  // アプリの用途に応じた追加チェック
  const license = model.license;
  if (license?.sexual_expression === 'disallow') return false;
  if (license?.violent_expression === 'disallow') return false;
  
  return true;
};
```

## UI実装指針

### 1. モデル一覧表示
- サムネイル画像（portrait_image.sq300）
- モデル名、作者名
- いいね数、ダウンロード数
- ライセンス情報の視覚的表示

### 2. フィルタリング機能
- ダウンロード可能なもののみ
- ライセンス条件による絞り込み
- タグによる検索

### 3. プレビュー機能
- 3Dプレビュー（使用許可があるもの）
- ライセンス詳細情報の表示
- 使用可否の明確な表示

## セキュリティ考慮事項

1. **アクセストークン管理**: 適切な有効期限とリフレッシュ
2. **ライセンス遵守**: 各モデルの使用条件の厳格な確認
3. **ダウンロードURL**: 期限付きURLの適切な管理
4. **ユーザー権限**: アプリケーションのスコープ内での使用に限定

## 参考リンク

- [VRoid Hub API リファレンス](https://developer.vroid.com/en/api/)
- [VRoidHub-API-Example](https://github.com/pixiv/VRoidHub-API-Example)
- [@pixiv/three-vrm ドキュメント](https://github.com/pixiv/three-vrm)
- [NextAuth.js ドキュメント](https://next-auth.js.org/)