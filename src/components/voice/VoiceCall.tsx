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
import { AvatarSender } from "@/components/avatar/AvatarSender";
import { AvatarReceiver } from "@/components/avatar/AvatarReceiver";
import { BoneRotations } from "@/types/avatar";
import { Canvas } from "@react-three/fiber"; // Start of Avatar integration

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
            {audioInputDevices.map((device) => (
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
            {audioOutputDevices.map((device) => (
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
function ParticipantTile({
  localRotations,
}: {
  localRotations?: BoneRotations | null;
}) {
  const participant = useParticipantContext();
  const isSpeaking = useIsSpeaking(participant);

  if (!participant) return null;

  // 表示名（ID部分は隠す）
  const displayName =
    participant.identity.split("-")[0] || participant.identity;
  const isMicrophoneEnabled = participant.isMicrophoneEnabled;

  // Pass manual rotations only if it's the local participant
  const manualRotations = participant.isLocal ? localRotations : undefined;

  return (
    <div className="relative flex flex-col items-center justify-center p-2 w-full h-full">
      <div
        className={`relative w-48 h-48 sm:w-56 sm:h-56 rounded-xl overflow-hidden mb-3 transition-all duration-300 border-2 ${
          isSpeaking
            ? "border-green-500 shadow-[0_0_20px_rgba(34,197,94,0.4)]"
            : "border-gray-700"
        } bg-gray-900`}
      >
        {/* 3D Avatar View */}
        <Canvas camera={{ position: [0, 1.4, 0.7], fov: 50 }}>
          <ambientLight intensity={0.8} />
          <directionalLight position={[0, 0, 5]} intensity={1} />
          {/* <OrbitControls target={[0, 1.4, 0]} /> Orbit disabled for stable view, or enable if needed */}
          <AvatarReceiver
            participant={participant}
            defaultAvatarUrl="/vrm/vroid_model_6689695945343414173.vrm"
            manualRotations={manualRotations}
          />
        </Canvas>

        {/* ミュートアイコン */}
        {!isMicrophoneEnabled && (
          <div className="absolute bottom-2 right-2 bg-red-500 rounded-full p-1.5 border-2 border-gray-900 z-10">
            <MicOff className="w-4 h-4 text-white" />
          </div>
        )}

        {/* Speaking Indicator Overlay (Optional, if border is not enough) */}
        {isSpeaking && (
          <div className="absolute inset-0 border-4 border-green-500 rounded-xl pointer-events-none opacity-50"></div>
        )}
      </div>

      <div className="text-center w-full">
        <p className="text-white font-medium truncate px-2">
          {displayName} {participant.isLocal && "(あなた)"}
        </p>
      </div>
    </div>
  );
}

// 参加者グリッド表示コンポーネント
function ParticipantGrid({
  localRotations,
}: {
  localRotations?: BoneRotations | null;
}) {
  const participants = useParticipants();

  return (
    <div className="w-full max-w-6xl mx-auto p-4 h-full flex items-center justify-center">
      <div className="flex flex-wrap justify-center gap-6 w-full">
        <ParticipantLoop participants={participants}>
          <div className="w-64 h-72">
            <ParticipantTile localRotations={localRotations} />
          </div>
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
  // ... inside VoiceCallContent ...
  const [localAudioLevel, setLocalAudioLevel] = useState(0);
  const [showSettings, setShowSettings] = useState(false);
  const [disconnectError, setDisconnectError] = useState<string | null>(null);

  // Avatar Integration State
  const [localRotations, setLocalRotations] = useState<BoneRotations | null>(
    null
  );
  const [isCameraOn, setIsCameraOn] = useState(true); // Control for AvatarSender
  const [initMeta, setInitMeta] = useState(false);

  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const animationRef = useRef<number | null>(null);

  // Set initial metadata (Avatar URL)
  useEffect(() => {
    if (
      localParticipant &&
      room.state === "connected" &&
      !initMeta &&
      localParticipant.permissions?.canUpdateMetadata
    ) {
      const setMeta = async () => {
        try {
          // TODO: Make this dynamic based on user profile
          const metadata = JSON.stringify({
            avatarUrl: "/vrm/vroid_model_6689695945343414173.vrm",
          });
          await localParticipant.setMetadata(metadata);
          setInitMeta(true);
          console.log("Metadata set successfully for VoiceCall");
        } catch (e) {
          console.error("Failed to set metadata:", e);
        }
      };
      // Small delay to ensure stability
      setTimeout(setMeta, 1000);
    }
  }, [localParticipant, room.state, initMeta]);

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
    // ... loading UI ...
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
      {/* Invisible/Utility components for Sender */}
      <div className="absolute top-0 right-0 w-32 h-24 opacity-0 hover:opacity-100 transition-opacity z-50 pointer-events-none hover:pointer-events-auto bg-black border border-gray-600">
        {/* Camera Preview (Small debug view) */}
        <AvatarSender
          autoStart={isCameraOn}
          onRotationsUpdate={setLocalRotations}
        />
      </div>

      {/* メインエリア：参加者グリッド */}
      <div className="flex-1 overflow-y-auto flex items-center justify-center min-h-[400px]">
        <ParticipantGrid localRotations={localRotations} />
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

        {/* カメラ (アバターモーション) ボタン */}
        <Button
          onClick={() => setIsCameraOn(!isCameraOn)}
          variant={isCameraOn ? "default" : "destructive"} // Greenish if on, Red if off? Or just consistent style
          size="lg"
          className={`rounded-full w-14 h-14 flex items-center justify-center transition-all duration-300 ${
            isCameraOn
              ? "bg-green-600 hover:bg-green-700 shadow-[0_0_15px_rgba(34,197,94,0.3)]"
              : "bg-gray-700 hover:bg-gray-600"
          }`}
          title="モーションキャプチャ切り替え"
        >
          {/* Simple Icon for now, assuming Video icon from lucide or text */}
          <div className="text-white font-bold text-xs">
            {isCameraOn ? "CAM ON" : "CAM OFF"}
          </div>
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
        onError={(err) => {
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
