# V-Chat 統合アーキテクチャ図

## 現在のシステム概要アーキテクチャ

```mermaid
graph TB
    %% ユーザー層
    subgraph "ユーザー層"
        User1[ユーザー1]
        User2[ユーザー2]
    end

    %% フロントエンド層
    subgraph "フロントエンド (Next.js 15)"
        subgraph "React Components"
            AuthUI[認証UI]
            DashboardUI[ダッシュボード]
            MatchingUI[マッチングUI]
            RoomUI[ルームUI]
            VModelUI[VRMモデルUI]
        end
        
        subgraph "3D Avatar System"
            R3F[React Three Fiber]
            VRM[VRM Loader]
            MediaPipe[MediaPipe Holistic]
            Motion[モーションキャプチャ]
        end
        
        subgraph "Real-time Communication"
            LiveKitClient[LiveKit Client SDK]
            WebRTC[WebRTC P2P]
            WebSocketClient[Standard WebSocket]
        end
    end

    %% バックエンド層
    subgraph "バックエンド"
        subgraph "Next.js API Routes"
            AuthAPI[認証API]
            RoomAPI[ルームAPI]
            VRoidAPI[VRoid API Proxy]
        end
        
        subgraph "WebSocket Server (Go)"
            GoServer[Go WebSocket Server]
            MatchingEngine[マッチングエンジン]
        end
        
        subgraph "Core Services"
            AuthService[認証サービス]
            MatchingService[マッチングサービス]
            VRMCache[VRMキャッシュ]
            RoomStore[ルームストア]
        end
    end

    %% データ層
    subgraph "データ層"
        Redis[(Upstash Redis)]
        PostgreSQL[(Neon PostgreSQL)]
    end

    %% 外部サービス
    subgraph "外部サービス"
        Firebase[Firebase Auth]
        VRoidHub[VRoid Hub API]
        LiveKitCloud[LiveKit Cloud]
        CloudflareR2[Cloudflare R2]
    end

    %% 接続関係
    User1 --> AuthUI
    User2 --> AuthUI
    User1 --> DashboardUI
    User2 --> DashboardUI
    
    AuthUI --> AuthAPI
    DashboardUI --> RoomAPI
    MatchingUI --> GoServer
    RoomUI --> LiveKitClient
    VModelUI --> VRoidAPI
    
    R3F --> VRM
    MediaPipe --> Motion
    Motion --> LiveKitClient
    
    LiveKitClient --> WebRTC
    WebSocketClient --> GoServer
    
    AuthAPI --> Firebase
    VRoidAPI --> VRoidHub
    LiveKitClient --> LiveKitCloud
    
    MatchingEngine --> Redis
    AuthService --> Firebase
    VRMCache --> CloudflareR2
    RoomStore --> PostgreSQL
    
    GoServer --> MatchingService
    MatchingService --> Redis
```

## 詳細コンポーネントアーキテクチャ

