/**
 * カメラプレビューコンポーネント
 * MediaPipeのカメラ映像とランドマークを表示
 */

import React, { useRef, useEffect } from 'react';
import type { PoseLandmark } from '../../hooks/usePoseEstimation';

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

  // ランドマークを描画
  useEffect(() => {
    if (!canvasRef.current || !videoRef?.current || !isActive) {
      return;
    }

    // videoRefが有効か確認
    if (!videoRef.current.videoWidth || !videoRef.current.videoHeight) {
      console.log('⚠️ カメラ映像がまだ準備できていません');
      return;
    }

    const canvas = canvasRef.current;
    const video = videoRef.current;
    const ctx = canvas.getContext('2d');

    if (!ctx) return;

    const drawFrame = () => {
      if (!video.videoWidth || !video.videoHeight) {
        requestAnimationFrame(drawFrame);
        return;
      }

      // キャンバスサイズを動画に合わせる
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      // 動画フレームを描画
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      // ランドマークを描画
      if (landmarks && landmarks.length > 0) {
        drawLandmarks(ctx, landmarks, canvas.width, canvas.height);
      }

      requestAnimationFrame(drawFrame);
    };

    requestAnimationFrame(drawFrame);
  }, [videoRef, landmarks, isActive]);

  // ランドマークを描画する関数
  const drawLandmarks = (
    ctx: CanvasRenderingContext2D,
    landmarks: PoseLandmark[],
    width: number,
    height: number
  ) => {
    // MediaPipe Pose Connections（骨格の線）
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

      // 左脚
      [23, 25], // 左腰-左膝
      [25, 27], // 左膝-左足首

      // 右脚
      [24, 26], // 右腰-右膝
      [26, 28], // 右膝-右足首

      // 顔
      [0, 1],   // 鼻-左目内側
      [0, 4],   // 鼻-右目内側
      [1, 2],   // 左目内側-左目
      [4, 5],   // 右目内側-右目
      [2, 3],   // 左目-左目外側
      [5, 6],   // 右目-右目外側
      [9, 10],  // 口左-口右
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

    // ポイントを描画
    ctx.fillStyle = '#ff0000';
    landmarks.forEach((landmark) => {
      if ((landmark.visibility ?? 1) > 0.5) {
        ctx.beginPath();
        ctx.arc(
          landmark.x * width,
          landmark.y * height,
          5,
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

  console.log('🎥 CameraPreview rendering:', {
    hasVideoRef: !!videoRef?.current,
    hasLandmarks: !!landmarks,
    landmarkCount: landmarks?.length || 0,
    isActive
  });

  return (
    <div className="fixed bottom-4 right-4 z-20 bg-black bg-opacity-75 rounded-lg overflow-hidden shadow-lg">
      <div className="relative">
        {/* ランドマーク付きキャンバス */}
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
