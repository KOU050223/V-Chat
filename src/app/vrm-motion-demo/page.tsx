'use client';

import { Canvas } from '@react-three/fiber';
import { OrbitControls, Environment } from '@react-three/drei';
import { VRMViewer } from '../../components/vrm/VRMViewer';
import { MotionSyncUI, useMotionSync } from '../../components/vrm/MotionSyncViewer';
import { useFrame } from '@react-three/fiber';
import { retargetPoseToVRM } from '../../lib/vrm-retargeter';

// Canvas内でモーション同期を行うコンポーネント
const MotionSyncRenderer: React.FC<{
  vrmUrl: string;
  position: [number, number, number];
  motionSyncState: ReturnType<typeof useMotionSync>;
}> = ({ vrmUrl, position, motionSyncState }) => {
  // フレームごとの更新処理
  useFrame((_state, delta) => {
    const vrm = motionSyncState.vrmRef.current;

    if (!vrm || !motionSyncState.isMotionActive) {
      return;
    }

    try {
      // ポーズデータが有効な場合、VRMに適用
      if (motionSyncState.landmarks && motionSyncState.landmarks.length > 0) {
        // デバッグ: ランドマークが検出されていることを確認
        if (Math.random() < 0.01) { // 1%の確率でログ出力
          console.log('📍 ランドマーク検出数:', motionSyncState.landmarks.length);
          console.log('📍 肩の位置:', {
            left: motionSyncState.landmarks[11],
            right: motionSyncState.landmarks[12]
          });
        }
        retargetPoseToVRM(vrm, motionSyncState.landmarks);
      }

      // VRMの更新
      vrm.update(delta);

      // デバッグ: VRM update()が呼ばれていることを確認
      if (Math.random() < 0.001) { // 0.1%の確率でログ出力
        console.log('🔄 VRM update()呼び出し', {
          delta,
          timestamp: performance.now()
        });
      }

    } catch (err) {
      console.error('フレーム更新エラー:', err);
    }
  });

  return (
    <VRMViewer
      vrmUrl={vrmUrl}
      onVRMLoaded={motionSyncState.handleVRMLoaded}
      position={position}
    />
  );
});

export default function VRMMotionDemoPage() {
  // モーション同期の状態を管理
  const motionSyncState = useMotionSync(false);

  return (
    <div className="h-screen w-full bg-gray-900">
      <div className="absolute top-4 left-4 z-10 text-white">
        <h1 className="text-2xl font-bold mb-2">VRM Motion Sync Demo</h1>
        <p className="text-sm opacity-70">
          カメラアクセスを許可して、「モーション同期開始」ボタンを押してください
        </p>
      </div>

      <Canvas
        camera={{
          position: [0, 1.5, 3],
          fov: 50
        }}
        style={{ width: '100%', height: '100%' }}
      >
        {/* 環境光 */}
        <ambientLight intensity={0.6} />

        {/* 方向光 */}
        <directionalLight
          position={[5, 5, 5]}
          intensity={1}
          castShadow
          shadow-mapSize-width={2048}
          shadow-mapSize-height={2048}
        />

        {/* 環境マップ */}
        <Environment preset="studio" />

        {/* グリッド床 */}
        <gridHelper args={[10, 10]} />

        {/* VRMモーション同期ビューア */}
        <MotionSyncRenderer
          vrmUrl="/vrm/vroid_model_6689695945343414173.vrm" // VRoidモデルファイルのパス
          position={[0, 0, 0]}
          motionSyncState={motionSyncState}
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