```mermaid
graph TB
    %% フロントエンドアーキテクチャ詳細
    subgraph "Frontend Architecture"
        subgraph "Pages (App Router)"
            LoginPage["/login - ログインページ"]
            DashPage["/dashboard - ダッシュボード"]
            MatchPage["/matching - マッチング画面"]
            RoomPage["/room/[id] - ルーム画面"]
            TestPage["/debug - デバッグ画面"]
        end
        
        subgraph "Components Structure"
            subgraph "UI Components"
                Button[Button]
                Dialog[Dialog]
                Avatar[Avatar]
                Select[Select]
            end
            
            subgraph "Feature Components"
                AuthComp[認証コンポーネント]
                MatchingComp[マッチングコンポーネント]
                VModelComp[VRMモデルコンポーネント]
                VoiceComp[音声コンポーネント]
            end
            
            subgraph "Providers"
                AuthProvider[認証プロバイダー]
                WebSocketProvider[WebSocket Provider]
            end
        end
        
        subgraph "Hooks & Context"
            AuthHook[useAuth]
            WebSocketHook[useWebSocket]
            VRMHook[useVRM]
        end
    end
    
    %% バックエンドアーキテクチャ詳細
    subgraph "Backend Architecture"
        subgraph "API Endpoints"
            AuthEndpoint["/api/auth/*"]
            RoomEndpoint["/api/room/*"]
            VRoidEndpoint["/api/vroid/*"]
            LiveKitEndpoint["/api/livekit/*"]
        end
        
        subgraph "WebSocket Events"
            JoinMatching["join-matching"]
            LeaveMatching["leave-matching"]
            MatchFound["match-found"]
            GetStats["get-stats"]
        end
        
        subgraph "Core Libraries"
            VRoidLib[VRoid API Client]
            MatchingLib[マッチングサービス]
            AuthLib[認証ライブラリ]
            VRMLib[VRMキャッシュ・管理]
        end
    end
    
    %% データフローアーキテクチャ
    subgraph "Data Flow"
        subgraph "Authentication Flow"
            A1[ユーザーログイン] --> A2[Firebase Auth]
            A2 --> A3[NextAuth Session]
            A3 --> A4[VRoid OAuth]
            A4 --> A5[アクセストークン取得]
        end
        
        subgraph "Matching Flow"
            M1[マッチング参加] --> M2[Redis Queue]
            M2 --> M3[マッチング検索]
            M3 --> M4[マッチ成立]
            M4 --> M5[ルーム作成]
        end
        
        subgraph "VRM Flow"
            V1[VRMリクエスト] --> V2[VRoid Hub API]
            V2 --> V3[ライセンス取得]
            V3 --> V4[VRMダウンロード]
            V4 --> V5[Cloudflare R2保存]
        end
    end
```

## 技術スタック詳細

```mermaid
mindmap
    root((V-Chat))
        Frontend
            Framework
                Next.js 15
                React 19
                TypeScript
            Styling
                Tailwind CSS v4
                shadcn/ui
                new-york style
            3D & Media
                React Three Fiber
                @pixiv/three-vrm
                Three.js
                MediaPipe Holistic
            Real-time
                LiveKit Client SDK
                Standard WebSocket
                WebRTC
        Backend
            Runtime
                Node.js
                Go
                Next.js API Routes
            Authentication
                NextAuth.js
                Firebase Auth
                VRoid Hub OAuth
            Real-time
                Go
                LiveKit Server SDK
            Data Processing
                VRM Processing
                Motion Data
                Matching Algorithm
        Data & Storage
            Database
                Neon PostgreSQL
            Cache
                Upstash Redis
            File Storage
                Cloudflare R2
        External Services
            Authentication
                Firebase Auth
                VRoid Hub API
            Communication
                LiveKit Cloud
            Storage
                Cloudflare R2
```

## データベース設計

```mermaid
erDiagram
    USERS {
        string id PK
        string firebase_uid
        string vroid_user_id
        string name
        string email
        timestamp created_at
        timestamp updated_at
    }
    
    ROOMS {
        string id PK
        string name
        string type
        string status
        timestamp created_at
        timestamp expires_at
    }
    
    MATCHES {
        string id PK
        string room_id FK
        string user1_id FK
        string user2_id FK
        string status
        timestamp created_at
        timestamp matched_at
    }
    
    VRM_MODELS {
        string id PK
        string user_id FK
        string vroid_model_id
        string file_path
        string license_info
        timestamp cached_at
        timestamp expires_at
    }
    
    USER_PREFERENCES {
        string id PK
        string user_id FK
        json preferences
        timestamp updated_at
    }
    
    USERS ||--o{ MATCHES : "participates"
    ROOMS ||--o{ MATCHES : "hosts"
    USERS ||--o{ VRM_MODELS : "owns"
    USERS ||--|| USER_PREFERENCES : "has"
```

## システムの主要な特徴

### 1. マイクロサービス志向
- フロントエンド（Next.js）とWebSocketサーバー（Go）の分離
- 各機能ごとのサービス分離（認証、マッチング、VRM処理）

### 2. リアルタイム通信
- Go製WebSocketサーバーによるリアルタイム通信
- LiveKitによる音声・映像通信
- WebRTCによるP2P通信

### 3. 3Dアバターシステム
- VRM形式のサポート
- MediaPipeによるモーションキャプチャ
- React Three Fiberによる3D描画

### 4. 外部サービス統合
- VRoid Hub APIによるアバター取得
- Firebase Authenticationによる認証
- Cloudflare R2によるファイル保存

