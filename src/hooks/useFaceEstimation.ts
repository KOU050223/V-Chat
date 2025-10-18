import { useEffect, useRef, useState, useCallback } from 'react';
import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';

export interface FaceLandmark {
  x: number;
  y: number;
  z: number;
}

export interface FaceBlendShapes {
  // 目
  eyeBlinkLeft: number;      // 左目の閉じ具合 (0-1)
  eyeBlinkRight: number;     // 右目の閉じ具合 (0-1)
  eyeLookUpLeft: number;     // 左目の上向き
  eyeLookUpRight: number;    // 右目の上向き
  eyeLookDownLeft: number;   // 左目の下向き
  eyeLookDownRight: number;  // 右目の下向き
  eyeLookInLeft: number;     // 左目の内向き
  eyeLookInRight: number;    // 右目の内向き
  eyeLookOutLeft: number;    // 左目の外向き
  eyeLookOutRight: number;   // 右目の外向き
  
  // 口
  mouthOpen: number;         // 口の開き具合 (0-1)
  mouthSmile: number;        // 笑顔 (0-1)
  mouthPucker: number;       // 口をすぼめる
  mouthFunnel: number;       // 口を丸める
  
  // 眉
  browInnerUp: number;       // 眉の上げ具合 (0-1)
  browOuterUpLeft: number;   // 左眉の外側の上げ具合
  browOuterUpRight: number;  // 右眉の外側の上げ具合
  browDownLeft: number;      // 左眉を下げる
  browDownRight: number;     // 右眉を下げる
  
  // その他
  jawOpen: number;           // 顎の開き
  cheekPuff: number;         // 頬を膨らませる
}

interface UseFaceEstimationReturn {
  faceLandmarks: FaceLandmark[] | null;
  faceBlendShapes: FaceBlendShapes | null;
  isInitialized: boolean;
  isLoading: boolean;
  error: string | null;
  startDetection: () => void;
  stopDetection: () => void;
}

