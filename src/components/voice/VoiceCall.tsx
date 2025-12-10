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
import { ConnectionState } from "livekit-client";
import "@livekit/components-styles";
import { Mic, MicOff, Settings, X, Video, VideoOff } from "lucide-react";
import { Button } from "@/components/ui";
import { getFunctions, httpsCallable } from "firebase/functions";
import { app } from "@/lib/firebaseConfig";
import type { VoiceCallState } from "@/types/voice";
import { AvatarSender } from "@/components/avatar/AvatarSender";
import { AvatarReceiver } from "@/components/avatar/AvatarReceiver";
import { BoneRotations, AvatarMetadata } from "@/types/avatar";
import { Canvas, useThree } from "@react-three/fiber";
import { useVModel } from "@/contexts/VModelContext";
import { useVRoidModels } from "@/hooks/useVRoidModels";
import { ensureVRMInStorage } from "@/lib/vrmStorage";
import { VRMDownloader } from "@/lib/vrmDownloader";
import { useAuth } from "@/contexts/AuthContext";

// Canvas内でカメラ位置を安全に更新するためのヘルパーコンポーネント
function CameraUpdater({ position }: { position: [number, number, number] }) {
  const { camera } = useThree();
  useEffect(() => {
    camera.position.set(...position);
    camera.lookAt(0, 1.4, 0); // ターゲットを見続ける
  }, [camera, position]);
  return null;
}

interface VoiceCallProps {
  roomId: string;
  participantName: string;
  onLeave?: () => void;
  onStateChange?: (state: VoiceCallState) => void;
  serverMemberCount?: number;
  className?: string; // スタイル調整用
}

