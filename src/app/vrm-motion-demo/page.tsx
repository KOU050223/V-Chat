"use client";

import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { VRMViewer } from "@/components/vrm/VRMViewer";
import { MotionSyncUI, useMotionSync } from "@/components/vrm/MotionSyncViewer";
import { CameraPreview } from "@/components/vrm/CameraPreview";
import { useFrame } from "@react-three/fiber";
import { retargetPoseToVRM } from "@/lib/vrm-retargeter";
import { retargetPoseToVRMWithKalidokit } from "@/lib/vrm-retargeter-kalidokit";
import { useState, useEffect } from "react";

// Canvas内でモーション同期を行うコンポーネント
const MotionSyncRenderer: React.FC<{
  vrmUrl: string;
  position: [number, number, number];
  motionSyncState: ReturnType<typeof useMotionSync>;
  useKalidokit: boolean;
  setIsVRMLoading: (loading: boolean) => void;
}> = ({ vrmUrl, position, motionSyncState, useKalidokit, setIsVRMLoading }) => {
  // コンポーネントマウント時にローディング状態をリセット
  useEffect(() => {
    setIsVRMLoading(true);
  }, [vrmUrl, setIsVRMLoading]);

  // フレームごとの更新処理
  useFrame((_state, delta) => {
    const vrm = motionSyncState.vrmRef.current;

    if (!vrm || !motionSyncState.isMotionActive) {
      return;
    }

    try {
      // ポーズデータが有効な場合、VRMに適用
      if (motionSyncState.landmarks && motionSyncState.landmarks.length > 0) {
        // Kalidokit版と現状版を切り替え
        if (useKalidokit) {
          // worldLandmarksを渡して正確な3D回転を計算
          retargetPoseToVRMWithKalidokit(
            vrm,
            motionSyncState.landmarks,
            motionSyncState.worldLandmarks
          );
        } else {
          retargetPoseToVRM(vrm, motionSyncState.landmarks);
        }
      }

      // VRMの更新
      vrm.update(delta);
    } catch (err) {
      console.error("フレーム更新エラー:", err);
    }
  });

  return (
    <VRMViewer
      vrmUrl={vrmUrl}
      onVRMLoaded={(vrm) => {
        motionSyncState.handleVRMLoaded(vrm);
        setIsVRMLoading(false);
      }}
      position={position}
    />
  );
};

MotionSyncRenderer.displayName = "MotionSyncRenderer";

