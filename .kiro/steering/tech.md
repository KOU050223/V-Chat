# V-Chat 技術仕様

## アーキテクチャ概要

### システム構成
```
┌─────────────────────────────────────────────────────────────────┐
│                        Frontend (Browser)                       │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  │
│  │   Next.js UI    │  │ React Three     │  │   MediaPipe     │  │
│  │   - React 19    │  │   Fiber         │  │   Holistic      │  │
│  │   - TypeScript  │  │ - 3D Rendering  │  │ - Motion Cap    │  │
│  │   - Tailwind v4 │  │ - VRM Loading   │  │ - Face Tracking │  │
│  │   - shadcn/ui   │  │ - Animations    │  │ - Pose Detect   │  │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘  │
│                                │                                │
│  ┌─────────────────────────────┼─────────────────────────────┐  │
│  │           LiveKit Client SDK                              │  │
│  │         - WebRTC P2P Communication                        │  │
│  │         - Real-time Motion Data Streaming                 │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Firebase Ecosystem                           │
│                                                                 │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  │
│  │ Firebase Auth   │  │ Cloud Firestore │  │ Firebase Storage│  │
│  │ - User Auth     │  │ - Real-time DB  │  │ - VRM Files     │  │
│  │ - JWT Tokens    │  │ - User Data     │  │ - Images        │  │
│  │ - Social Login  │  │ - Room Data     │  │ - Assets        │  │
│  │ - Session Mgmt  │  │ - Presence      │  │ - CDN Delivery  │  │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘  │
│                                                                 │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  │
│  │ Cloud Functions │  │   LiveKit       │  │ Upstash Redis   │  │
│  │ - Business      │  │   Cloud SFU     │  │ - Fast Cache    │  │
│  │   Logic         │  │ - Video Rooms   │  │ - Matching      │  │
│  │ - VRM Sync      │  │ - WebRTC Relay  │  │ - Sessions      │  │
│  │ - Cleanup Jobs  │  │ - Quality Adapt │  │ - Rate Limiting │  │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘  │
│                                                                 │
│  ┌─────────────────┐  ┌─────────────────┐                      │
│  │ Firebase Host   │  │ VroidHub API    │                      │
│  │ - Static Site   │  │ - Avatar Models │                      │
│  │ - CDN           │  │ - Model Metadata│                      │
│  │ - SSL/HTTPS     │  │ - License Info  │                      │
│  └─────────────────┘  └─────────────────┘                      │
└─────────────────────────────────────────────────────────────────┘
```

## フロントエンド技術スタック

### コア技術
- **Next.js 15**: App Router使用、SSR/SSG最適化
- **React 19**: 最新機能活用（Concurrent Features等）
- **TypeScript 5**: 厳密な型チェック、最新構文対応

### スタイリング
- **Tailwind CSS v4**: 新しい@import構文、CSS変数活用
- **shadcn/ui**: 一貫したデザインシステム
- **Lucide React**: アイコンライブラリ

### 3D・グラフィックス
- **Three.js**: 3D描画エンジン
- **React Three Fiber**: React統合
- **@react-three/drei**: 便利なヘルパー
- **VRM**: アバター形式対応（将来実装）

### 状態管理
- **React Context**: グローバル状態管理
- **useState/useReducer**: ローカル状態管理

## バックエンド技術スタック

### Firebase エコシステム（メイン）

#### Core Firebase Services
- **Firebase Authentication**: ユーザー認証（Email, Google, GitHub）
- **Cloud Firestore**: メインデータベース（NoSQL）
- **Firebase Storage**: VRMファイル・画像ストレージ
- **Firebase Hosting**: 静的サイトホスティング
- **Cloud Functions**: サーバーレス関数・ビジネスロジック

#### 補完サービス
- **Upstash Redis**: 高速キャッシュ・リアルタイムマッチング
- **LiveKit Cloud**: WebRTC SFU・ビデオ通話
- **VroidHub API**: アバターモデル取得

### リアルタイム通信
- **LiveKit Cloud**: WebRTC SFU
- **Firestore Real-time**: データ同期

## データベース設計

### Firestore コレクション構造

#### Core Collections

