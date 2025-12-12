import React, { useRef, useEffect, useState, useCallback } from "react";
import { useFrame } from "@react-three/fiber";
import { VRM } from "@pixiv/three-vrm";
import { VRMViewer } from "./VRMViewer";
import {
  usePoseEstimation,
  type PoseLandmark,
} from "@/hooks/usePoseEstimation";
import { retargetPoseToVRMWithKalidokit } from "@/lib/vrm-retargeter-kalidokit";
import { resetVRMPose } from "@/lib/vrm-retargeter";

export type CameraView = "front" | "back" | "side" | "reset";

// モーション同期のロジックを管理するカスタムフック
export const useMotionSync = (
  autoStart = false,
  onMotionSync?: (isActive: boolean) => void
) => {
  const vrmRef = useRef<VRM | null>(null);
  const [isMotionActive, setIsMotionActive] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ポーズ推定フックを使用
  const {
    landmarks,
    worldLandmarks,
    isInitialized,
    isLoading,
    isCameraPermissionGranted,
    error: poseError,
    videoRef,
    startCamera,
    stopCamera,
    requestCameraPermission,
  } = usePoseEstimation();

  // モーション同期開始（useCallbackでメモ化）
  const handleStartMotionSync = useCallback(async () => {
    try {
      setError(null);

      if (!isInitialized) {
        throw new Error("MediaPipeが初期化されていません");
      }

      await startCamera();
      setIsMotionActive(true);
      onMotionSync?.(true);
    } catch (err) {
      const errorMessage = `モーション同期の開始に失敗しました: ${err instanceof Error ? err.message : "Unknown error"}`;
      setError(errorMessage);
      console.error(errorMessage, err);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isInitialized, startCamera]); // onMotionSyncを依存配列から除外

  // handleStartMotionSyncへの参照を保持
  const handleStartMotionSyncRef = useRef(handleStartMotionSync);
  useEffect(() => {
    handleStartMotionSyncRef.current = handleStartMotionSync;
  }, [handleStartMotionSync]);

  // VRM読み込み完了時のハンドラ（useCallbackでメモ化）
  const handleVRMLoaded = useCallback(
    (vrm: VRM) => {
      vrmRef.current = vrm;

      // オートスタートが有効な場合、カメラを開始
      if (autoStart && isInitialized) {
        handleStartMotionSyncRef.current();
      }
    },
    [autoStart, isInitialized]
  ); // handleStartMotionSyncを依存配列から除外

  // モーション同期停止（useCallbackでメモ化）
  const handleStopMotionSync = useCallback(() => {
    stopCamera();
    setIsMotionActive(false);
    onMotionSync?.(false);

    // VRMポーズをリセット
    if (vrmRef.current) {
      resetVRMPose(vrmRef.current);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stopCamera]); // onMotionSyncを依存配列から除外

  // エラー状態の管理
  useEffect(() => {
    if (poseError) {
      setError(poseError);
      setIsMotionActive(false);
      onMotionSync?.(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [poseError]); // onMotionSyncを依存配列から除外

  // MediaPipe初期化完了後のオートスタート処理
  useEffect(() => {
    if (autoStart && isInitialized && vrmRef.current && !isMotionActive) {
      handleStartMotionSyncRef.current();
    }
  }, [autoStart, isInitialized, isMotionActive]); // handleStartMotionSyncを依存配列から除外

  return {
    vrmRef,
    landmarks,
    worldLandmarks,
    isInitialized,
    isLoading,
    isCameraPermissionGranted,
    isMotionActive,
    error,
    videoRef,
    handleVRMLoaded,
    handleStartMotionSync,
    handleStopMotionSync,
    requestCameraPermission,
  };
};

interface MotionSyncViewerProps {
  vrmUrl: string;
  position?: [number, number, number];
  rotation?: [number, number, number];
  scale?: [number, number, number];
  autoStart?: boolean;
  onMotionSync?: (isActive: boolean) => void;
}

interface MotionSyncUIProps {
  isInitialized: boolean;
  isLoading: boolean;
  isCameraPermissionGranted: boolean;
  isMotionActive: boolean;
  landmarks: PoseLandmark[] | null;
  vrmLoaded: boolean;
  error: string | null;
  onStartMotionSync: () => void;
  onStopMotionSync: () => void;
  onRequestCameraPermission: () => void;
  enablePoseDebug?: boolean;
  showSkeleton?: boolean;
  onToggleSkeleton?: (show: boolean) => void;
  onCameraViewChange?: (view: CameraView) => void;
}

export const MotionSyncViewer: React.FC<MotionSyncViewerProps> = ({
  vrmUrl,
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  scale = [1, 1, 1],
  autoStart = false,
  onMotionSync,
}) => {
  // モーション同期フックを使用
  const { vrmRef, landmarks, worldLandmarks, isMotionActive, handleVRMLoaded } =
    useMotionSync(autoStart, onMotionSync);

  // フレームごとの更新処理
  useFrame((_state, delta) => {
    const vrm = vrmRef.current;

    if (!vrm || !isMotionActive) {
      return;
    }

    try {
      // ポーズデータが有効な場合、VRMに適用（Kalidokit使用）
      // worldLandmarksを渡すことで正確な3D回転を計算
      const currentWorldLandmarks = worldLandmarks; // クロージャーでキャプチャ
      if (landmarks && landmarks.length > 0) {
        retargetPoseToVRMWithKalidokit(vrm, landmarks, currentWorldLandmarks);
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
      onVRMLoaded={handleVRMLoaded}
      position={position}
      rotation={rotation}
      scale={scale}
    />
  );
};

// UI部分を別コンポーネントとして分離
export const MotionSyncUI: React.FC<MotionSyncUIProps> = ({
  isInitialized,
  isLoading,
  isCameraPermissionGranted,
  isMotionActive,
  landmarks,
  vrmLoaded,
  error,
  onStartMotionSync,
  onStopMotionSync,
  onRequestCameraPermission,
  enablePoseDebug = false,
  showSkeleton = false,
  onToggleSkeleton,
  onCameraViewChange,
}) => {
  // デバッグ情報の表示
  const renderDebugInfo = () => {
    if (!enablePoseDebug) return null;

    return (
      <div
        style={{
          position: "absolute",
          top: 10,
          left: 10,
          background: "rgba(0, 0, 0, 0.7)",
          color: "white",
          padding: "10px",
          borderRadius: "5px",
          fontSize: "12px",
          fontFamily: "monospace",
          zIndex: 1000,
        }}
      >
        <div>MediaPipe初期化: {isInitialized ? "✓" : "✗"}</div>
        <div>カメラ許可: {isCameraPermissionGranted ? "✓" : "✗"}</div>
        <div>モーション同期: {isMotionActive ? "✓" : "✗"}</div>
        <div>
          ランドマーク検出: {landmarks && landmarks.length > 0 ? "✓" : "✗"}
        </div>
        <div>VRM読み込み: {vrmLoaded ? "✓" : "✗"}</div>
        {error && <div style={{ color: "#ff6b6b" }}>エラー: {error}</div>}
        {/* LogViewerボタンを無効化（パフォーマンス最適化）
        <button
          onClick={() => setShowLogViewer(true)}
          style={{
            marginTop: '10px',
            padding: '5px 10px',
            fontSize: '10px',
            backgroundColor: '#4CAF50',
            color: 'white',
            border: 'none',
            borderRadius: '3px',
            cursor: 'pointer'
          }}
        >
          📄 ログを表示
        </button>
        */}
      </div>
    );
  };

  // コントロールボタンの表示
  const renderControls = () => {
    return (
      <div
        style={{
          position: "absolute",
          bottom: 20,
          left: "50%",
          transform: "translateX(-50%)",
          display: "flex",
          flexDirection: "column",
          gap: "10px",
          alignItems: "center",
          zIndex: 1000,
        }}
      >
        {/* カメラ許可ボタン */}
        {!isCameraPermissionGranted && (
          <button
            onClick={onRequestCameraPermission}
            style={{
              padding: "12px 24px",
              fontSize: "16px",
              backgroundColor: "#2196F3",
              color: "white",
              border: "none",
              borderRadius: "8px",
              cursor: "pointer",
              fontWeight: "bold",
              boxShadow: "0 4px 12px rgba(33, 150, 243, 0.3)",
            }}
          >
            📷 カメラを許可する
          </button>
        )}

        {/* モーション同期ボタン */}
        {isCameraPermissionGranted && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "10px",
              alignItems: "center",
            }}
          >
            {/* Debug Controls */}
            <div
              style={{
                display: "flex",
                gap: "8px",
                backgroundColor: "rgba(0,0,0,0.6)",
                padding: "8px",
                borderRadius: "8px",
              }}
            >
              {onToggleSkeleton && (
                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "4px",
                    color: "white",
                    fontSize: "12px",
                    cursor: "pointer",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={showSkeleton}
                    onChange={(e) => onToggleSkeleton(e.target.checked)}
                  />
                  骨格表示
                </label>
              )}

              {onCameraViewChange && (
                <>
                  <div
                    style={{
                      width: "1px",
                      height: "16px",
                      backgroundColor: "rgba(255,255,255,0.3)",
                      margin: "0 4px",
                    }}
                  />
                  <button
                    onClick={() => onCameraViewChange("front")}
                    style={viewButtonStyle}
                  >
                    正面
                  </button>
                  <button
                    onClick={() => onCameraViewChange("side")}
                    style={viewButtonStyle}
                  >
                    横
                  </button>
                  <button
                    onClick={() => onCameraViewChange("back")}
                    style={viewButtonStyle}
                  >
                    背面
                  </button>
                </>
              )}
            </div>

            <div style={{ display: "flex", gap: "10px" }}>
              {!isMotionActive ? (
                <button
                  onClick={onStartMotionSync}
                  disabled={!isInitialized || isLoading || !vrmLoaded}
                  style={{
                    padding: "10px 20px",
                    fontSize: "14px",
                    backgroundColor: "#4CAF50",
                    color: "white",
                    border: "none",
                    borderRadius: "5px",
                    cursor: "pointer",
                    opacity:
                      !isInitialized || isLoading || !vrmLoaded ? 0.5 : 1,
                  }}
                >
                  {isLoading ? "初期化中..." : "モーション同期開始"}
                </button>
              ) : (
                <button
                  onClick={onStopMotionSync}
                  style={{
                    padding: "10px 20px",
                    fontSize: "14px",
                    backgroundColor: "#f44336",
                    color: "white",
                    border: "none",
                    borderRadius: "5px",
                    cursor: "pointer",
                  }}
                >
                  モーション同期停止
                </button>
              )}
            </div>
          </div>
        )}

        {/* ヘルプテキスト */}
        {!isCameraPermissionGranted && (
          <div
            style={{
              color: "white",
              fontSize: "12px",
              textAlign: "center",
              opacity: 0.8,
              maxWidth: "300px",
            }}
          >
            VRMアバターにモーションを同期するには、まずカメラの許可が必要です
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      {renderDebugInfo()}
      {renderControls()}
      {/* LogViewerを無効化（パフォーマンス最適化）
      <LogViewer
        isVisible={showLogViewer}
        onClose={() => setShowLogViewer(false)}
      />
      */}
    </>
  );
};

const viewButtonStyle = {
  background: "none",
  border: "1px solid rgba(255,255,255,0.5)",
  borderRadius: "4px",
  color: "white",
  fontSize: "10px",
  padding: "2px 6px",
  cursor: "pointer",
};
