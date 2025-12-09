import { useEffect, useRef, useState, useCallback } from "react";
import { PoseLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";

export interface PoseLandmark {
  x: number;
  y: number;
  z: number;
  visibility?: number;
}

interface UsePoseEstimationReturn {
  landmarks: PoseLandmark[] | null;
  worldLandmarks: PoseLandmark[] | null;
  isInitialized: boolean;
  isLoading: boolean;
  isCameraPermissionGranted: boolean;
  error: string | null;
  videoRef: React.MutableRefObject<HTMLVideoElement | null>;
  startCamera: () => Promise<void>;
  stopCamera: () => void;
  requestCameraPermission: () => Promise<void>;
}

export const usePoseEstimation = (): UsePoseEstimationReturn => {
  const [landmarks, setLandmarks] = useState<PoseLandmark[] | null>(null);
  const [worldLandmarks, setWorldLandmarks] = useState<PoseLandmark[] | null>(
    null
  );
  const [isInitialized, setIsInitialized] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isCameraPermissionGranted, setIsCameraPermissionGranted] =
    useState(false);
  const [error, setError] = useState<string | null>(null);

  const poseLandmarkerRef = useRef<PoseLandmarker | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const lastTimestampRef = useRef<number>(0);
  const lastDetectionTimeRef = useRef<number>(0);
  const DETECTION_INTERVAL = 100; // 100ms間隔でポーズ検出（10FPS - 精度向上）

  // MediaPipeの初期化
  useEffect(() => {
    const initializePoseLandmarker = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const vision = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm"
        );

        poseLandmarkerRef.current = await PoseLandmarker.createFromOptions(
          vision,
          {
            baseOptions: {
              modelAssetPath: "/mediapipe/pose_landmarker_lite.task",
              delegate: "GPU",
            },
            runningMode: "VIDEO",
            numPoses: 1,
            minPoseDetectionConfidence: 0.3,
            minPosePresenceConfidence: 0.3,
            minTrackingConfidence: 0.3,
          }
        );

        setIsInitialized(true);
      } catch (err) {
        console.error("MediaPipe初期化エラー:", err);
        setError(
          `MediaPipeの初期化に失敗しました: ${err instanceof Error ? err.message : "Unknown error"}`
        );
      } finally {
        setIsLoading(false);
      }
    };

    initializePoseLandmarker();

    return () => {
      if (poseLandmarkerRef.current) {
        poseLandmarkerRef.current.close();
      }
    };
  }, []);

  // ポーズ推定のループ（フレームレート制御付き）
  const detectPose = useCallback(() => {
    if (!poseLandmarkerRef.current || !videoRef.current) {
      return;
    }

    const video = videoRef.current;
    const currentTime = performance.now();

    // フレームレート制御: 指定間隔でのみ処理
    if (
      video.readyState >= 2 &&
      currentTime - lastDetectionTimeRef.current >= DETECTION_INTERVAL
    ) {
      try {
        // 単調増加するタイムスタンプを生成
        const timestamp = Math.max(currentTime, lastTimestampRef.current + 1);
        lastTimestampRef.current = timestamp;
        lastDetectionTimeRef.current = currentTime;

        const result = poseLandmarkerRef.current.detectForVideo(
          video,
          timestamp
        );

        if (result.landmarks && result.landmarks.length > 0) {
          setLandmarks(result.landmarks[0]);
        } else {
          setLandmarks(null);
        }

        if (result.worldLandmarks && result.worldLandmarks.length > 0) {
          setWorldLandmarks(result.worldLandmarks[0]);
        } else {
          setWorldLandmarks(null);
        }
      } catch (err) {
        console.error("ポーズ検出エラー:", err);
      }
    }

    animationFrameRef.current = requestAnimationFrame(detectPose);
  }, []);

  // カメラ許可を要求
  const requestCameraPermission = useCallback(async () => {
    try {
      setError(null);

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 480 }, // 640→480に削減（パフォーマンス最適化）
          height: { ideal: 360 }, // 480→360に削減
          facingMode: "user",
          frameRate: { ideal: 30, max: 30 }, // フレームレート制限
        },
      });

      // 許可が得られたらすぐに停止（実際の使用は startCamera で行う）
      stream.getTracks().forEach((track) => track.stop());
      setIsCameraPermissionGranted(true);
    } catch (err) {
      console.error("カメラ許可エラー:", err);
      setError(
        `カメラの許可が必要です: ${err instanceof Error ? err.message : "Unknown error"}`
      );
      setIsCameraPermissionGranted(false);
    }
  }, []);

  // カメラの開始
  const startCamera = useCallback(async () => {
    try {
      setError(null);

      // If videoRef is managed by React, it should be set already.
      // If not, we create a hidden one.
      if (!videoRef.current) {
        const video = document.createElement("video");
        video.style.display = "none";
        video.autoplay = true;
        video.playsInline = true;
        document.body.appendChild(video);
        videoRef.current = video;
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 480 },
          height: { ideal: 360 },
          facingMode: "user",
          frameRate: { ideal: 30, max: 30 },
        },
      });

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        // Explicitly play to ensure it starts (sometimes required even with autoPlay)
        await videoRef.current
          .play()
          .catch((e) => console.warn("Video play error:", e));
      }

      setIsCameraPermissionGranted(true);

      // ポーズ検出ループを開始
      detectPose();
    } catch (err) {
      console.error("カメラアクセスエラー:", err);
      setError(
        `カメラにアクセスできませんでした: ${err instanceof Error ? err.message : "Unknown error"}`
      );
      setIsCameraPermissionGranted(false);
    }
  }, [detectPose]);

  // カメラの停止
  const stopCamera = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    if (videoRef.current) {
      // ストリームの解除
      videoRef.current.srcObject = null;

      // 内部生成（document.bodyの直下）の場合のみ削除・破壊する
      // React管理下にある場合（parentNodeがbody以外）は削除しない
      if (videoRef.current.parentNode === document.body) {
        try {
          document.body.removeChild(videoRef.current);
        } catch (e) {
          console.warn("Failed to remove internal video element:", e);
        }
        // 自分で作った場合は参照も消す
        videoRef.current = null;
      } else {
        // else: React管理の場合は要素を残し、次回のstartCameraで再利用
      }
    }

    // タイムスタンプをリセット
    lastTimestampRef.current = 0;
    lastDetectionTimeRef.current = 0;

    setLandmarks(null);
    setWorldLandmarks(null);
  }, []);

  // クリーンアップ
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  return {
    landmarks,
    worldLandmarks,
    isInitialized,
    isLoading,
    isCameraPermissionGranted,
    error,
    videoRef,
    startCamera,
    stopCamera,
    requestCameraPermission,
  };
};