```typescript
// Users collection
/users/{userId}
{
  email: string;
  username: string; // unique, validated by Cloud Function
  displayName: string;
  gender?: 'male' | 'female' | 'other';
  status: 'online' | 'offline' | 'in_call' | 'matching';
  currentRoomId?: string;
  selectedVrmId?: string;
  preferences: {
    matchingGender?: 'male' | 'female' | 'any';
    notifications: boolean;
    language: string;
  };
  createdAt: Timestamp;
  updatedAt: Timestamp;
  lastActiveAt: Timestamp;
}

// VRM Models collection (cached from VroidHub)
/vrmModels/{vrmId}
{
  vroidModelId: string; // from VroidHub API
  name: string;
  description: string;
  authorName: string;
  authorVroidId: string;
  thumbnailUrl: string;
  vrmFileUrl?: string; // Firebase Storage URL after download
  license: {
    type: string;
    allowModification: boolean;
    allowRedistribution: boolean;
    requireCredit: boolean;
    commercialUse: boolean;
  };
  tags: string[];
  ageLimit: {
    isR18: boolean;
    isR15: boolean;
    isAdult: boolean;
  };
  isDownloadable: boolean;
  isPublic: boolean;
  stats: {
    triangleCount: number;
    fileSizeBytes: number;
    heartCount: number;
    downloadCount: number;
  };
  syncedAt: Timestamp;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// Rooms collection
/rooms/{roomId}
{
  type: 'random' | 'select';
  roomCode?: string; // for select matching (6-digit code)
  createdBy: string; // userId
  participants: string[]; // array of userIds
  maxParticipants: number; // default: 2
  livekitRoomName: string; // unique room name for LiveKit
  status: 'waiting' | 'active' | 'closed';
  settings: {
    allowSpectators: boolean;
    recordSession: boolean;
    maxDuration: number; // minutes
  };
  createdAt: Timestamp;
  expiresAt?: Timestamp;
  closedAt?: Timestamp;
}

// Room participants subcollection
/rooms/{roomId}/participants/{userId}
{
  userId: string;
  displayName: string;
  vrmModelId?: string;
  livekitParticipantId?: string;
  joinedAt: Timestamp;
  leftAt?: Timestamp;
  isActive: boolean;
  connectionQuality: {
    lastUpdate: Timestamp;
    bandwidth: number;
    latency: number;
    packetLoss: number;
  };
}

// Matching queue collection
/matchingQueue/{userId}
{
  userId: string;
  preferences: {
    gender?: 'male' | 'female' | 'any';
    ageRange?: [number, number];
    language?: string;
  };
  priority: number; // for premium users
  deviceInfo: {
    platform: string;
    browser: string;
    hasWebGL: boolean;
    hasMicrophone: boolean;
  };
  createdAt: Timestamp;
  expiresAt: Timestamp; // auto-delete after 5 minutes
}

// Call history collection
/callSessions/{sessionId}
{
  roomId: string;
  participants: string[]; // userIds
  startedAt: Timestamp;
  endedAt?: Timestamp;
  durationSeconds?: number;
  qualityMetrics: {
    averageBandwidth: number;
    averageLatency: number;
    packetLossRate: number;
    reconnectionCount: number;
    averageFps: number;
  };
  endReason: 'normal' | 'timeout' | 'error' | 'kicked';
  feedback?: {
    ratings: Record<string, number>; // userId -> rating
    comments: Record<string, string>;
  };
}

// User VRM settings subcollection
/users/{userId}/vrmSettings/{settingId}
{
  vrmModelId: string;
  isPrimary: boolean;
  customSettings: {
    position: [number, number, number];
    scale: number;
    animations: Record<string, any>;
  };
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// User sessions subcollection (for presence)
/users/{userId}/sessions/{sessionId}
{
  deviceId: string;
  platform: string;
  browser: string;
  ipAddress?: string; // hashed for privacy
  userAgent: string;
  firebaseToken: string;
  livekitToken?: string; // encrypted
  currentRoomId?: string;
  createdAt: Timestamp;
  expiresAt: Timestamp; // 24 hours
  lastActivityAt: Timestamp;
}
```

#### Firestore Indexes