### 5. スケーラブルな設計
- Redis（Upstash）によるマッチングキュー
- PostgreSQL（Neon）による永続化
- LiveKit Cloudによる通信インフラ

---

## 将来構想を含む拡張アーキテクチャ

### フェーズ別機能展開

```mermaid
timeline
    title V-Chat 機能展開ロードマップ
    
    section 現在 (MVP)
        基本チャット : 3Dアバター
                    : VRM表示
                    : リアルタイム通信
        
    section フェーズ2
        人狼ゲーム : なりきり機能
                  : Bot GM
                  : 役職システム
        
    section フェーズ3
        AI統合 : 表情生成
             : 感情分析
             : 自動演出
        
    section フェーズ4
        ソーシャル : フレンドシステム
                 : コミュニティ機能
                 : イベント管理
        
    section フェーズ5
        ビジネス : マーケットプレイス
               : プレミアム機能
               : 企業向け
```

### 拡張システムアーキテクチャ

```mermaid
graph TB
    %% ユーザー層
    subgraph "多様なユーザー層"
        GeneralUser[一般ユーザー]
        GameUser[ゲーマー]
        Creator[クリエイター]
        Business[企業ユーザー]
    end
    
    %% フロントエンド統合プラットフォーム
    subgraph "統合フロントエンド プラットフォーム"
        subgraph "Core UI Components"
            ChatUI[チャットUI]
            AvatarUI[アバター管理UI]
            RoomUI[ルームUI]
            ProfileUI[プロフィールUI]
        end
        
        subgraph "Game Components (Phase 2)"
            WerewolfUI[人狼ゲームUI]
            RoleUI[役職管理UI]
            CharacterUI[キャラクター演技UI]
            GameStateUI[ゲーム状態UI]
        end
        
        subgraph "AI Enhanced Components (Phase 3)"
            AIExpressionUI[AI表情UI]
            EmotionUI[感情分析UI]
            AutoDirectionUI[自動演出UI]
        end
        
        subgraph "Social Components (Phase 4)"
            FriendUI[フレンドUI]
            CommunityUI[コミュニティUI]
            EventUI[イベント管理UI]
        end
        
        subgraph "Business Components (Phase 5)"
            MarketplaceUI[マーケットプレイスUI]
            PremiumUI[プレミアム機能UI]
            AdminUI[管理者UI]
        end
        
        subgraph "3D Avatar System Enhanced"
            R3F[React Three Fiber]
            VRMAdvanced[高度なVRMシステム]
            AIMotion[AI表情・動作生成]
            CustomAvatar[カスタムアバター]
        end
    end
    
    %% マイクロサービスバックエンド
    subgraph "マイクロサービス バックエンド"
        subgraph "Core Services"
            AuthService[認証サービス]
            UserService[ユーザー管理]
            ChatService[チャット管理]
            RoomService[ルーム管理]
        end
        
        subgraph "Game Services (Phase 2)"
            WerewolfEngine[人狼ゲームエンジン]
            GameBotService[ゲームBot GM]
            RoleService[役職管理]
            CharacterService[キャラクター管理]
        end
        
        subgraph "AI Services (Phase 3)"
            EmotionAnalysis[感情分析AI]
            ExpressionGenerator[表情生成AI]
            MotionAI[モーション生成AI]
            AIOrchestrator[AI統合管理]
        end
        
        subgraph "Social Services (Phase 4)"
            FriendService[フレンド管理]
            CommunityService[コミュニティ管理]
            EventService[イベント管理]
            NotificationService[通知サービス]
        end
        
        subgraph "Business Services (Phase 5)"
            MarketplaceService[マーケットプレイス]
            PaymentService[決済サービス]
            AnalyticsService[分析サービス]
            AdminService[管理サービス]
        end
    end
    
    %% 多層データベース戦略
    subgraph "多層データベース戦略"
        subgraph "Primary Storage"
            PostgreSQL[(PostgreSQL Main)]
            TimescaleDB[(TimescaleDB Analytics)]
        end
        
        subgraph "Cache & Queue"
            RedisCluster[(Redis Cluster)]
            GameStateCache[(Game State Cache)]
        end
        
        subgraph "Specialized Storage"
            VectorDB[(Vector DB for AI)]
            GraphDB[(Graph DB for Social)]
            TSDB[(Time Series for Metrics)]
        end
        
        subgraph "File Storage"
            CloudflareR2[(Cloudflare R2)]
            CDN[(Global CDN)]
        end
    end
    
    %% 外部AI・サービス統合
    subgraph "外部AI・サービス統合"
        OpenAIAPI[OpenAI API]
        StabilityAI[Stability AI]
        GoogleAI[Google AI]
        AWSComprehend[AWS Comprehend]
        
        StripeAPI[Stripe API]
        PayPalAPI[PayPal API]
        
        DiscordBot[Discord Bot]
        TwitterAPI[Twitter API]
        LineAPI[Line API]
    end
    
    %% 接続関係
    GeneralUser --> ChatUI
    GameUser --> WerewolfUI
    Creator --> MarketplaceUI
    Business --> AdminUI
    
    ChatUI --> ChatService
    WerewolfUI --> WerewolfEngine
    AIExpressionUI --> EmotionAnalysis
    MarketplaceUI --> MarketplaceService
    
    EmotionAnalysis --> OpenAIAPI
    ExpressionGenerator --> StabilityAI
    PaymentService --> StripeAPI
    
    ChatService --> PostgreSQL
    WerewolfEngine --> GameStateCache
    EmotionAnalysis --> VectorDB
    FriendService --> GraphDB
```

