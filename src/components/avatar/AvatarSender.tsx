"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useLocalParticipant, useRoomContext } from "@livekit/components-react";
import { usePoseEstimation } from "@/hooks/usePoseEstimation";
import { calculateRiggedPose } from "@/lib/vrm-retargeter-kalidokit";
import { MotionDataPacket, BoneRotations } from "@/types/avatar";

interface AvatarSenderProps {
  autoStart?: boolean;
  onRotationsUpdate?: (rotations: BoneRotations) => void;
}

export const AvatarSender: React.FC<AvatarSenderProps> = ({
  autoStart = false,
  onRotationsUpdate,
}) => {
  const { localParticipant } = useLocalParticipant();
  const roomContext = useRoomContext(); // Use Room Context
  const [isSending, setIsSending] = useState(false);
  const animationFrameRef = useRef<number | null>(null);
  const lastSendTimeRef = useRef<number>(0);
  const frameCounterRef = useRef<number>(0); // For logging

  // 送信レート制限 (FPS)
  const SEND_FPS = 30;
  const SEND_INTERVAL = 1000 / SEND_FPS;

  // ポーズ推定フック
  const {
    landmarks,
    worldLandmarks,
    isInitialized,
    isLoading,
    error,
    isCameraPermissionGranted,
    startCamera,
    stopCamera,
    videoRef,
  } = usePoseEstimation();

  // データ送信ループ
  const sendLoop = useCallback(async () => {
    if (!localParticipant) return;

    frameCounterRef.current = (frameCounterRef.current || 0) + 1;
    const currentFrame = frameCounterRef.current;

    // 接続状態チェック
    if (roomContext.state !== "connected") {
      if (currentFrame % 60 === 0)
        console.log(
          "AvatarSender: Waiting for connection...",
          roomContext.state
        );
      animationFrameRef.current = requestAnimationFrame(sendLoop);
      return;
    }

    const now = performance.now();

    if (now - lastSendTimeRef.current >= SEND_INTERVAL) {
      // Heartbeat log every ~2 seconds (60 frames at 30fps)
      if (currentFrame % 60 === 0) {
        console.log(
          "AvatarSender: Loop Active. Landmarks:",
          !!landmarks,
          "Len:",
          landmarks?.length
        );
      }

      // 1. データ構築
      let packet: MotionDataPacket;

      // ランドマークがあればポーズ計算
      if (landmarks && landmarks.length > 0) {
        const rotations = calculateRiggedPose(landmarks, worldLandmarks);

        if (rotations) {
          // Local Loopback for preview
          if (onRotationsUpdate) {
            onRotationsUpdate(rotations);
          }

          packet = {
            t: "m",
            v: 1, // Camera ON
            bones: rotations,
          };
        } else {
          // Log failure reason occasionally
          if (currentFrame % 60 === 0) {
            console.warn("AvatarSender: Rigged pose calc failed (null)");
          }
          // パケット生成失敗時などはIdle扱いにするかスキップ
          packet = { t: "m", v: 0 };
        }
      } else {
        // カメラは動いているが認識できない、またはオフの状態
        // ここでは単純にオフとして扱う（または無データ）
        packet = { t: "m", v: 0 };
      }

      // 2. 送信
      const encoder = new TextEncoder();
      const payload = encoder.encode(JSON.stringify(packet));

      try {
        await localParticipant.publishData(payload, {
          reliable: false, // UDP mode / lossy
          topic: "avatar-motion",
        });

        if (packet.v === 1 && currentFrame % 30 === 0) {
          console.log(
            "AvatarSender: Sent motion packet",
            Object.keys(packet.bones || {}).length,
            "bones"
          );
        }
      } catch (e) {
        console.warn("Retriable error sending avatar data:", e);
        // 接続切れなどの場合はループ継続しつつエラーを握りつぶし、再接続を待つ
      }

      lastSendTimeRef.current = now;
    }

    animationFrameRef.current = requestAnimationFrame(sendLoop);
  }, [
    localParticipant,
    roomContext,
    landmarks,
    worldLandmarks,
    SEND_INTERVAL,
    onRotationsUpdate,
  ]);

  // 開始/停止制御
  useEffect(() => {
    if (isSending && isInitialized) {
      startCamera();
      animationFrameRef.current = requestAnimationFrame(sendLoop);
    } else {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      stopCamera();
    }

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isSending, isInitialized, startCamera, stopCamera, sendLoop]);

  // マウント時の自動開始処理
  useEffect(() => {
    if (autoStart) {
      setIsSending(true);
    }
  }, [autoStart]);

  // デバッグ用: カメラ映像を表示
  return (
    <div className="relative w-full h-full bg-black">
      <video
        ref={videoRef}
        className="w-full h-full object-cover transform -scale-x-100" // Mirror effect
        autoPlay
        playsInline
        muted
      />

      {/* Debug Overlay */}
      <div className="absolute top-0 left-0 w-full p-2 pointer-events-none">
        <div className="flex flex-col gap-1 items-end">
          {isSending && (
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              <span className="text-xs text-white bg-black/50 px-1 rounded">
                LIVE
              </span>
            </div>
          )}
          <div className="text-[10px] text-white bg-black/50 px-1 rounded text-right">
            <div>Init: {isInitialized ? "OK" : "No"}</div>
            <div>Loading: {isLoading ? "Yes" : "No"}</div>
            <div>Perm: {isCameraPermissionGranted ? "OK" : "No"}</div>
            <div>Landmarks: {landmarks ? "Detected" : "None"}</div>
            {error && <div className="text-red-400 font-bold">{error}</div>}
          </div>
        </div>
      </div>
    </div>
  );
};
