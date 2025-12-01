"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  LiveKitRoom,
  RoomAudioRenderer,
  useLocalParticipant,
  useRoomContext,
  useConnectionState,
} from "@livekit/components-react";
import { ConnectionState, LocalAudioTrack } from "livekit-client";
import "@livekit/components-styles";
import { Mic, MicOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getFunctions, httpsCallable } from "firebase/functions";
import { app } from "@/lib/firebaseConfig";
import type { VoiceCallState } from "@/types/voice";

interface VoiceCallProps {
  roomId: string;
  participantName: string;
  onLeave?: () => void;
  onStateChange?: (state: VoiceCallState) => void;
  serverMemberCount?: number;
}

// 内部コンポーネント: 実際の通話UIとロジックを担当
function VoiceCallContent({
  onLeave,
  onStateChange,
}: {
  onLeave?: () => void;
  onStateChange?: (state: VoiceCallState) => void;
}) {
  const room = useRoomContext();
  const connectionState = useConnectionState();
  const { isMicrophoneEnabled, localParticipant, microphoneTrack } =
    useLocalParticipant();
  const [localAudioLevel, setLocalAudioLevel] = useState(0);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const animationRef = useRef<number | null>(null);

  // 接続状態の監視と親への通知
  useEffect(() => {
    const isConnected = connectionState === ConnectionState.Connected;
    // 参加者数はMapのサイズから取得
    const participantCount = room.remoteParticipants.size + 1; // 自分を含める

    onStateChange?.({
      isConnected,
      isMuted: !isMicrophoneEnabled,
      participants: Array.from(room.remoteParticipants.values()),
      actualParticipantCount: participantCount,
    });
  }, [
    connectionState,
    isMicrophoneEnabled,
    room.remoteParticipants,
    onStateChange,
  ]);

  // 音声レベル監視ロジック
  useEffect(() => {
    const audioTrack = microphoneTrack?.track as LocalAudioTrack | undefined;
    if (!audioTrack?.mediaStreamTrack) {
      return;
    }

    const track = audioTrack.mediaStreamTrack;

    try {
      const AudioContextClass =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      const audioContext = new AudioContextClass();
      audioContextRef.current = audioContext;
      const analyser = audioContext.createAnalyser();
      analyserRef.current = analyser;
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0.8;

      const source = audioContext.createMediaStreamSource(
        new MediaStream([track])
      );
      source.connect(analyser);

      const updateAudioLevel = () => {
        if (!analyser) return;
        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        analyser.getByteFrequencyData(dataArray);

        let sum = 0;
        let count = 0;
        for (let i = 0; i < dataArray.length; i++) {
          if (dataArray[i] > 0) {
            sum += dataArray[i];
            count++;
          }
        }
        const average = count > 0 ? sum / count : 0;
        const normalizedLevel = Math.min(100, (average / 255) * 100);
        setLocalAudioLevel(normalizedLevel);

        animationRef.current = requestAnimationFrame(updateAudioLevel);
      };

      updateAudioLevel();
    } catch (error) {
      console.error("Audio monitoring setup failed:", error);
    }

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, [microphoneTrack]);

  // マイクの切り替え
  const toggleMute = useCallback(async () => {
    if (localParticipant) {
      const newState = !isMicrophoneEnabled;
      await localParticipant.setMicrophoneEnabled(newState);
    }
  }, [localParticipant, isMicrophoneEnabled]);

  // 退出処理
  const handleDisconnect = useCallback(async () => {
    await room.disconnect();
    onLeave?.();
  }, [room, onLeave]);

  // UIレンダリング
  if (connectionState !== ConnectionState.Connected) {
    return (
      <div className="flex items-center justify-center p-4">
        <div className="animate-pulse text-yellow-400">接続中...</div>
      </div>
    );
  }

  return (
    <div className="fixed bottom-8 left-1/2 transform -translate-x-1/2 flex items-center gap-4 bg-gray-900/90 p-4 rounded-2xl border border-gray-700 shadow-xl backdrop-blur-sm z-50">
      {/* マイクボタン */}
      <Button
        onClick={toggleMute}
        variant={isMicrophoneEnabled ? "default" : "destructive"}
        size="lg"
        className={`rounded-full w-16 h-16 flex items-center justify-center transition-all duration-300 ${
          isMicrophoneEnabled
            ? "bg-blue-600 hover:bg-blue-700 shadow-[0_0_15px_rgba(37,99,235,0.5)]"
            : "bg-red-600 hover:bg-red-700"
        }`}
      >
        {isMicrophoneEnabled ? (
          <Mic className="w-8 h-8" />
        ) : (
          <MicOff className="w-8 h-8" />
        )}
      </Button>

      {/* オーディオビジュアライザー（簡易版） */}
      <div className="flex flex-col items-center justify-center w-32">
        <div className="flex items-end gap-1 h-8 mb-1">
          {[...Array(5)].map((_, i) => (
            <div
              key={i}
              className="w-1.5 bg-green-500 rounded-full transition-all duration-75"
              style={{
                height: isMicrophoneEnabled
                  ? `${Math.max(10, Math.min(100, localAudioLevel * (1 + i * 0.2)))}%`
                  : "10%",
                opacity: isMicrophoneEnabled ? 1 : 0.3,
              }}
            />
          ))}
        </div>
        <span className="text-xs text-gray-400 font-mono">
          {isMicrophoneEnabled ? "ON AIR" : "MUTED"}
        </span>
      </div>

      {/* 退出ボタン */}
      <Button
        onClick={handleDisconnect}
        variant="outline"
        className="ml-4 border-red-500/50 text-red-400 hover:bg-red-950/30 hover:text-red-300"
      >
        退出
      </Button>
    </div>
  );
}

export default function VoiceCall({
  roomId,
  participantName,
  onLeave,
  onStateChange,
}: VoiceCallProps) {
  const [token, setToken] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchToken = async () => {
      try {
        const region =
          process.env.NEXT_PUBLIC_FIREBASE_FUNCTIONS_REGION || "us-central1";
        const functions = getFunctions(app, region);
        const generateToken = httpsCallable(functions, "generateLivekitToken");
        const result = await generateToken({ roomId, participantName });
        const data = result.data as { token: string };
        setToken(data.token);
      } catch (e) {
        console.error("Token generation failed:", e);
        setError("トークンの取得に失敗しました");
      }
    };

    if (roomId && participantName) {
      fetchToken();
    }
  }, [roomId, participantName]);

  // LiveKit serverUrlの検証
  const livekitUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL;
  if (!livekitUrl) {
    console.error(
      "NEXT_PUBLIC_LIVEKIT_URL environment variable is not configured"
    );
    const urlError =
      "LiveKitサーバーのURLが設定されていません。環境変数を確認してください。";
    return <div className="text-red-500 p-4">{urlError}</div>;
  }

  if (error) {
    return <div className="text-red-500 p-4">{error}</div>;
  }

  if (!token) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <LiveKitRoom
      video={false}
      audio={true}
      token={token}
      serverUrl={livekitUrl}
      connect={true}
      data-lk-theme="default"
      onDisconnected={() => {
        console.log("Disconnected from room");
        onLeave?.();
      }}
      onError={(err) => {
        console.error("LiveKit Room Error:", err);
      }}
    >
      <VoiceCallContent onLeave={onLeave} onStateChange={onStateChange} />
      <RoomAudioRenderer />
    </LiveKitRoom>
  );
}
