# AI Agent Context: LiveKit 3Dアバター通話アプリ

## 1. プロジェクト概要

LiveKitを使用したWebRTCビデオ通話アプリケーション。
**最大の特徴:** カメラ映像そのものを配信するのではなく、ローカルで解析した「顔の表情・モーションデータ」をLiveKitのデータチャンネル経由でリアルタイム同期し、受信側で3Dアバター(VRM)を動かすシステムである。

## 2. 技術スタック

* **Frontend:** Next.js (App Router), TypeScript
* **Realtime/WebRTC:** LiveKit (`@livekit/components-react`, `livekit-client`)
* **3D Rendering:** React Three Fiber (R3F), Three.js (`@react-three/drei`)
* **Avatar Model:** VRM Format (`@pixiv/three-vrm`)
* **Face Tracking:** MediaPipe Face Landmarker

## 3. アーキテクチャの絶対ルール (重要)

### 3.1 データフローの方針

* **映像ストリーム禁止:** アバター表現のために `VideoTrack` を使用してはならない（帯域の無駄）。
* **データチャンネル使用:** 表情データや座標は `publishData` を使用して送信する。
* **クライアントレンダリング:** 受信したデータに基づき、各クライアントのブラウザ内で3D描画を行う。

### 3.2 バックエンド / API

* **モーション用API禁止:** 表情同期のために独自のAPIサーバーを経由させてはならない。LiveKit経由のP2P（SFUリレー）で直接送受信する。
* **APIの用途:** Next.jsのAPI Routesは「LiveKitのアクセストークン発行」のみに使用する。

### 3.3 通信設定

* **UDPモード:** モーションデータは `reliable: false` (信頼性なし/UDP) で送信し、低遅延を最優先する。
* **間引き (Throttling):** 送信レートは 15fps ~ 30fps 程度に制限し、帯域を圧迫しないようにする。

### 3.4 音声同期 (Audio Sync)

* **標準機能の利用:** 音声通話にはLiveKit標準の `AudioTrack` を使用する。特別な同期ロジックは実装せず、WebRTCの標準的なAV同期機構に委ねる。
* **リップシンク:** 受信した `AudioTrack` の音量レベル（AudioLevel）を監視し、アバターの口の開閉（`aa`, `ih`, `ou` 等のブレンドシェイプ）に反映させる。これは映像同期の補助、またはカメラOFF時の代替手段として機能する。

## 4. データ構造定義

### 4.1 アバター初期情報 (`Participant.metadata`)

入室時（Join Room）にメタデータとして設定する静的情報。

```typescript
interface AvatarMetadata {
  avatarUrl: string; // VRMファイルのURL
  avatarId: string;  // アバター識別子
}
```

### 4.2 モーションパケット (`publishData` ペイロード)

リアルタイムに送信する軽量JSONデータ。

```typescript
interface MotionDataPacket {
  t: 'm'; // type: motion
  b: Record<string, number>; // ブレンドシェイプ (例: { "fun": 1.0, "blink_l": 0.5 })
  r: [number, number, number]; // 頭の回転 [x, y, z]
  v: 0 | 1; // カメラ有効フラグ (1=ON, 0=OFF)
}
```

## 5. コンポーネント設計指針

### 5.1 `SenderComponent` (送信側)

* UI上は非表示（またはデバッグ用表示のみ）。
* **役割:** Webカメラ映像を取得 → MediaPipeで解析 → VRM用ブレンドシェイプに変換 → `localParticipant.publishData` で送信。
* **注意:** Reactのレンダリングサイクルとは独立して、解析ループを回すこと。

### 5.2 `ReceiverComponent` (受信側)

* React Three FiberのCanvas内で動作。
* **役割:** `Participant.metadata` からVRMをロード → `DataReceived` イベントを監視。
* **補間処理 (Interpolation):** 受信データは断続的なため、必ず**線形補間（Lerp）**を用いて滑らかに描画すること。直値をそのままセットするとカクつきの原因になる。

## 6. 実装コード規約・ヒント

### LiveKit Hooks

* 送信には `useLocalParticipant()` を使用する。
* 受信・描画には `useRemoteParticipants()` または `ParticipantLoop` 内で個別のコンテキストを使用する。

### エラーハンドリング・フォールバック

* **カメラOFF時:** パケット内のフラグが `v: 0` の場合、アバターを直立不動にするのではなく、LiveKitの `AudioTrack` の音量（Volume）を取得し、口の開閉（リップシンク）のみを行うモードに切り替える実装を行うこと。

### コードスニペット例 (送信ロジック)

```typescript
const sendMotion = (data: MotionDataPacket) => {
  if (!localParticipant) return;
  const encoder = new TextEncoder();
  // UDPライクに投げるため reliable: false は必須
  localParticipant.publishData(encoder.encode(JSON.stringify(data)), {
    reliable: false,
    topic: "avatar-motion"
  });
};
```
