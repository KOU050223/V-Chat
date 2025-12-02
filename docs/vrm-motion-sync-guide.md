# VRMモデルとカメラモーションの同期 実装手順書

## 1. 概要

このドキュメントは、ユーザーがアップロード・選択したVRMモデルを、Webカメラでキャプチャしたユーザー自身の体の動き（ポーズ）とリアルタイムで同期させる機能の実装手順を定義します。

最終的なゴールは、ユーザーがカメラの前で動くと、画面上の3Dアバターが同じように動く体験を実現することです。

## 2. 技術スタック

この機能の実装には、以下の主要なライブラリを使用します。

-   **React Three Fiber (`@react-three/fiber`)**: ReactコンポーネントとしてThree.jsの3Dシーンを宣言的に構築するためのライブラリ。
-   **Drei (`@react-three/drei`)**: React Three Fiberの便利なヘルパーコンポーネント集。
-   **Three.js (`three`)**: 3D描画のコアとなるライブラリ。
-   **@pixiv/three-vrm**: VRMモデルの読み込み、ボーン操作、正規化などを簡単に行うためのライブラリ。
-   **MediaPipe (`@mediapipe/tasks-vision`)**: Googleが開発した、ブラウザ上で高速に動作する機械学習タスク（今回はポーズ推定）を実行するためのライブラリ。

> [!IMPORTANT]
> 本ドキュメントは、**ローカル環境でのモーションキャプチャとリターゲティング**の実装詳細を扱います。
> LiveKitを使用したネットワーク同期（Data Channelによる通信など）のアーキテクチャについては、[LiveKit 3Dアバターシステム](./livekit-avatar-system.md) を参照してください。

## 3. 実装ステップ

実装は、以下のステップで進めます。

### ステップ 3.1: MediaPipeのセットアップとカメラ映像の取得

まず、ユーザーのポーズを推定するための準備として、MediaPipeの初期化とカメラからの映像ストリーム取得を行います。

1.  **MediaPipeモデルファイルの配置**
    -   [Pose Landmarker Liteモデル](https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task) をダウンロードします。
    -   ダウンロードした `pose_landmarker_lite.task` ファイルを、プロジェクトの `public/mediapipe/` ディレクトリに配置します。

2.  **カメラ映像取得とポーズ推定を実行するカスタムフックの作成 (`usePoseEstimation.ts`)**
    -   `@mediapipe/tasks-vision` から `PoseLandmarker` と `FilesetResolver` をインポートします。
    -   `useEffect` を使用して、コンポーネントのマウント時に一度だけ `PoseLandmarker` を非同期で初期化します。
    -   `navigator.mediaDevices.getUserMedia` を使ってカメラ映像を取得し、非表示の `<video>` 要素にストリームをセットします。
    -   `requestAnimationFrame` ループを開始し、毎フレーム `video` 要素の現在の映像からポーズ推定 `poseLandmarker.detectForVideo()` を実行し、結果をstateとして保持します。

### ステップ 3.2: VRMモデルの表示

次に、モーションを適用する対象となるVRMモデルを画面に表示します。

1.  **VRMローダーコンポーネントの作成 (`VRMViewer.tsx`)**
    -   `@react-three/fiber` の `useLoader` と `three` の `GLTFLoader` を使って、指定されたURLからVRMファイルを読み込みます。
    -   `@pixiv/three-vrm` の `VRMUtils.removeUnnecessaryJoints` と `VRM.from` を使って、読み込んだGLTFデータからVRMインスタンスを生成します。
    -   生成したVRMの `scene` オブジェクトを `<primitive>` コンポーネントで3D空間に描画します。

### ステップ 3.3: ポーズの正規化とVRMボーンへの適用（リターゲティング）

ここが最も重要なステップです。MediaPipeから得られた3Dランドマーク座標を、VRMモデルの各ボーンの回転情報に変換します。

1.  **リターゲティング用ユーティリティの作成 (`vrm-retargeter.ts`)**
    -   `VRM` インスタンスとMediaPipeの `Landmark[]` を引数に取り、VRMのボーンを更新する関数 `retarget` を作成します。
    -   この関数内では、特定のランドマーク（例: `LEFT_SHOULDER`, `LEFT_ELBOW`, `LEFT_WRIST`）からベクトルを計算します。
    -   計算したベクトルを基に、`Quaternion.setFromUnitVectors()` などを使って、対応するVRMのボーン（例: `LeftUpperArm`）の回転クォータニオンを計算します。
    -   主要な上半身のボーン（腕、肩、背骨、首、頭）に対してこの計算を繰り返します。

    ```typescript
    // vrm-retargeter.ts (一部抜粋)
    import { VRM, VRMHumanoidBoneName } from '@pixiv/three-vrm';
    import * as THREE from 'three';

    // MediaPipeのランドマークから特定のボーンの回転を計算するヘルパー関数
    const calculateBoneRotation = (landmarks, from, to) => {
      const vec = new THREE.Vector3().subVectors(
        new THREE.Vector3(landmarks[to].x, landmarks[to].y, landmarks[to].z),
        new THREE.Vector3(landmarks[from].x, landmarks[from].y, landmarks[from].z)
      ).normalize();
      // ここで基準ベクトルとの差分からクォータニオンを計算するロジック
      // ...
      return quaternion;
    }

    export function retarget(vrm: VRM, landmarks: any[]) {
      if (!vrm || !landmarks || landmarks.length === 0) return;

      const humanoid = vrm.humanoid;
      // 例: 左上腕の回転を計算
      const leftUpperArm = humanoid.getBoneNode(VRMHumanoidBoneName.LeftUpperArm);
      if (leftUpperArm) {
        // ... ランドマークから回転を計算し、leftUpperArm.quaternion.slerp(quaternion, 0.5) のように適用
      }
      // ... 他の上半身ボーンも同様に処理
    }
    ```

### ステップ 3.4: 全体の統合

最後に、これまでのステップを一つのコンポーネントに統合します。

1.  **統合コンポーネントの作成 (`MotionSyncViewer.tsx`)**
    -   `usePoseEstimation` フックを呼び出し、ポーズのランドマーク情報を取得します。
    -   `VRMViewer` コンポーネントを使ってVRMモデルを描画します。
    -   `@react-three/fiber` の `useFrame` フックを使います。
    -   `useFrame` の中で、毎フレーム `retarget` 関数を呼び出し、最新のポーズ情報をVRMモデルに適用します。
    -   最後に、VRMインスタンスの `update` メソッドを呼び出して、モデル全体の状態を更新します。

    ```tsx
    // MotionSyncViewer.tsx (一部抜粋)
    const { landmarks } = usePoseEstimation();
    const vrm = useVRM(/* VRMのURL */);

    useFrame((state, delta) => {
      if (vrm && landmarks) {
        retarget(vrm, landmarks);
        vrm.update(delta);
      }
    });
    ```

## 4. ファイル構成案

```
/docs
└── vrm-motion-sync-guide.md  (このファイル)
/public
└── /mediapipe
    └── pose_landmarker_lite.task (MediaPipeモデル)
/src
├── /components
│   └── /vrm
│       └── MotionSyncViewer.tsx (最終的な統合コンポーネント)
├── /hooks
│   └── usePoseEstimation.ts (カメラとMediaPipeを扱うフック)
└── /lib
    └── vrm-retargeter.ts (リターゲティング処理のロジック)
```

以上が実装の全体像と手順です。この手順書に基づき、各ステップを実装してください。
