import { useEffect, useRef, useState, useCallback } from 'react';
import { HandLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';
import type { HandLandmark } from '@/types/mediapipe';

// 型を再エクスポート（後方互換性のため）
export type { HandLandmark };

interface UseHandEstimationReturn {
  leftHandLandmarks: HandLandmark[] | null;
  rightHandLandmarks: HandLandmark[] | null;
  isInitialized: boolean;
  isLoading: boolean;
  error: string | null;
  startDetection: () => void;
  stopDetection: () => void;
}

export const useHandEstimation = (
  videoRef: React.MutableRefObject<HTMLVideoElement | null>
): UseHandEstimationReturn => {
  const [leftHandLandmarks, setLeftHandLandmarks] = useState<HandLandmark[] | null>(null);
  const [rightHandLandmarks, setRightHandLandmarks] = useState<HandLandmark[] | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDetecting, setIsDetecting] = useState(false);

  const handLandmarkerRef = useRef<HandLandmarker | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const lastTimestampRef = useRef<number>(0);
  const lastDetectionTimeRef = useRef<number>(0);
  const DETECTION_INTERVAL = 50; // 20FPS（手の動きは中頻度で更新）

  // MediaPipe Hand Landmarkerの初期化
  // モデルファイルがない場合でも、手の検出をスキップして他の機能は動作するようにする
  useEffect(() => {
    const initializeHandLandmarker = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const vision = await FilesetResolver.forVisionTasks(
          'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm'
        );

        handLandmarkerRef.current = await HandLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: '/mediapipe/hand_landmarker.task',
            delegate: 'GPU'
          },
          runningMode: 'VIDEO',
          numHands: 2,
          minHandDetectionConfidence: 0.5,
          minHandPresenceConfidence: 0.5,
          minTrackingConfidence: 0.5
        });

        setIsInitialized(true);
      } catch (err) {
        // モデルファイルがない場合は警告を出すが、初期化は成功として扱う
        // これにより、手の検出がなくても顔と体の動きは動作する
        const errorMessage = err instanceof Error ? err.message : String(err);
        if (errorMessage.includes('404') || errorMessage.includes('Failed to fetch')) {
          console.warn('⚠️ Hand Landmarkerモデルファイルが見つかりません。手の検出は無効になります。', {
            message: 'hand_landmarker.taskファイルを/public/mediapipe/に配置してください。',
            downloadUrl: 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task'
          });
          setError(null); // エラーをクリア（オプショナル機能として扱う）
        } else {
          console.error('MediaPipe Hand Landmarker初期化エラー:', err);
          setError(`Hand Landmarkerの初期化に失敗しました: ${errorMessage}`);
        }
        // モデルファイルがない場合でも初期化は成功として扱う
        setIsInitialized(true);
      } finally {
        setIsLoading(false);
      }
    };

    initializeHandLandmarker();

    return () => {
      if (handLandmarkerRef.current) {
        handLandmarkerRef.current.close();
      }
    };
  }, []);

  // 手検出のループ
  const detectHands = useCallback(() => {
    // handLandmarkerRefがnullの場合は手の検出をスキップ（モデルファイルがない場合）
    if (!handLandmarkerRef.current || !videoRef.current || !isDetecting) {
      return;
    }

    const video = videoRef.current;
    const currentTime = performance.now();

    // フレームレート制御
    if (video.readyState >= 2 && (currentTime - lastDetectionTimeRef.current) >= DETECTION_INTERVAL) {
      try {
        const timestamp = Math.max(currentTime, lastTimestampRef.current + 1);
        lastTimestampRef.current = timestamp;
        lastDetectionTimeRef.current = currentTime;

        const result = handLandmarkerRef.current.detectForVideo(video, timestamp);

        // 手のランドマークを更新
        if (result.landmarks && result.landmarks.length > 0) {
          // 左右の手を判定（MediaPipeは手の分類を提供）
          // 通常、最初の手が左手、2番目が右手（ただし、カメラの向きによって変わる可能性がある）
          // より正確には、handedness情報を使用する
          const leftHand = result.landmarks.find((_, index) => {
            if (result.handednesses && result.handednesses[index]) {
              return result.handednesses[index][0]?.categoryName === 'Left';
            }
            return index === 0; // フォールバック: 最初の手を左手とする
          });

          const rightHand = result.landmarks.find((_, index) => {
            if (result.handednesses && result.handednesses[index]) {
              return result.handednesses[index][0]?.categoryName === 'Right';
            }
            return index === 1; // フォールバック: 2番目の手を右手とする
          });

          setLeftHandLandmarks(leftHand || null);
          setRightHandLandmarks(rightHand || null);
        } else {
          setLeftHandLandmarks(null);
          setRightHandLandmarks(null);
        }
      } catch (err) {
        console.error('手検出エラー:', err);
      }
    }

    animationFrameRef.current = requestAnimationFrame(detectHands);
  }, [videoRef, isDetecting]);

  // 検出の開始
  const startDetection = useCallback(() => {
    if (!isInitialized) {
      console.warn('Hand Landmarkerが初期化されていません');
      return;
    }
    setIsDetecting(true);
  }, [isInitialized]);

  // 検出の停止
  const stopDetection = useCallback(() => {
    setIsDetecting(false);
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    setLeftHandLandmarks(null);
    setRightHandLandmarks(null);
    lastTimestampRef.current = 0;
    lastDetectionTimeRef.current = 0;
  }, []);

  // 検出ループの開始/停止
  useEffect(() => {
    if (isDetecting) {
      detectHands();
    }
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isDetecting, detectHands]);

  return {
    leftHandLandmarks,
    rightHandLandmarks,
    isInitialized,
    isLoading,
    error,
    startDetection,
    stopDetection
  };
};

