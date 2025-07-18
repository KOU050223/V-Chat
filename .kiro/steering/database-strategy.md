# V-Chat データベース戦略

## データベース選択の理由

### なぜFirestoreをメインに選ぶか

#### 1. **V-Chatの特性に最適**
- **リアルタイム性**: ビデオ通話、プレゼンス管理が核心機能
- **Firebase統合**: 認証、ストレージとの親和性
- **スケーラビリティ**: 自動スケーリング、グローバル展開対応
- **開発速度**: MVPの迅速な開発

#### 2. **要件との適合性**
```typescript
// V-Chatで重要な機能
- ユーザープレゼンス（オンライン/オフライン）
- リアルタイムマッチング状態
- 通話ルームの参加者管理
- VRMモデルの選択・設定
```

#### 3. **PostgreSQLが必要な場面は限定的**
- 複雑な分析クエリ → 将来の機能
- 大量データの集計 → 初期段階では不要
- 複雑なJOIN → Firestoreでも代替可能

## 推奨データベース構成

### メインデータベース: Firestore

```typescript
// Firestore Collections Structure
/users/{userId}
  - email: string
  - username: string
  - displayName: string
  - gender?: 'male' | 'female' | 'other'
  - status: 'online' | 'offline' | 'in_call' | 'matching'
  - currentRoomId?: string
  - selectedVrmId?: string
  - preferences: {
    - matchingGender?: string
    - notifications: boolean
  }
  - createdAt: timestamp
  - updatedAt: timestamp
  - lastActiveAt: timestamp

/vrmModels/{vrmId}
  - vroidModelId: string
  - name: string
  - description: string
  - authorName: string
  - thumbnailUrl: string
  - vrmFileUrl?: string
  - cloudflareR2Key?: string
  - license: {
    - type: string
    - allowModification: boolean
    - allowRedistribution: boolean
    - requireCredit: boolean
  }
  - tags: string[]
  - ageLimit: {
    - isR18: boolean
    - isR15: boolean
  }
  - isPublic: boolean
  - downloadCount: number
  - createdAt: timestamp
  - syncedAt: timestamp

/rooms/{roomId}
  - type: 'random' | 'select'
  - roomCode?: string // for select matching
  - createdBy: string
  - participants: string[] // user IDs
  - maxParticipants: number
  - livekitRoomName: string
  - status: 'waiting' | 'active' | 'closed'
  - createdAt: timestamp
  - expiresAt?: timestamp

/matchingQueue/{userId}
  - userId: string
  - preferences: {
    - gender?: string
    - ageRange?: [number, number]
  }
  - priority: number
  - createdAt: timestamp
  - expiresAt: timestamp

/callSessions/{sessionId}
  - roomId: string
  - participants: string[]
  - startedAt: timestamp
  - endedAt?: timestamp
  - durationSeconds?: number
  - qualityMetrics?: {
    - avgFps: number
    - connectionQuality: string
    - audioQuality: string
  }
  - endReason?: 'normal' | 'timeout' | 'error'

// Subcollections for better organization
/users/{userId}/vrmSettings/{settingId}
  - vrmModelId: string
  - isPrimary: boolean
  - customSettings: {
    - position: [number, number, number]
    - scale: number
    - animations: object
  }
  - createdAt: timestamp

/users/{userId}/sessions/{sessionId}
  - deviceInfo: object
  - ipAddress: string
  - userAgent: string
  - firebaseToken: string
  - livekitToken?: string
  - currentRoomId?: string
  - createdAt: timestamp
  - expiresAt: timestamp
  - lastActivityAt: timestamp
```

### キャッシュ・セッション: Redis (Upstash)

```typescript
// Redis Data Structures
interface RedisStructures {
  // Real-time presence (String with TTL)
  "presence:user:{userId}": "online" | "offline" | "in_call" | "matching"
  // TTL: 30 seconds
  
  // Matching queue (Sorted Set)
  "matching:queue:random": {
    score: timestamp,
    member: userId
  }
  
  // Room presence (Hash)
  "room:presence:{roomId}": {
    [userId]: {
      joinedAt: timestamp,
      lastSeen: timestamp,
      status: "active" | "inactive"
    }
  }
  
  // Motion data cache (Hash with TTL)
  "motion:{roomId}:{userId}": {
    timestamp: number,
    faceData: string, // JSON
    poseData: string, // JSON
    handData: string  // JSON
  }
  // TTL: 60 seconds
  
  // Rate limiting (String with TTL)
  "ratelimit:{endpoint}:{userId}": number
  // TTL: based on rate limit window
  
  // LiveKit tokens (String with TTL)
  "livekit:token:{roomId}:{userId}": string
  // TTL: 1 hour
}
```