// デバイス&3D設定用コンポーネント
function DeviceSettings({
  onClose,
  cameraConfig,
  setCameraConfig,
  avatarOffset,
  setAvatarOffset,
  avatarScale,
  setAvatarScale,
}: {
  onClose: () => void;
  cameraConfig: [number, number, number];
  setCameraConfig: (pos: [number, number, number]) => void;
  avatarOffset: { x: number; y: number; z: number };
  setAvatarOffset: (offset: { x: number; y: number; z: number }) => void;
  avatarScale: number;
  setAvatarScale: (scale: number) => void;
}) {
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

  // ドラッグ処理のロジック
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<{
    x: number;
    y: number;
    offsetX: number;
    offsetY: number;
  } | null>(null);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging || !dragStartRef.current) return;

      const dx = e.clientX - dragStartRef.current.x;
      const dy = e.clientY - dragStartRef.current.y;

      setOffset({
        x: dragStartRef.current.offsetX + dx,
        y: dragStartRef.current.offsetY + dy,
      });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      dragStartRef.current = null;
    };

    if (isDragging) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    }
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging]);

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      offsetX: offset.x,
      offsetY: offset.y,
    };
  };

  return (
    <div
      className="fixed bottom-24 left-4 w-72 bg-gray-800 border border-gray-700 rounded-xl shadow-2xl z-50 overflow-hidden flex flex-col"
      style={{ transform: `translate(${offset.x}px, ${offset.y}px)` }}
    >
      <div
        className="flex justify-between items-center p-4 bg-gray-900/50 cursor-grab active:cursor-grabbing border-b border-gray-700"
        onMouseDown={handleMouseDown}
      >
        <h3 className="text-white font-semibold flex-1 select-none">
          オーディオ設定
        </h3>
        <Button
          variant="ghost"
          size="sm"
          onClick={onClose}
          className="h-6 w-6 p-0 text-gray-400 hover:text-white"
        >
          <X className="w-4 h-4" />
        </Button>
      </div>

      <div className="p-4 pt-2">
        {/* オーディオ設定 (既存) */}
        <div className="space-y-4 border-b border-gray-700 pb-4">
          <h4 className="text-sm font-semibold text-gray-300">
            オーディオ設定
          </h4>
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
                  {device.label ||
                    `スピーカー ${device.deviceId.slice(0, 5)}...`}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* 3D表示調整設定 (新規) */}
        <div className="space-y-4">
          <h4 className="text-sm font-semibold text-gray-300">3D表示調整</h4>

          {/* カメラ位置 (ローカル) */}
          <div className="space-y-2">
            <div className="text-xs text-green-400 uppercase font-bold tracking-wider flex justify-between">
              <span>カメラ視点 (自分のみ)</span>
              <span className="font-mono text-[10px]">
                X:{cameraConfig[0].toFixed(1)} Y:{cameraConfig[1].toFixed(1)} Z:
                {cameraConfig[2].toFixed(1)}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label
                  htmlFor="camera-x-range"
                  className="text-[10px] text-gray-500 block text-center"
                >
                  左右
                </label>
                <input
                  id="camera-x-range"
                  type="range"
                  min="-2"
                  max="2"
                  step="0.1"
                  value={cameraConfig[0]}
                  onChange={(e) =>
                    setCameraConfig([
                      parseFloat(e.target.value),
                      cameraConfig[1],
                      cameraConfig[2],
                    ])
                  }
                  className="w-full h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer"
                />
              </div>
              <div>
                <label
                  htmlFor="camera-y-range"
                  className="text-[10px] text-gray-500 block text-center"
                >
                  高さ
                </label>
                <input
                  id="camera-y-range"
                  type="range"
                  min="0.5"
                  max="2.5"
                  step="0.1"
                  value={cameraConfig[1]}
                  onChange={(e) =>
                    setCameraConfig([
                      cameraConfig[0],
                      parseFloat(e.target.value),
                      cameraConfig[2],
                    ])
                  }
                  className="w-full h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer"
                />
              </div>
              <div>
                <label
                  htmlFor="camera-z-range"
                  className="text-[10px] text-gray-500 block text-center"
                >
                  距離
                </label>
                <input
                  id="camera-z-range"
                  type="range"
                  min="0.2"
                  max="3"
                  step="0.1"
                  value={cameraConfig[2]}
                  onChange={(e) =>
                    setCameraConfig([
                      cameraConfig[0],
                      cameraConfig[1],
                      parseFloat(e.target.value),
                    ])
                  }
                  className="w-full h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer"
                />
              </div>
            </div>
          </div>

          {/* アバター位置補正 (共有) */}
          <div className="space-y-2">
            <div className="text-xs text-blue-400 uppercase font-bold tracking-wider flex justify-between">
              <span>アバター位置補正 (共有)</span>
              <span className="font-mono text-[10px]">
                X:{avatarOffset.x.toFixed(2)} Y:{avatarOffset.y.toFixed(2)} Z:
                {avatarOffset.z.toFixed(2)}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label
                  htmlFor="avatar-offset-x-range"
                  className="text-[10px] text-gray-500 block text-center"
                >
                  X (左右)
                </label>
                <input
                  id="avatar-offset-x-range"
                  type="range"
                  min="-1"
                  max="1"
                  step="0.05"
                  value={avatarOffset.x}
                  onChange={(e) =>
                    setAvatarOffset({
                      ...avatarOffset,
                      x: parseFloat(e.target.value),
                    })
                  }
                  className="w-full h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer"
                />
              </div>
              <div>
                <label
                  htmlFor="avatar-offset-y-range"
                  className="text-[10px] text-gray-500 block text-center"
                >
                  Y (高さ)
                </label>
                <input
                  id="avatar-offset-y-range"
                  type="range"
                  min="-1.5"
                  max="1"
                  step="0.05"
                  value={avatarOffset.y}
                  onChange={(e) =>
                    setAvatarOffset({
                      ...avatarOffset,
                      y: parseFloat(e.target.value),
                    })
                  }
                  className="w-full h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer"
                />
              </div>
              <div>
                <label
                  htmlFor="avatar-offset-z-range"
                  className="text-[10px] text-gray-500 block text-center"
                >
                  Z (前後)
                </label>
                <input
                  id="avatar-offset-z-range"
                  type="range"
                  min="-1"
                  max="1"
                  step="0.05"
                  value={avatarOffset.z}
                  onChange={(e) =>
                    setAvatarOffset({
                      ...avatarOffset,
                      z: parseFloat(e.target.value),
                    })
                  }
                  className="w-full h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer"
                />
              </div>
            </div>
            <p className="text-[10px] text-gray-400 mt-1">
              ※この設定は他の参加者の画面にも反映されます
            </p>
          </div>

          {/* アバターサイズ (共有) */}
          <div className="space-y-2">
            <label
              htmlFor="avatar-scale-range"
              className="text-xs text-purple-400 uppercase font-bold tracking-wider flex justify-between"
            >
              <span>アバターサイズ (共有)</span>
              <span className="font-mono text-[10px]">
                x{avatarScale.toFixed(2)}
              </span>
            </label>
            <div>
              <input
                id="avatar-scale-range"
                type="range"
                min="0.5"
                max="2.0"
                step="0.05"
                value={avatarScale}
                onChange={(e) => setAvatarScale(parseFloat(e.target.value))}
                className="w-full h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer"
                aria-label="アバターサイズ調整"
              />
              <div className="flex justify-between text-[10px] text-gray-500 mt-1">
                <span>0.5x</span>
                <span>1.0x</span>
                <span>2.0x</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// 参加者個別のタイルコンポーネント
