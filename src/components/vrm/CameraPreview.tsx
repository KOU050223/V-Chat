/**
 * カメラプレビューコンポーネント
 * MediaPipeのカメラ映像とランドマークを表示
 */

import React, { useRef, useEffect } from 'react';
import type { PoseLandmark } from '@/types/mediapipe';

interface CameraPreviewProps {
  videoRef: React.MutableRefObject<HTMLVideoElement | null>;
  landmarks: PoseLandmark[] | null;
  isActive: boolean;
}

export const CameraPreview: React.FC<CameraPreviewProps> = ({
  videoRef,
  landmarks,
  isActive
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number | null>(null);
  const lastFrameTimeRef = useRef<number>(0);
  const canvasSizeSetRef = useRef<boolean>(false);

  // フレームレート制限（30FPS = 33ms間隔）- チカチカ解消
  const PREVIEW_FPS = 30;
  const FRAME_INTERVAL = 1000 / PREVIEW_FPS;

  // ランドマークを描画
  useEffect(() => {
    if (!canvasRef.current || !videoRef?.current || !isActive) {
      return;
    }

    // videoRefが有効か確認
    if (!videoRef.current.videoWidth || !videoRef.current.videoHeight) {
      return;
    }

    const canvas = canvasRef.current;
    const video = videoRef.current;
    const ctx = canvas.getContext('2d');

    if (!ctx) return;

    // Canvasサイズを初回のみ設定（パフォーマンス最適化）
    if (!canvasSizeSetRef.current) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      canvasSizeSetRef.current = true;
    }

    const drawFrame = (currentTime: number) => {
      // フレームレート制限
      if (currentTime - lastFrameTimeRef.current < FRAME_INTERVAL) {
        animationFrameRef.current = requestAnimationFrame(drawFrame);
        return;
      }
      lastFrameTimeRef.current = currentTime;

      if (!video.videoWidth || !video.videoHeight) {
        animationFrameRef.current = requestAnimationFrame(drawFrame);
        return;
      }

      // 動画フレームを描画
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      // ランドマークを描画
      if (landmarks && landmarks.length > 0) {
        drawLandmarks(ctx, landmarks, canvas.width, canvas.height);
      }

      animationFrameRef.current = requestAnimationFrame(drawFrame);
    };

    animationFrameRef.current = requestAnimationFrame(drawFrame);

    // クリーンアップ
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      canvasSizeSetRef.current = false;
    };
  }, [videoRef, landmarks, isActive, FRAME_INTERVAL]);

  // ランドマークを描画する関数（簡略化版）
  const drawLandmarks = (
    ctx: CanvasRenderingContext2D,
    landmarks: PoseLandmark[],
    width: number,
    height: number
  ) => {
    // MediaPipe Pose Connections（主要な骨格のみ - パフォーマンス最適化）
    const connections = [
      // 胴体
      [11, 12], // 左肩-右肩
      [11, 23], // 左肩-左腰
      [12, 24], // 右肩-右腰
      [23, 24], // 左腰-右腰

      // 左腕
      [11, 13], // 左肩-左肘
      [13, 15], // 左肘-左手首

      // 右腕
      [12, 14], // 右肩-右肘
      [14, 16], // 右肘-右手首

      // 脚は省略（パフォーマンス優先）
    ];

    // 線を描画
    ctx.strokeStyle = '#00ff00';
    ctx.lineWidth = 2;
    connections.forEach(([start, end]) => {
      if (landmarks[start] && landmarks[end]) {
        const startPoint = landmarks[start];
        const endPoint = landmarks[end];

        // 可視性チェック
        if ((startPoint.visibility ?? 1) > 0.5 && (endPoint.visibility ?? 1) > 0.5) {
          ctx.beginPath();
          ctx.moveTo(startPoint.x * width, startPoint.y * height);
          ctx.lineTo(endPoint.x * width, endPoint.y * height);
          ctx.stroke();
        }
      }
    });

    // ポイントを描画（サイズ縮小 - パフォーマンス最適化）
    ctx.fillStyle = '#ff0000';
    // 主要な関節のみ描画（パフォーマンス最適化）
    const keyPoints = [0, 11, 12, 13, 14, 15, 16, 23, 24]; // 顔、肩、肘、手首、腰
    keyPoints.forEach((index) => {
      const landmark = landmarks[index];
      if (landmark && (landmark.visibility ?? 1) > 0.5) {
        ctx.beginPath();
        ctx.arc(
          landmark.x * width,
          landmark.y * height,
          3, // 5 → 3 に縮小
          0,
          2 * Math.PI
        );
        ctx.fill();
      }
    });
  };

  if (!isActive) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 z-20 bg-black bg-opacity-75 rounded-lg overflow-hidden shadow-lg">
      <div className="relative">
        {/* ランドマーク付きキャンバス（サイズ縮小） */}
        <canvas
          ref={canvasRef}
          className="w-80 h-60 object-cover"
          style={{ transform: 'scaleX(-1)' }} // 鏡像反転
        />

        {/* ラベル */}
        <div className="absolute top-2 left-2 bg-black bg-opacity-50 px-2 py-1 rounded text-white text-xs font-semibold">
          カメラ映像 {landmarks ? `(${landmarks.length}点検出)` : ''}
        </div>
      </div>
    </div>
  );
};