## データアクセスパターン

### 1. **リアルタイム機能**
```typescript
// Firestore Realtime Listeners
const unsubscribePresence = onSnapshot(
  doc(db, 'users', userId),
  (doc) => {
    const userData = doc.data();
    updateUserPresence(userData.status);
  }
);

const unsubscribeRoom = onSnapshot(
  doc(db, 'rooms', roomId),
  (doc) => {
    const roomData = doc.data();
    updateRoomParticipants(roomData.participants);
  }
);
```

### 2. **マッチング機能**
```typescript
// Redis + Firestore combination
async function findMatch(userId: string): Promise<string | null> {
  // 1. Add to Redis queue for fast matching
  await redis.zadd('matching:queue:random', Date.now(), userId);
  
  // 2. Try to find match from queue
  const candidates = await redis.zrange('matching:queue:random', 0, 10);
  
  // 3. Create room in Firestore
  const roomRef = await addDoc(collection(db, 'rooms'), {
    type: 'random',
    participants: [userId, matchedUserId],
    status: 'waiting',
    createdAt: serverTimestamp()
  });
  
  return roomRef.id;
}
```

### 3. **VRM管理**
```typescript
// Firestore with periodic sync from VroidHub
async function syncVRMFromVroidHub(vroidModelId: string) {
  const vroidData = await fetchFromVroidHub(vroidModelId);
  
  await setDoc(doc(db, 'vrmModels', vroidModelId), {
    ...vroidData,
    syncedAt: serverTimestamp()
  }, { merge: true });
}

// Scheduled function to sync popular models
export const syncPopularVRMs = functions.pubsub
  .schedule('every 6 hours')
  .onRun(async () => {
    const popularModels = await getPopularVRMsFromVroidHub();
    // Batch update Firestore
  });
```

## セキュリティルール

```javascript
// Firestore Security Rules
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users can only access their own data
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
      allow read: if request.auth != null; // for presence/matching
    }
    
    // VRM models are publicly readable
    match /vrmModels/{vrmId} {
      allow read: if true;
      allow write: if false; // Only via Cloud Functions
    }
    
    // Room access control
    match /rooms/{roomId} {
      allow read, write: if request.auth != null && 
        request.auth.uid in resource.data.participants;
    }
    
    // Matching queue
    match /matchingQueue/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
      allow read: if request.auth != null; // for matching algorithm
    }
    
    // Call sessions (read-only for users)
    match /callSessions/{sessionId} {
      allow read: if request.auth != null && 
        request.auth.uid in resource.data.participants;
      allow write: if false; // Only via Cloud Functions
    }
  }
}
```

## パフォーマンス最適化

### 1. **Firestore最適化**
```typescript
// Composite indexes for efficient queries
// users: status, lastActiveAt
// rooms: status, createdAt
// matchingQueue: createdAt, preferences.gender
// vrmModels: isPublic, tags (array-contains)

// Pagination for large datasets
const getVRMModels = (lastDoc?: DocumentSnapshot) => {
  let query = collection(db, 'vrmModels')
    .where('isPublic', '==', true)
    .orderBy('downloadCount', 'desc')
    .limit(20);
    
  if (lastDoc) {
    query = query.startAfter(lastDoc);
  }
  
  return getDocs(query);
};
```

### 2. **Redis最適化**
```typescript
// Use Redis for high-frequency operations
const updateUserPresence = async (userId: string, status: string) => {
  // Update Redis immediately
  await redis.setex(`presence:user:${userId}`, 30, status);
  
  // Batch update Firestore (less frequent)
  await batch.update(doc(db, 'users', userId), {
    status,
    lastActiveAt: serverTimestamp()
  });
};
```

## 移行戦略

### フェーズ1: Firestore Only
- 基本機能の実装
- MVP リリース
- ユーザーフィードバック収集

### フェーズ2: Redis 追加
- リアルタイム機能の最適化
- マッチング性能向上
- スケーラビリティ対応

### フェーズ3: 分析機能（オプション）
- PostgreSQL 追加検討
- 詳細分析・レポート機能
- ビジネスインテリジェンス

## 結論

V-Chatの要件と特性を考慮すると、**Firestore + Redis**の組み合わせが最適です：

- **Firestore**: メインデータ、リアルタイム機能
- **Redis**: キャッシュ、セッション、高頻度操作
- **PostgreSQL**: 将来の分析機能（オプション）

この構成により、開発速度、スケーラビリティ、コストのバランスが取れた設計が実現できます。