export const useFaceEstimation = (
  videoRef: React.MutableRefObject<HTMLVideoElement | null>
): UseFaceEstimationReturn => {
  const [faceLandmarks, setFaceLandmarks] = useState<FaceLandmark[] | null>(null);
  const [faceBlendShapes, setFaceBlendShapes] = useState<FaceBlendShapes | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDetecting, setIsDetecting] = useState(false);

  const faceLandmarkerRef = useRef<FaceLandmarker | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const lastTimestampRef = useRef<number>(0);
  const lastDetectionTimeRef = useRef<number>(0);
  const DETECTION_INTERVAL = 33; // 30FPS（表情は高頻度で更新）

  // MediaPipe Face Landmarkerの初期化
  useEffect(() => {
    // MediaPipeの情報ログを抑制
    const originalConsoleError = console.error;
    console.error = (...args: any[]) => {
      // TensorFlow Liteの情報メッセージをフィルタリング
      const message = args[0]?.toString() || '';
      if (message.includes('Created TensorFlow Lite XNNPACK delegate')) {
        return; // このメッセージは表示しない
      }
      originalConsoleError.apply(console, args);
    };

    const initializeFaceLandmarker = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const vision = await FilesetResolver.forVisionTasks(
          'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm'
        );

        faceLandmarkerRef.current = await FaceLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: '/mediapipe/face_landmarker.task',
            delegate: 'GPU'
          },
          runningMode: 'VIDEO',
          numFaces: 1,
          minFaceDetectionConfidence: 0.5,
          minFacePresenceConfidence: 0.5,
          minTrackingConfidence: 0.5,
          outputFaceBlendshapes: true,
          outputFacialTransformationMatrixes: false
        });

        setIsInitialized(true);
      } catch (err) {
        console.error('MediaPipe Face Landmarker初期化エラー:', err);
        setError(`Face Landmarkerの初期化に失敗しました: ${err instanceof Error ? err.message : 'Unknown error'}`);
      } finally {
        setIsLoading(false);
      }
    };

    initializeFaceLandmarker();

    return () => {
      // console.errorを元に戻す
      console.error = originalConsoleError;
      
      if (faceLandmarkerRef.current) {
        faceLandmarkerRef.current.close();
      }
    };
  }, []);

  // 顔検出のループ
  const detectFace = useCallback(() => {
    if (!faceLandmarkerRef.current || !videoRef.current || !isDetecting) {
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

        const result = faceLandmarkerRef.current.detectForVideo(video, timestamp);

        // ランドマークを更新
        if (result.faceLandmarks && result.faceLandmarks.length > 0) {
          setFaceLandmarks(result.faceLandmarks[0]);
        } else {
          setFaceLandmarks(null);
        }

        // BlendShapeを更新
        if (result.faceBlendshapes && result.faceBlendshapes.length > 0) {
          const blendshapes = result.faceBlendshapes[0];
          const categories = blendshapes.categories;

          // デバッグ: Face検出状況をログ（10%の確率）
          if (Math.random() < 0.1) {
            console.log('🎭 Face検出成功:', {
              categoriesCount: categories.length,
              firstFewCategories: categories.slice(0, 5).map(c => ({
                name: c.categoryName,
                score: c.score.toFixed(2)
              }))
            });
          }

          // MediaPipeのBlendShapeカテゴリから値を抽出
          const getBlendShapeValue = (name: string): number => {
            const category = categories.find(c => c.categoryName === name);
            return category ? category.score : 0;
          };

          setFaceBlendShapes({
            // 目
            eyeBlinkLeft: getBlendShapeValue('eyeBlinkLeft'),
            eyeBlinkRight: getBlendShapeValue('eyeBlinkRight'),
            eyeLookUpLeft: getBlendShapeValue('eyeLookUpLeft'),
            eyeLookUpRight: getBlendShapeValue('eyeLookUpRight'),
            eyeLookDownLeft: getBlendShapeValue('eyeLookDownLeft'),
            eyeLookDownRight: getBlendShapeValue('eyeLookDownRight'),
            eyeLookInLeft: getBlendShapeValue('eyeLookInLeft'),
            eyeLookInRight: getBlendShapeValue('eyeLookInRight'),
            eyeLookOutLeft: getBlendShapeValue('eyeLookOutLeft'),
            eyeLookOutRight: getBlendShapeValue('eyeLookOutRight'),
            
            // 口
            mouthOpen: getBlendShapeValue('jawOpen'),
            mouthSmile: (getBlendShapeValue('mouthSmileLeft') + getBlendShapeValue('mouthSmileRight')) / 2,
            mouthPucker: getBlendShapeValue('mouthPucker'),
            mouthFunnel: getBlendShapeValue('mouthFunnel'),
            
            // 眉
            browInnerUp: getBlendShapeValue('browInnerUp'),
            browOuterUpLeft: getBlendShapeValue('browOuterUpLeft'),
            browOuterUpRight: getBlendShapeValue('browOuterUpRight'),
            browDownLeft: getBlendShapeValue('browDownLeft'),
            browDownRight: getBlendShapeValue('browDownRight'),
            
            // その他
            jawOpen: getBlendShapeValue('jawOpen'),
            cheekPuff: getBlendShapeValue('cheekPuff')
          });
        } else {
          // デバッグ: Face検出失敗のログ（10%の確率）
          if (Math.random() < 0.1) {
            console.warn('⚠️ Face検出失敗:', {
              hasResult: !!result,
              hasFaceBlendshapes: !!result.faceBlendshapes,
              faceBlendshapesLength: result.faceBlendshapes?.length || 0
            });
          }
          setFaceBlendShapes(null);
        }
      } catch (err) {
        console.error('顔検出エラー:', err);
      }
    }

    animationFrameRef.current = requestAnimationFrame(detectFace);
  }, [videoRef, isDetecting]);

  // 検出の開始
  const startDetection = useCallback(() => {
    if (!isInitialized) {
      console.warn('Face Landmarkerが初期化されていません');
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
    setFaceLandmarks(null);
    setFaceBlendShapes(null);
    lastTimestampRef.current = 0;
    lastDetectionTimeRef.current = 0;
  }, []);

  // 検出ループの開始/停止
  useEffect(() => {
    if (isDetecting) {
      detectFace();
    }
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isDetecting, detectFace]);

  return {
    faceLandmarks,
    faceBlendShapes,
    isInitialized,
    isLoading,
    error,
    startDetection,
    stopDetection
  };
};

