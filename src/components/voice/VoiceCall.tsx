"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  LiveKitRoom,
  RoomAudioRenderer,
  useLocalParticipant,
  useRoomContext,
  useConnectionState,
  useMediaDeviceSelect,
  useParticipants,
  useParticipantContext,
  ParticipantLoop,
  useIsSpeaking,
} from "@livekit/components-react";
import { ConnectionState, LocalAudioTrack } from "livekit-client";
import "@livekit/components-styles";
import { Mic, MicOff, Settings, X } from "lucide-react";
import { Button } from "@/components/ui";
import { getFunctions, httpsCallable } from "firebase/functions";
import { app } from "@/lib/firebaseConfig";
import type { VoiceCallState } from "@/types/voice";

interface VoiceCallProps {
  roomId: string;
  participantName: string;
  onLeave?: () => void;
  onStateChange?: (state: VoiceCallState) => void;
  serverMemberCount?: number;
  className?: string; // スタイル調整用
}

// デバイス選択用コンポーネント
function DeviceSettings({ onClose }: { onClose: () => void }) {
  const {
    devices: audioInputDevices,
    activeDeviceId: activeAudioInputDeviceId,
    setActiveMediaDevice: setActiveAudioInputDevice,
  } = useMediaDeviceSelect({ kind: "audioinput" });

  const {
    devices: audioOutputDevices,
    activeDeviceId: activeAudioOutputDeviceId,
    setActiveMediaDevice: setActiveAudioOutputDevice,
  } = useMediaDeviceSelect({ kind: "audiooutput" });

  return (
    <div className="absolute bottom-full mb-4 left-1/2 transform -translate-x-1/2 w-72 bg-gray-800 border border-gray-700 rounded-xl shadow-2xl p-4 z-50">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-white font-semibold">オーディオ設定</h3>
        <Button
          variant="ghost"
          size="sm"
          onClick={onClose}
          className="h-6 w-6 p-0 text-gray-400 hover:text-white"
        >
          <X className="w-4 h-4" />
        </Button>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <label
            htmlFor="audio-input-select"
            className="text-xs text-gray-400 uppercase font-bold tracking-wider"
          >
            マイク
          </label>
          <select
            id="audio-input-select"
            className="w-full bg-gray-900 border border-gray-600 text-white text-sm rounded-lg p-2.5 focus:ring-blue-500 focus:border-blue-500"
            value={activeAudioInputDeviceId}
            onChange={(e) => setActiveAudioInputDevice(e.target.value)}
          >
            {audioInputDevices.map((device: MediaDeviceInfo) => (
              <option key={device.deviceId} value={device.deviceId}>
                {device.label || `マイク ${device.deviceId.slice(0, 5)}...`}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <label
            htmlFor="audio-output-select"
            className="text-xs text-gray-400 uppercase font-bold tracking-wider"
          >
            スピーカー
          </label>
          <select
            id="audio-output-select"
            className="w-full bg-gray-900 border border-gray-600 text-white text-sm rounded-lg p-2.5 focus:ring-blue-500 focus:border-blue-500"
            value={activeAudioOutputDeviceId}
            onChange={(e) => setActiveAudioOutputDevice(e.target.value)}
          >
            {audioOutputDevices.map((device: MediaDeviceInfo) => (
              <option key={device.deviceId} value={device.deviceId}>
                {device.label || `スピーカー ${device.deviceId.slice(0, 5)}...`}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}

// 参加者個別のタイルコンポーネント
function ParticipantTile() {
  const participant = useParticipantContext();
  const isSpeaking = useIsSpeaking(participant);

  if (!participant) return null;

  // 名前からイニシャルを取得
  const getInitials = (name: string) => {
    return name.slice(0, 2).toUpperCase();
  };

  // 表示名（ID部分は隠す）
  const displayName =
    participant.identity.split("-")[0] || participant.identity;
  const isMicrophoneEnabled = participant.isMicrophoneEnabled;

  return (
    <div className="relative flex flex-col items-center justify-center p-4">
      <div
        className={`relative w-24 h-24 rounded-full flex items-center justify-center mb-3 transition-all duration-300 ${
          isSpeaking
            ? "ring-4 ring-green-500 shadow-[0_0_20px_rgba(34,197,94,0.4)]"
            : "ring-2 ring-gray-700"
        } ${
          participant.isLocal
            ? "bg-gradient-to-br from-blue-600 to-purple-600"
            : "bg-gray-700"
        }`}
      >
        <span className="text-2xl font-bold text-white">
          {getInitials(displayName)}
        </span>

        {/* ミュートアイコン */}
        {!isMicrophoneEnabled && (
          <div className="absolute bottom-0 right-0 bg-red-500 rounded-full p-1.5 border-2 border-gray-900">
            <MicOff className="w-4 h-4 text-white" />
          </div>
        )}
      </div>

      <div className="text-center">
        <p className="text-white font-medium truncate max-w-[120px]">
          {displayName} {participant.isLocal && "(あなた)"}
        </p>
        <p className="text-xs text-gray-400 mt-1 h-4">
          {isSpeaking ? "話しています..." : ""}
        </p>
      </div>
    </div>
  );
}

// 参加者グリッド表示コンポーネント
function ParticipantGrid() {
  const participants = useParticipants();

  return (
    <div className="w-full max-w-4xl mx-auto p-6">
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-8 justify-items-center">
        <ParticipantLoop participants={participants}>
          <ParticipantTile />
        </ParticipantLoop>
      </div>

      {participants.length === 0 && (
        <div className="text-center text-gray-500 py-12">
          参加者を待機しています...
        </div>
      )}
    </div>
  );
}

// 内部コンポーネント: 実際の通話UIとロジックを担当
function VoiceCallContent({
  onLeave,
  onStateChange,
  serverMemberCount,
}: {
  onLeave?: () => void;
  onStateChange?: (state: VoiceCallState) => void;
  serverMemberCount?: number;
}) {
  const room = useRoomContext();
  const connectionState = useConnectionState();
  const { isMicrophoneEnabled, localParticipant, microphoneTrack } =
    useLocalParticipant();
  const [localAudioLevel, setLocalAudioLevel] = useState(0);
  const [showSettings, setShowSettings] = useState(false);
  const [disconnectError, setDisconnectError] = useState<string | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const animationRef = useRef<number | null>(null);

  // 接続状態の監視と親への通知
  useEffect(() => {
    const isConnected = connectionState === ConnectionState.Connected;
    // 参加者数はMapのサイズから取得
    const participantCount = room.remoteParticipants.size + 1; // 自分を含める

    // サーバー側の参加者数との不整合を検出（開発環境でログ出力）
    if (
      serverMemberCount !== undefined &&
      serverMemberCount !== participantCount &&
      process.env.NODE_ENV === "development"
    ) {
      console.warn(
        `参加者数の不整合を検出: サーバー=${serverMemberCount}, クライアント=${participantCount}`
      );
    }

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
    serverMemberCount,
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
      setDisconnectError(
        "音声監視の設定に失敗しました。もう一度お試しください。"
      );
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
    try {
      setDisconnectError(null);
      await room.disconnect();
      // 正常に退出した場合、親コンポーネントに通知
      onLeave?.();
    } catch (error) {
      console.error("Failed to disconnect from LiveKit room:", error);
      setDisconnectError(
        "退室処理中にエラーが発生しました。もう一度お試しください。"
      );
    }
  }, [room, onLeave]);

  // UIレンダリング
  if (connectionState !== ConnectionState.Connected) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mb-4"></div>
        <div className="animate-pulse text-yellow-400">
          LiveKitサーバーに接続中...
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full w-full relative">
      {/* メインエリア：参加者グリッド */}
      <div className="flex-1 overflow-y-auto flex items-center justify-center min-h-[400px]">
        <ParticipantGrid />
      </div>

      {/* エラーメッセージ */}
      {disconnectError && (
        <div className="fixed bottom-32 left-1/2 transform -translate-x-1/2 bg-red-500/90 text-white px-4 py-2 rounded-lg shadow-lg z-50">
          {disconnectError}
        </div>
      )}

      {/* コントロールバー */}
      <div className="fixed bottom-8 left-1/2 transform -translate-x-1/2 flex items-center gap-4 bg-gray-900/90 p-4 rounded-2xl border border-gray-700 shadow-xl backdrop-blur-sm z-50">
        {/* 設定メニュー */}
        {showSettings && (
          <DeviceSettings onClose={() => setShowSettings(false)} />
        )}

        {/* 設定ボタン */}
        <Button
          onClick={() => setShowSettings(!showSettings)}
          variant="outline"
          size="icon"
          className={`rounded-full w-12 h-12 border-gray-600 text-gray-300 hover:bg-gray-800 hover:text-white ${
            showSettings ? "bg-gray-800 text-white ring-2 ring-blue-500" : ""
          }`}
        >
          <Settings className="w-5 h-5" />
        </Button>

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
            {[0, 1, 2, 3, 4].map((barIndex) => (
              <div
                key={`audio-bar-${barIndex}`}
                className="w-1.5 bg-green-500 rounded-full transition-all duration-75"
                style={{
                  height: isMicrophoneEnabled
                    ? `${Math.max(10, Math.min(100, localAudioLevel * (1 + barIndex * 0.2)))}%`
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
    </div>
  );
}

export default function VoiceCall({
  roomId,
  participantName,
  onLeave,
  onStateChange,
  serverMemberCount,
  className,
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
      <div className="flex items-center justify-center p-8 h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className={`w-full h-full ${className || ""}`}>
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
        onError={(err: Error) => {
          console.error("LiveKit Room Error:", err);
          setError("接続中にエラーが発生しました。再度お試しください。");
        }}
        className="h-full w-full"
      >
        <VoiceCallContent
          onLeave={onLeave}
          onStateChange={onStateChange}
          serverMemberCount={serverMemberCount}
        />
        <RoomAudioRenderer />
      </LiveKitRoom>
    </div>
  );
}