```javascript
// Composite indexes needed for efficient queries (pseudocode, not actual Firestore index syntax)
// users: status, lastActiveAt (for online users)
// vrmModels: isPublic, downloadCount (for popular models)
// vrmModels: authorVroidId, createdAt (for author's models)
// vrmModels: tags (array-contains), isPublic (for search)
// rooms: status, type, createdAt (for active rooms)
// matchingQueue: createdAt (for FIFO matching)
// matchingQueue: preferences.gender, createdAt (for filtered matching)
// callSessions: participants (array-contains), startedAt (for user history)
```

#### Cloud Functions

```sql
-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply to relevant tables
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_vrm_models_updated_at BEFORE UPDATE ON vrm_models
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_user_vrm_settings_updated_at BEFORE UPDATE ON user_vrm_settings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Clean up expired matching queue entries
CREATE OR REPLACE FUNCTION cleanup_expired_matching_queue()
RETURNS void AS $$
BEGIN
    DELETE FROM matching_queue WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- Clean up expired sessions
CREATE OR REPLACE FUNCTION cleanup_expired_sessions()
RETURNS void AS $$
BEGIN
    DELETE FROM user_sessions WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- Update room participant count
CREATE OR REPLACE FUNCTION update_room_participant_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE rooms SET current_participants = current_participants + 1 
        WHERE id = NEW.room_id;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE rooms SET current_participants = current_participants - 1 
        WHERE id = OLD.room_id;
        RETURN OLD;
    ELSIF TG_OP = 'UPDATE' THEN
        -- Handle active status changes
        IF OLD.is_active = true AND NEW.is_active = false THEN
            UPDATE rooms SET current_participants = current_participants - 1 
            WHERE id = NEW.room_id;
        ELSIF OLD.is_active = false AND NEW.is_active = true THEN
            UPDATE rooms SET current_participants = current_participants + 1 
            WHERE id = NEW.room_id;
        END IF;
        RETURN NEW;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER room_participant_count_trigger
    AFTER INSERT OR UPDATE OR DELETE ON room_participants
    FOR EACH ROW EXECUTE FUNCTION update_room_participant_count();
```

### Redis データ構造 (Upstash Redis)

```typescript
// Real-time matching queue (Sorted Set)
// Key: "matching:queue:random"
// Score: timestamp, Member: userId
// ZADD matching:queue:random {timestamp} {userId}

// Active room presence (Hash)
// Key: "rooms:presence:{roomId}"
// Field: userId, Value: JSON.stringify({joinedAt, lastSeen, status})

// User online status (String with TTL)
// Key: "users:online:{userId}"
// Value: "online", TTL: 30 seconds

// Motion data cache (Stream)
// Key: "motion:{roomId}:{userId}"
// Fields: {timestamp, faceData, poseData, handData}
// TTL: 1 minute

// Room connection tokens (Hash with TTL)
// Key: "tokens:livekit:{roomId}"
// Field: userId, Value: token
// TTL: 1 hour

// Rate limiting (String with TTL)
// Key: "ratelimit:{endpoint}:{userId}"
// Value: request_count, TTL: based on rate limit window
```

### データ同期戦略

#### VroidHub API 同期
```typescript
interface VRMSyncJob {
  syncPopularModels(): Promise<void>;
  syncUserFavorites(userId: string): Promise<void>;
  syncModelDetails(vroidModelId: string): Promise<VRMModel>;
  schedulePeriodicSync(): void;
}

// Sync schedule:
// - Popular models: Every 6 hours
// - User favorites: On demand
// - Model details: On first access + weekly refresh
```

#### LiveKit 連携
```typescript
interface LiveKitIntegration {
  createRoom(roomId: string): Promise<string>; // returns livekit room name
  generateToken(roomId: string, userId: string): Promise<string>;
  getRoomInfo(livekitRoomName: string): Promise<RoomInfo>;
  handleWebhooks(event: LiveKitWebhookEvent): Promise<void>;
}

// Webhook events to handle:
// - participant_joined
// - participant_left
// - room_finished
// - track_published/unpublished
```

## セキュリティ設計