export default function VRMMotionDemoPage() {
  // モーション同期の状態を管理
  const motionSyncState = useMotionSync(false);

  // Kalidokit使用フラグ（デフォルトはKalidokit）
  const [useKalidokit, setUseKalidokit] = useState(true);

  // ローディング状態
  const [isVRMLoading, setIsVRMLoading] = useState(true);

  return (
    <div className="h-screen w-full bg-gray-900">
      {/* ローディングオーバーレイ */}
      {isVRMLoading && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-gray-900 bg-opacity-90">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-blue-500 mb-4"></div>
            <h2 className="text-white text-2xl font-bold mb-2">
              VRMモデルを読み込み中...
            </h2>
            <p className="text-gray-400 text-sm">
              初回読み込みには時間がかかる場合があります
            </p>
          </div>
        </div>
      )}

      <div className="absolute top-4 left-4 z-10 text-white">
        <h1 className="text-2xl font-bold mb-2">VRM Motion Sync Demo</h1>
        <p className="text-sm opacity-70 mb-3">
          カメラアクセスを許可して、「モーション同期開始」ボタンを押してください
        </p>

        {/* 実装切り替えボタン */}
        <div className="flex items-center gap-2 bg-black bg-opacity-50 p-3 rounded-lg">
          <label className="text-sm font-semibold">実装方式:</label>
          <button
            onClick={() => setUseKalidokit(false)}
            className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
              !useKalidokit
                ? "bg-blue-600 text-white"
                : "bg-gray-700 text-gray-300 hover:bg-gray-600"
            }`}
          >
            自前実装
          </button>
          <button
            onClick={() => setUseKalidokit(true)}
            className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
              useKalidokit
                ? "bg-green-600 text-white"
                : "bg-gray-700 text-gray-300 hover:bg-gray-600"
            }`}
          >
            Kalidokit
          </button>
        </div>
      </div>

      <Canvas
        camera={{
          position: [0, 1.5, 3],
          fov: 50,
        }}
        style={{ width: "100%", height: "100%" }}
        gl={{
          antialias: true, // 品質維持のため有効
          powerPreference: "high-performance",
          alpha: false, // 透明度不要
        }}
        dpr={
          typeof window !== "undefined" && window.devicePixelRatio > 2
            ? 2
            : typeof window !== "undefined"
              ? window.devicePixelRatio
              : 1
        }
      >
        {/* 環境光（強度を上げて補完） */}
        <ambientLight intensity={0.8} />

        {/* メインの方向光 */}
        <directionalLight position={[5, 5, 5]} intensity={1.2} />

        {/* 補助ライト（右側） */}
        <directionalLight position={[-3, 3, 2]} intensity={0.5} />

        {/* 補助ライト（後ろ） */}
        <directionalLight position={[0, 3, -5]} intensity={0.3} />

        {/* Environmentを削除（重い読み込みを回避） */}

        {/* グリッド床 */}
        <gridHelper args={[10, 10]} />

        {/* VRMモーション同期ビューア */}
        <MotionSyncRenderer
          vrmUrl="/vrm/vroid_model_6689695945343414173.vrm" // VRoidモデルファイルのパス
          position={[0, 0, 0]}
          motionSyncState={motionSyncState}
          useKalidokit={useKalidokit}
          setIsVRMLoading={setIsVRMLoading}
        />

        {/* カメラコントロール */}
        <OrbitControls
          target={[0, 1, 0]}
          enablePan={true}
          enableZoom={true}
          enableRotate={true}
          minDistance={1}
          maxDistance={10}
        />
      </Canvas>

      {/* モーション同期UI（Canvas外） */}
      <MotionSyncUI
        isInitialized={motionSyncState.isInitialized}
        isLoading={motionSyncState.isLoading}
        isCameraPermissionGranted={motionSyncState.isCameraPermissionGranted}
        isMotionActive={motionSyncState.isMotionActive}
        landmarks={motionSyncState.landmarks}
        vrmLoaded={!!motionSyncState.vrmRef.current}
        error={motionSyncState.error}
        onStartMotionSync={motionSyncState.handleStartMotionSync}
        onStopMotionSync={motionSyncState.handleStopMotionSync}
        onRequestCameraPermission={motionSyncState.requestCameraPermission}
        enablePoseDebug={true}
      />

      {/* カメラプレビュー（右下） */}
      <CameraPreview
        videoRef={motionSyncState.videoRef}
        landmarks={motionSyncState.landmarks}
        isActive={motionSyncState.isMotionActive}
      />

      {/* 説明パネル */}
      <div className="absolute top-4 right-4 z-10 bg-black bg-opacity-50 text-white p-4 rounded-lg max-w-sm">
        <h2 className="text-lg font-semibold mb-2">使い方</h2>
        <ol className="text-sm space-y-1 list-decimal list-inside">
          <li>「📷 カメラを許可する」ボタンをクリック</li>
          <li>ブラウザのカメラアクセス許可を与える</li>
          <li>「モーション同期開始」ボタンをクリック</li>
          <li>カメラの前で体を動かす</li>
          <li>VRMアバターが同じように動くことを確認</li>
        </ol>

        <div className="mt-4 text-xs opacity-70">
          <p>• 上半身の動きが検出されます</p>
          <p>• 腕、肩、頭の動きが反映されます</p>
          <p>• デバッグ情報は左上に表示されます</p>
        </div>
      </div>
    </div>
  );
}