function ParticipantTile({
  localRotations,
  cameraConfig,
  myAvatarOffset,
  myAvatarScale,
  selectedModel,
}: {
  localRotations?: BoneRotations | null;
  cameraConfig: [number, number, number];
  myAvatarOffset?: { x: number; y: number; z: number };
  myAvatarScale?: number;
  selectedModel?: { id: string } | null;
}) {
  const participant = useParticipantContext();
  const isSpeaking = useIsSpeaking(participant);

  if (!participant) return null;

  // 表示名（ID部分は隠す）
  const displayName =
    participant.identity.split("-")[0] || participant.identity;
  const isMicrophoneEnabled = participant.isMicrophoneEnabled;

  // 自分の場合のみ、ローカルの回転情報を渡す
  const manualRotations = participant.isLocal ? localRotations : undefined;

  // 自分の場合で、かつモデルを選択している場合は、デフォルトモデルを表示せず、メタデータ（動的URL）が設定されるのを待つ
  const defaultUrl =
    participant.isLocal && selectedModel
      ? undefined
      : "/vrm/vroid_model_6689695945343414173.vrm";

  return (
    <div className="relative flex flex-col items-center justify-center p-2 w-full h-full">
      <div
        className={`relative w-48 h-48 sm:w-56 sm:h-56 rounded-xl overflow-hidden mb-3 transition-all duration-300 border-2 ${
          isSpeaking
            ? "border-green-500 shadow-[0_0_20px_rgba(34,197,94,0.4)]"
            : "border-gray-700"
        } bg-gray-900`}
      >
        {/* 3Dアバター表示 */}
        <Canvas>
          <CameraUpdater position={cameraConfig} />
          <ambientLight intensity={0.8} />
          <directionalLight position={[0, 0, 5]} intensity={1} />
          {/* <OrbitControls target={[0, 1.4, 0]} /> 安定した表示のためOrbitControlsは無効化（必要に応じて有効化） */}
          <AvatarReceiver
            participant={participant}
            defaultAvatarUrl={defaultUrl}
            manualRotations={manualRotations}
            // 自分の場合はローカルの設定を即時反映し、他人の場合はMetadataから読み取る
            localOverrideOffset={
              participant.isLocal ? myAvatarOffset : undefined
            }
            localOverrideScale={participant.isLocal ? myAvatarScale : undefined}
          />
        </Canvas>

        {/* ミュートアイコン */}
        {!isMicrophoneEnabled && (
          <div className="absolute bottom-2 right-2 bg-red-500 rounded-full p-1.5 border-2 border-gray-900 z-10">
            <MicOff className="w-4 h-4 text-white" />
          </div>
        )}

        {/* 発話インジケーターオーバーレイ (ボーダーで不十分な場合のオプション) */}
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
  cameraConfig,
  myAvatarOffset,
  myAvatarScale,
  selectedModel,
}: {
  localRotations?: BoneRotations | null;
  cameraConfig: [number, number, number];
  myAvatarOffset: { x: number; y: number; z: number };
  myAvatarScale: number;
  selectedModel?: { id: string } | null;
}) {
  const participants = useParticipants();

  return (
    <div className="w-full max-w-6xl mx-auto p-4 h-full flex items-center justify-center">
      <div className="flex flex-wrap justify-center gap-6 w-full">
        <ParticipantLoop participants={participants}>
          <div className="w-64 h-72">
            <ParticipantTile
              localRotations={localRotations}
              cameraConfig={cameraConfig}
              myAvatarOffset={myAvatarOffset}
              myAvatarScale={myAvatarScale}
              selectedModel={selectedModel}
            />
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
function VoiceCallContent({ onLeave }: { onLeave?: () => void }) {
  const room = useRoomContext();
  const connectionState = useConnectionState();
  const { isMicrophoneEnabled, localParticipant } = useLocalParticipant();
  const [showSettings, setShowSettings] = useState(false);
  const [disconnectError, setDisconnectError] = useState<string | null>(null);

  // VModel Contextから設定を取得
  const { settings } = useVModel();
  const { user, nextAuthSession } = useAuth(); // AuthContextからユーザー情報とセッションを取得

  // アバター統合の状態
  const [localRotations, setLocalRotations] = useState<BoneRotations | null>(
    null
  );
  const [isCameraOn, setIsCameraOn] = useState(true); // AvatarSenderの制御用

  // 3D調整の状態
  const [cameraConfig, setCameraConfig] = useState<[number, number, number]>(
    () => {
      const defaultConfig: [number, number, number] = [0, 1.4, 0.7];
      // localStorageから復元（利用可能な場合）
      if (typeof window !== "undefined") {
        try {
          const saved = localStorage.getItem("vchat_camera_config");
          if (saved) {
            const parsed = JSON.parse(saved);
            // 配列かつ3要素かつすべて数値であることを確認
            if (
              Array.isArray(parsed) &&
              parsed.length === 3 &&
              parsed.every((v) => typeof v === "number" && !isNaN(v))
            ) {
              return parsed as [number, number, number];
            }
          }
        } catch (e) {
          console.warn("Failed to parse camera config from localStorage", e);
        }
      }
      return defaultConfig;
    }
  );

  const [avatarOffset, setAvatarOffset] = useState<{
    x: number;
    y: number;
    z: number;
  }>(() => {
    const defaultOffset = { x: 0, y: 0, z: 0 };
    // localStorageから復元（利用可能な場合）
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("vchat_avatar_offset");
        if (saved) {
          const parsed = JSON.parse(saved);
          // オブジェクトかつx, y, zプロパティがすべて数値であることを確認
          if (
            parsed &&
            typeof parsed === "object" &&
            typeof parsed.x === "number" &&
            typeof parsed.y === "number" &&
            typeof parsed.z === "number" &&
            !isNaN(parsed.x) &&
            !isNaN(parsed.y) &&
            !isNaN(parsed.z)
          ) {
            return parsed;
          }
        }
      } catch (e) {
        console.warn("Failed to parse avatar offset from localStorage", e);
      }
    }
    return defaultOffset;
  });

  const [avatarScale, setAvatarScale] = useState<number>(() => {
    const defaultScale = 1.0;
    // localStorageから復元（利用可能な場合）
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("vchat_avatar_scale");
        if (saved) {
          const parsed = parseFloat(saved);
          // 有効な数値であることを確認
          if (!isNaN(parsed) && isFinite(parsed)) {
            return parsed;
          }
        }
      } catch (e) {
        console.warn("Failed to parse avatar scale from localStorage", e);
      }
    }
    return defaultScale;
  });

  // 設定の永続化
  useEffect(() => {
    localStorage.setItem("vchat_camera_config", JSON.stringify(cameraConfig));
  }, [cameraConfig]);

  useEffect(() => {
    localStorage.setItem("vchat_avatar_offset", JSON.stringify(avatarOffset));
  }, [avatarOffset]);

  useEffect(() => {
    localStorage.setItem("vchat_avatar_scale", avatarScale.toString());
  }, [avatarScale]);

  // 初期メタデータの設定（アバターURL）
  useEffect(() => {
    // 接続済みかつ権限がある場合のみMetadataを設定
    // 初期設定後もavatarOffsetの変更に伴い更新する
    console.log(
      "[VoiceCall] Metadata Effect Triggered. RoomState:",
      room.state,
      "LocalParticipant:",
      !!localParticipant
    );

    if (localParticipant && room.state === "connected") {
      const updateMeta = async () => {
        try {
          // デフォルトアバターURL（フォールバック用）
          const DEFAULT_AVATAR_URL = "/vrm/vroid_model_6689695945343414173.vrm";
          let avatarUrl = DEFAULT_AVATAR_URL;

          // 選択されたモデルがある場合、そのURLを取得
          if (settings.selectedModel) {
            try {
              console.log(
                "Fetching download license/cache for model:",
                settings.selectedModel.id
              );

              const modelId = settings.selectedModel.id;

              // アバターのアップロードに使用するFirebase IDトークンを取得
              if (!user) {
                console.error(
                  "Firebase user not found, cannot access storage. Using default avatar."
                );
                avatarUrl = DEFAULT_AVATAR_URL;
              } else {
                const firebaseToken = await user.getIdToken();

                // Firebase StorageからURLを取得（なければアップロード）
                // ensureVRMInStorageにはFirebaseトークンを渡す
                const storageUrl = await ensureVRMInStorage(
                  modelId,
                  async () => {
                    // ダウンロードが必要な場合のコールバック
                    console.log("VRM cache miss, downloading...", modelId);

                    // アクセストークンを渡してVRMDownloaderをインスタンス化
                    const accessToken = nextAuthSession?.accessToken;
                    if (!accessToken) {
                      console.error(
                        "VRoid access token is missing. Cannot download model, falling back to default avatar."
                      );
                      // エラーをスローせず、nullを返してStorageキャッシュをスキップ
                      return null;
                    }

                    const downloader = new VRMDownloader(accessToken);
                    const result = await downloader.downloadVRM(modelId);
                    return result.blob;
                  },
                  firebaseToken
                );

                if (storageUrl) {
                  avatarUrl = storageUrl;
                  console.log("Using avatar URL from storage:", avatarUrl);
                } else {
                  console.warn(
                    "Storage URL is null, using default avatar:",
                    DEFAULT_AVATAR_URL
                  );
                  avatarUrl = DEFAULT_AVATAR_URL;
                }
              }
            } catch (err) {
              console.error(
                "Failed to get avatar from storage, falling back to default:",
                err
              );
              // エラー時はデフォルトを使用
              avatarUrl = DEFAULT_AVATAR_URL;
            }
          }

          const metadata: AvatarMetadata = {
            avatarUrl: avatarUrl,
            offset: avatarOffset, // offsetを含める
            scale: avatarScale, // scaleを含める
          };
          await localParticipant.setMetadata(JSON.stringify(metadata));
        } catch (e) {
          console.error("Failed to set metadata:", e);
        }
      };

      // スライダー操作中の過度な更新を防ぐため、少しデバウンスさせる
      const timer = setTimeout(updateMeta, 500);
      return () => clearTimeout(timer);
    }
  }, [
    localParticipant,
    room.state,
    avatarOffset,
    avatarScale,
    settings.selectedModel,
    user,
    nextAuthSession?.accessToken,
  ]); // avatarOffsetまたはavatarScaleが変更されたときに再実行

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
      {/* 送信側のための不可視/ユーティリティコンポーネント */}
      <div className="absolute top-0 right-0 w-32 h-24 opacity-0 hover:opacity-100 transition-opacity z-50 pointer-events-none hover:pointer-events-auto bg-black border border-gray-600">
        {/* カメラプレビュー（デバッグ用の小窓） */}
        <AvatarSender
          autoStart={isCameraOn}
          onRotationsUpdate={setLocalRotations}
        />
      </div>

      {/* メインエリア：参加者グリッド */}
      <div className="flex-1 overflow-y-auto flex items-center justify-center min-h-[400px]">
        <ParticipantGrid
          localRotations={localRotations}
          cameraConfig={cameraConfig}
          myAvatarOffset={avatarOffset}
          myAvatarScale={avatarScale}
          selectedModel={settings.selectedModel}
        />
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
          <DeviceSettings
            onClose={() => setShowSettings(false)}
            cameraConfig={cameraConfig}
            setCameraConfig={setCameraConfig}
            avatarOffset={avatarOffset}
            setAvatarOffset={setAvatarOffset}
            avatarScale={avatarScale}
            setAvatarScale={setAvatarScale}
          />
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
          variant={isCameraOn ? "default" : "destructive"} // ONなら緑っぽい、OFFなら赤、または統一スタイル
          size="lg"
          className={`rounded-full w-14 h-14 flex items-center justify-center transition-all duration-300 ${
            isCameraOn
              ? "bg-green-600 hover:bg-green-700 shadow-[0_0_15px_rgba(34,197,94,0.3)]"
              : "bg-gray-700 hover:bg-gray-600"
          }`}
          title="モーションキャプチャ切り替え"
        >
          <div className="text-white font-bold text-xs">
            {isCameraOn ? (
              <Video className="w-5 h-5" />
            ) : (
              <VideoOff className="w-5 h-5" />
            )}
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
                    ? `${Math.max(10, 50 + barIndex * 10)}%`
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
        <VoiceCallContent onLeave={onLeave} />
        <RoomAudioRenderer />
      </LiveKitRoom>
    </div>
  );
}