### Firebase Security Rules
```javascript
// Firestore Rules
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users can only access their own data
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Chat rooms access control
    match /chatRooms/{roomId} {
      allow read: if request.auth != null && 
        (resource.data.isPublic == true || 
         request.auth.uid in resource.data.participants);
      allow write: if request.auth != null && 
        request.auth.uid in resource.data.participants;
    }
    
    // Messages access control
    match /chatRooms/{roomId}/messages/{messageId} {
      allow read: if request.auth != null && 
        request.auth.uid in get(/databases/$(database)/documents/chatRooms/$(roomId)).data.participants;
      allow create: if request.auth != null && 
        request.auth.uid == resource.data.userId;
    }
  }
}
```

### 認証設計
- **JWT Token**: Firebase Authentication
- **Session Management**: Firebase Auth SDK
- **CSRF Protection**: Firebase内蔵機能
- **Rate Limiting**: Cloud Functions（将来実装）

## パフォーマンス最適化

### フロントエンド最適化
- **Code Splitting**: Next.js動的インポート
- **Image Optimization**: Next.js Image コンポーネント
- **Bundle Analysis**: webpack-bundle-analyzer
- **Lazy Loading**: React.lazy、Intersection Observer

### 3D描画最適化
- **LOD (Level of Detail)**: 距離に応じた詳細度調整
- **Frustum Culling**: 視界外オブジェクト除外
- **Texture Compression**: 適切な画像形式選択
- **Geometry Optimization**: ポリゴン数最適化

### データベース最適化
- **Query Optimization**: 適切なインデックス設計
- **Data Pagination**: 大量データの分割読み込み
- **Caching Strategy**: ブラウザキャッシュ活用
- **Offline Support**: Service Worker（将来実装）

## 開発・デプロイメント

### 開発環境
- **Node.js**: v18以上
- **npm**: パッケージ管理
- **Git**: バージョン管理
- **ESLint/Prettier**: コード品質管理

### CI/CD パイプライン（将来実装）
```yaml
# GitHub Actions例
name: Deploy to Firebase
on:
  push:
    branches: [main]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Setup Node.js
        uses: actions/setup-node@v2
        with:
          node-version: '18'
      - name: Install dependencies
        run: npm ci
      - name: Run tests
        run: npm test
      - name: Build
        run: npm run build
      - name: Deploy to Firebase
        uses: FirebaseExtended/action-hosting-deploy@v0
```

### 環境管理
- **Development**: ローカル開発環境
- **Staging**: Firebase Hosting Preview
- **Production**: Firebase Hosting

## モニタリング・ログ

### パフォーマンス監視
- **Core Web Vitals**: LCP, FID, CLS測定
- **Firebase Performance**: アプリパフォーマンス監視
- **Google Analytics**: ユーザー行動分析

### エラー監視
- **Firebase Crashlytics**: クラッシュレポート
- **Console Logging**: 開発時デバッグ
- **Error Boundaries**: React エラーハンドリング

## スケーラビリティ考慮

### 水平スケーリング
- **Firebase Auto Scaling**: 自動スケーリング
- **CDN**: Firebase Hosting CDN
- **Load Balancing**: Firebase内蔵機能

### データ分散
- **Firestore Multi-region**: 地域分散
- **Sharding Strategy**: 大規模データ分割
- **Cache Strategy**: Redis（将来検討）

## 技術的制約・課題

### ブラウザ制約
- **WebGL対応**: 古いブラウザサポート
- **メモリ制限**: モバイルデバイス対応
- **帯域制限**: 3Dデータ最適化

### Firebase制限
- **Firestore制限**: 1MB/document、1秒/write
- **Storage制限**: ファイルサイズ上限
- **Function制限**: 実行時間・メモリ制限

### 3D描画制約
- **ポリゴン数**: デバイス性能に応じた調整
- **テクスチャサイズ**: メモリ使用量最適化
- **アニメーション**: フレームレート維持

## 将来技術検討

### 新技術導入
- **WebAssembly**: 高性能計算処理
- **WebXR**: VR/AR対応
- **WebCodecs**: 動画処理最適化
- **Shared Array Buffer**: マルチスレッド処理

### AI/ML統合
- **TensorFlow.js**: ブラウザ内機械学習
- **MediaPipe**: リアルタイム表情認識
- **Natural Language Processing**: チャット分析