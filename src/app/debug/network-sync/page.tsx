"use client";

import { useState, useEffect } from "react";
import {
  LiveKitRoom,
  useParticipants,
  ParticipantLoop,
  useParticipantContext,
} from "@livekit/components-react";
import "@livekit/components-styles";
import { getFunctions, httpsCallable } from "firebase/functions";
import { app } from "@/lib/firebaseConfig";
import { AvatarSender } from "@/components/avatar/AvatarSender";
import { AvatarReceiver } from "@/components/avatar/AvatarReceiver";
import { Button } from "@/components/ui";
import { BoneRotations } from "@/types/avatar";

export default function NetworkSyncDebugPage() {
  const [token, setToken] = useState("");
  const [roomName, setRoomName] = useState("");
  const [participantName, setParticipantName] = useState("");
  const [isConnected, setIsConnected] = useState(false);
  const [status, setStatus] = useState("Disconnected");
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    setParticipantName("DebugUser-" + Math.floor(Math.random() * 100));
  }, []);

  // URLからroomIdを取得
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const rid = params.get("roomId");
      if (rid) {
        // URLにroomIdがあれば、作成プロセスをスキップして即座に接続開始可能にするか、
        // あるいはStateに入れておいてボタンを押させる
        // ここでは自動入力を実装
        // roomNameは取得できない（IDしか分からない）が、表示はIDで十分
        setRoomName(rid);
        // IDであることがわかるように少しUI変えるべきだが、一旦roomNameに入れておく
      }
    }
  }, [isMounted]);

  // トークン取得
  const connectToRoom = async () => {
    if (!participantName) return;

    try {
      setStatus("Connecting...");
      const functions = getFunctions(app, "us-central1");

      let targetRoomId = "";

      // URLパラメータまたは入力された値が "active room ID" かどうか判断するのは難しいが、
      // 「debug-room-vrm」という名前（デフォルト）の場合は「新規作成または検索」
      // それ以外（IDっぽい文字列）の場合は「参加」とみなすロジックにする

      const params = new URLSearchParams(window.location.search);
      const urlRoomId = params.get("roomId");

      if (urlRoomId) {
        targetRoomId = urlRoomId;
      } else {
        // 新規作成
        setStatus("Creating Room...");
        const createRoom = httpsCallable(functions, "createRoom");
        try {
          const createResult = await createRoom({
            name: "debug-room-vrm", // 固定名
            description: "Debug Room for VRM Motion Sync",
            isPrivate: true,
          });
          console.log("Room Created:", createResult.data);

          const roomData = createResult.data as { roomId: string };
          if (roomData && roomData.roomId) {
            targetRoomId = roomData.roomId;

            // URLを更新して、リロードしても同じ部屋に入れるようにする（また他タブへの共有用）
            const newUrl = `${window.location.pathname}?roomId=${targetRoomId}`;
            window.history.pushState({ path: newUrl }, "", newUrl);
          }
        } catch (createError) {
          const errorMessage =
            createError instanceof Error
              ? createError.message
              : "Unknown error";
          setStatus("Error creating room: " + errorMessage);
          return;
        }
      }

      if (!targetRoomId) {
        setStatus("Error: Could not get Room ID");
        return;
      }

      // Step 2: 参加（トークン発行）
      setStatus("Joining Room: " + targetRoomId);

      // FirestoreのjoinRoom関数を呼んでおく
      try {
        const joinRoom = httpsCallable(functions, "joinRoom");
        await joinRoom({ roomId: targetRoomId });
        console.log("Joined Room in Firestore:", targetRoomId);
      } catch (joinError) {
        const errorMessage =
          joinError instanceof Error ? joinError.message : "Unknown error";
        console.warn("Join room warning:", errorMessage);
      }

      setStatus("Getting Token...");
      const generateToken = httpsCallable(functions, "generateLivekitToken");

      // デバッグ用に固定のVRMを設定 (メタデータ)
      // const metadata = JSON.stringify({
      //     avatarUrl: "/vrm/vroid_model_6689695945343414173.vrm", // デモ用VRM
      //     avatarId: "debug-avatar"
      // });

      // generateLivekitTokenの呼び出し
      // 注意: generateLivekitTokenの実装によっては、事前にjoinRoomが必要な場合がある
      // VoiceCall.tsxでは単にgenerateLivekitTokenを呼んでいるが、
      // Room.tsxでは先に joinRoom を呼んでいる。
      // LiveKitのトークン発行ロジックでは「ルームへの参加権限」をチェックする場合、
      // Firestoreのparticipants配列に自分がいるかを見る可能性がある。

      const result = await generateToken({
        roomId: targetRoomId,
        participantName: participantName,
      });

      const data = result.data as { token: string };
      setToken(data.token);
      setIsConnected(true);
      setStatus("Connected: " + targetRoomId);
    } catch (e) {
      console.error(e);
      setStatus("Error: " + (e as Error).message);
    }
  };

  const livekitUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL;

  if (!isMounted)
    return (
      <div className="min-h-screen bg-gray-900 text-white p-4">Loading...</div>
    );

  if (!livekitUrl) {
    return <div>Error: NEXT_PUBLIC_LIVEKIT_URL is not set</div>;
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4">
      <h1 className="text-2xl font-bold mb-4">VRM Network Sync Debug</h1>

      <div className="bg-gray-800 p-4 rounded mb-4">
        <div className="flex gap-4 items-center mb-2">
          <div>
            Room:{" "}
            <input
              value={roomName}
              onChange={(e) => setRoomName(e.target.value)}
              className="bg-gray-700 p-1 rounded w-40"
            />
          </div>
          <div>
            Name:{" "}
            <input
              value={participantName}
              onChange={(e) => setParticipantName(e.target.value)}
              className="bg-gray-700 p-1 rounded w-40"
            />
          </div>
          <Button onClick={connectToRoom} disabled={isConnected}>
            {isConnected ? "Connected" : "Join Room"}
          </Button>
        </div>
        <div>Status: {status}</div>
      </div>

      {isConnected && token && (
        <LiveKitRoom
          token={token}
          serverUrl={livekitUrl}
          connect={true}
          video={false}
          audio={false} // オーディオはOFFでテスト
          onConnected={() => setStatus("Room Connected")}
          onDisconnected={() => {
            setStatus("Disconnected");
            setIsConnected(false);
          }}
          className="h-[600px] border border-gray-700 rounded"
        >
          <DebugContent />
        </LiveKitRoom>
      )}
    </div>
  );
}