### ゲームシステム詳細アーキテクチャ（人狼機能）

```mermaid
graph TB
    subgraph "人狼ゲーム システム"
        subgraph "Game State Management"
            GameEngine[ゲームエンジン]
            PhaseManager[フェーズ管理]
            RoleAssigner[役職割当]
            VotingSystem[投票システム]
        end
        
        subgraph "Character System"
            CharacterGenerator[キャラクター生成]
            PersonalityEngine[性格システム]
            ObjectiveTracker[目標追跡]
            PerformanceEvaluator[演技評価]
        end
        
        subgraph "Bot GM System"
            GMBot[GMボット]
            ScriptEngine[シナリオエンジン]
            ProgressTracker[進行管理]
            EventTrigger[イベントトリガー]
        end
        
        subgraph "Communication Control"
            VoiceController[音声制御]
            TextFilter[テキストフィルター]
            ChannelManager[チャンネル管理]
            MuteSystem[ミュート制御]
        end
    end
    
    GameEngine --> PhaseManager
    PhaseManager --> GMBot
    CharacterGenerator --> PersonalityEngine
    VotingSystem --> ProgressTracker
```

### AIシステム詳細アーキテクチャ

```mermaid
graph TB
    subgraph "AI統合システム"
        subgraph "Computer Vision"
            FaceDetection[顔検出]
            EmotionRecognition[表情認識]
            GestureAnalysis[ジェスチャー分析]
            EyeTracking[視線追跡]
        end
        
        subgraph "Natural Language Processing"
            SentimentAnalysis[感情分析]
            IntentRecognition[意図理解]
            ContextAnalysis[文脈分析]
            PersonalityDetection[性格分析]
        end
        
        subgraph "Generation Systems"
            ExpressionGen[表情生成]
            MotionGen[モーション生成]
            VoiceGen[音声生成]
            ResponseGen[応答生成]
        end
        
        subgraph "Learning & Adaptation"
            UserBehaviorLearning[ユーザー行動学習]
            PreferenceAdaptation[好み適応]
            PersonalizationEngine[パーソナライゼーション]
        end
    end
    
    FaceDetection --> EmotionRecognition
    EmotionRecognition --> ExpressionGen
    SentimentAnalysis --> ResponseGen
    UserBehaviorLearning --> PersonalizationEngine
```

### ビジネス・マーケットプレイス アーキテクチャ