function DebugContent() {
  const participants = useParticipants();
  const [localRotations, setLocalRotations] = useState<BoneRotations | null>(
    null
  ); // State for local preview

  // ...

  return (
    <div className="flex flex-col h-full">
      <div className="bg-blue-900/30 p-2 text-sm">
        Participants: {participants.length} (Self included)
      </div>

      <div className="flex-1 grid grid-cols-2 gap-4 p-4">
        {/* 自分 (Local) - プレビューとしてAvatarReceiverを使う手もあるが、
            AvatarSender自体には表示機能がないため、
            自分の動きを確認したければ別途VRMViewerを置くか、
            「ネットワーク経由」を確認したいので相手の画面を見るのが正解。
            -> Update: 自分の動きをリアルタイムで見るためにローカルループバックを実装
        */}
        <div className="border border-blue-500 rounded p-2 relative min-h-[300px] overflow-hidden">
          <div className="absolute top-2 left-2 bg-blue-600 px-2 rounded z-10 text-white shadow">
            You (Sender)
          </div>
          <AvatarSender
            autoStart={true}
            onRotationsUpdate={(rots) => setLocalRotations(rots)}
          />
        </div>

        {/* 他の参加者 (Remote & Local Self) */}
        <ParticipantLoop participants={participants}>
          <ParticipantWrapper localRotations={localRotations} />
        </ParticipantLoop>
      </div>
    </div>
  );
}

function ParticipantWrapper({
  localRotations,
}: {
  localRotations?: BoneRotations | null;
}) {
  const p = useParticipantContext();

  if (!p) return null;

  // Pass local rotations ONLY if this is the local participant
  const rotationsToPass = p.isLocal ? localRotations : undefined;

  return (
    <div className="border border-green-500 rounded p-2 relative h-[400px]">
      <DebugAvatarCanvasWrapper
        participant={p}
        manualRotations={rotationsToPass}
      />
    </div>
  );
}

import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { Participant } from "livekit-client";

const DebugAvatarCanvasWrapper = ({
  participant,
  manualRotations,
}: {
  participant: Participant;
  manualRotations?: BoneRotations | null;
}) => {
  return (
    <>
      <div className="absolute top-2 left-2 bg-green-600 px-2 rounded z-10 text-white">
        {participant.identity} {participant.isLocal ? "(You)" : ""}
      </div>
      <Canvas camera={{ position: [0, 1.5, 3], fov: 50 }}>
        <ambientLight intensity={0.5} />
        <directionalLight position={[0, 0, 5]} intensity={1} />
        <gridHelper args={[10, 10]} />
        <OrbitControls target={[0, 1.4, 0]} />
        <DebugAvatar
          participant={participant}
          defaultAvatarUrl="/vrm/vroid_model_6689695945343414173.vrm"
          manualRotations={manualRotations}
        />
      </Canvas>
    </>
  );
};

const DebugAvatar = ({
  participant,
  defaultAvatarUrl,
  manualRotations,
}: {
  participant: Participant;
  defaultAvatarUrl: string;
  manualRotations?: BoneRotations | null;
}) => {
  return (
    <AvatarReceiver
      participant={participant}
      defaultAvatarUrl={defaultAvatarUrl}
      manualRotations={manualRotations}
    />
  );
};