```mermaid
graph TB
    subgraph "ビジネス プラットフォーム"
        subgraph "Marketplace System"
            AssetStore[アセットストア]
            CreatorStudio[クリエイタースタジオ]
            QualityControl[品質管理]
            LicenseManager[ライセンス管理]
        end
        
        subgraph "Monetization"
            SubscriptionManager[サブスクリプション]
            PaymentProcessor[決済処理]
            RevenueSharing[収益分配]
            AnalyticsDashboard[分析ダッシュボード]
        end
        
        subgraph "Enterprise Features"
            WhiteLabel[ホワイトラベル]
            CustomBranding[カスタムブランディング]
            EnterpriseAuth[企業認証]
            ComplianceTools[コンプライアンス]
        end
        
        subgraph "Creator Economy"
            CreatorRewards[クリエイター報酬]
            CommunityGrants[コミュニティ助成]
            Partnerships[パートナーシップ]
            InfluencerTools[インフルエンサーツール]
        end
    end
    
    AssetStore --> QualityControl
    PaymentProcessor --> RevenueSharing
    CreatorStudio --> CreatorRewards
```

### インフラストラクチャ・スケーリング戦略

```mermaid
graph TB
    subgraph "スケーラブル インフラ"
        subgraph "Container Orchestration"
            Kubernetes[Kubernetes Cluster]
            ServiceMesh[Service Mesh]
            LoadBalancer[Load Balancer]
            AutoScaler[Auto Scaler]
        end
        
        subgraph "Global Distribution"
            MultiRegion[マルチリージョン]
            EdgeServers[エッジサーバー]
            CDNNetwork[CDN ネットワーク]
            RegionalDB[地域別DB]
        end
        
        subgraph "Monitoring & Observability"
            MetricsCollection[メトリクス収集]
            LogAggregation[ログ集約]
            TraceAnalysis[トレース分析]
            AlertSystem[アラートシステム]
        end
        
        subgraph "DevOps & Security"
            CI_CD[CI/CD Pipeline]
            SecurityScanning[セキュリティスキャン]
            SecretManagement[シークレット管理]
            BackupSystem[バックアップシステム]
        end
    end
    
    Kubernetes --> ServiceMesh
    MultiRegion --> EdgeServers
    MetricsCollection --> AlertSystem
```

## 技術的実装戦略

### フェーズ別実装計画

```mermaid
gantt
    title V-Chat 実装ロードマップ
    dateFormat  YYYY-MM-DD
    section MVP (現在)
    基本チャット機能    :done, mvp1, 2024-01-01, 2024-03-31
    VRMアバター統合     :done, mvp2, 2024-02-01, 2024-04-15
    リアルタイム通信    :done, mvp3, 2024-03-01, 2024-04-30
    
    section フェーズ2
    人狼ゲーム設計      :phase2-1, 2024-05-01, 2024-06-15
    ボットGM実装       :phase2-2, after phase2-1, 60d
    役職・演技システム  :phase2-3, after phase2-1, 75d
    
    section フェーズ3
    AI感情分析         :phase3-1, 2024-08-01, 2024-10-15
    表情生成システム    :phase3-2, after phase3-1, 45d
    モーション生成     :phase3-3, after phase3-2, 60d
    
    section フェーズ4
    ソーシャル機能     :phase4-1, 2024-11-01, 2025-01-15
    コミュニティ管理   :phase4-2, after phase4-1, 45d
    
    section フェーズ5
    マーケットプレイス :phase5-1, 2025-02-01, 2025-04-15
    企業向け機能      :phase5-2, after phase5-1, 60d
```

### API設計拡張

```mermaid
graph LR
    subgraph "API Gateway"
        Gateway[API Gateway]
        RateLimit[Rate Limiting]
        Auth[Authentication]
        Cache[Response Cache]
    end
    
    subgraph "Core APIs"
        UserAPI[User API]
        ChatAPI[Chat API]
        RoomAPI[Room API]
        AvatarAPI[Avatar API]
    end
    
    subgraph "Game APIs"
        WerewolfAPI[Werewolf API]
        CharacterAPI[Character API]
        GameStateAPI[Game State API]
    end
    
    subgraph "AI APIs"
        EmotionAPI[Emotion API]
        ExpressionAPI[Expression API]
        MotionAPI[Motion API]
    end
    
    subgraph "Business APIs"
        MarketAPI[Marketplace API]
        PaymentAPI[Payment API]
        AnalyticsAPI[Analytics API]
    end
    
    Gateway --> UserAPI
    Gateway --> GameStateAPI
    Gateway --> EmotionAPI
    Gateway --> MarketAPI
```

この拡張アーキテクチャにより、V-Chatは単純なビデオチャットアプリから、包括的なメタバースプラットフォームへと進化できる基盤が構築されます。