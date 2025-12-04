// src/components/matching/RoomCreateForm.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Sparkles,
  Lock,
  Users,
  ArrowLeft,
  Copy,
  CheckCircle,
  Users as UsersIcon,
} from "lucide-react";
import Link from "next/link";
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui";

export default function RoomCreateForm() {
  const [roomName, setRoomName] = useState("");
  const [description, setDescription] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [createdRoom, setCreatedRoom] = useState<any>(null);
  const [showRoomInfo, setShowRoomInfo] = useState(false);
  const router = useRouter();

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!roomName.trim()) {
      setError("ルーム名は必須です");
      return;
    }
    setCreating(true);

    try {
      console.log("Creating room with data:", {
        name: roomName.trim(),
        description: description.trim(),
        isPrivate,
      });

      const response = await fetch("/api/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: roomName.trim(),
          description: description.trim(),
          isPrivate,
        }),
      });

      console.log("Create room response status:", response.status);

      if (response.ok) {
        const data = await response.json();
        console.log("Created room data:", data);
        setCreatedRoom(data.room);
        setShowRoomInfo(true);
        setError("");
      } else {
        const errorData = await response.json();
        console.log("Create room error:", errorData);
        setError(errorData.error || "ルームの作成に失敗しました");
      }
    } catch (error) {
      console.error("Failed to create room:", error);
      setError("ルームの作成に失敗しました");
    } finally {
      setCreating(false);
    }
  };

  const handleJoinRoom = () => {
    if (createdRoom) {
      router.push(`/room/${createdRoom.id}`);
    }
  };

  const handleCopyRoomId = () => {
    if (createdRoom) {
      navigator.clipboard.writeText(createdRoom.id);
      // コピー成功のフィードバックを表示（オプション）
    }
  };

  const handleCreateAnother = () => {
    setCreatedRoom(null);
    setShowRoomInfo(false);
    setRoomName("");
    setDescription("");
    setIsPrivate(false);
  };

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 pt-12 md:pt-20 flex flex-col items-center">
      {/* 戻るボタン */}
      <div className="w-full max-w-2xl flex justify-start mb-6 px-4">
        <Link href="/dashboard">
          <Button variant="outline" className="flex items-center">
            <ArrowLeft className="w-4 h-4 mr-2" />
            ダッシュボードに戻る
          </Button>
        </Link>
      </div>

      {/* ヘッダー */}
      <div className="text-center mb-8 px-4">
        <div className="flex items-center justify-center mb-4">
          <Sparkles className="w-8 h-8 text-purple-500 mr-2" />
          <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
            ルームを作成
          </h1>
        </div>
        <p className="text-gray-600">自分だけのチャットルームを作りましょう</p>
      </div>

      {/* ルーム作成成功時のUI */}
      {showRoomInfo && createdRoom ? (
        <Card className="w-full max-w-2xl mx-auto shadow-2xl border-0 px-4">
          <CardHeader className="text-center pb-2">
            <div className="flex items-center justify-center mb-4">
              <CheckCircle className="w-8 h-8 text-green-500 mr-2" />
              <CardTitle className="text-2xl font-bold text-gray-800">
                ルーム作成完了！
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {/* ルーム情報 */}
              <div className="bg-gradient-to-r from-green-50 to-blue-50 rounded-lg p-6 border border-green-200">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">
                  {createdRoom.name}
                </h3>
                {createdRoom.description && (
                  <p className="text-gray-600 mb-4">
                    {createdRoom.description}
                  </p>
                )}
                <div className="flex items-center text-sm text-gray-500">
                  <UsersIcon className="w-4 h-4 mr-1" />
                  <span>現在 {createdRoom.members} 人参加中</span>
                </div>
              </div>

              {/* ルームID */}
              <div className="bg-gray-50 rounded-lg p-4">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  ルームID
                </label>
                <div className="flex items-center space-x-2">
                  <input
                    type="text"
                    value={createdRoom.id}
                    readOnly
                    className="flex-1 bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono"
                  />
                  <Button
                    onClick={handleCopyRoomId}
                    variant="outline"
                    size="sm"
                    className="flex items-center"
                  >
                    <Copy className="w-4 h-4 mr-1" />
                    コピー
                  </Button>
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  このIDを他のユーザーに共有して、ルームに参加してもらえます
                </p>
              </div>

              {/* アクションボタン */}
              <div className="space-y-3">
                <Button
                  onClick={handleJoinRoom}
                  className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white py-3"
                >
                  <UsersIcon className="w-4 h-4 mr-2" />
                  今すぐルームに参加
                </Button>
                <Button
                  onClick={handleCreateAnother}
                  variant="outline"
                  className="w-full border-purple-300 text-purple-600 hover:bg-purple-50 py-3"
                >
                  別のルームを作成
                </Button>
              </div>

              {/* 説明 */}
              <div className="bg-blue-50 rounded-lg p-4">
                <h4 className="text-sm font-semibold text-blue-800 mb-2">
                  ルームIDの共有方法
                </h4>
                <ul className="text-xs text-blue-700 space-y-1">
                  <li>• 上記のルームIDをコピーして他のユーザーに送信</li>
                  <li>
                    •
                    他のユーザーは「ルームを探す」→「ルームIDを入力して参加」で参加可能
                  </li>
                  <li>• プライベートルームの場合は、作成者の許可が必要です</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        /* 通常のルーム作成フォーム */
        <Card className="w-full max-w-2xl mx-auto shadow-2xl border-0 px-4">
          <CardHeader className="text-center pb-2">
            <CardTitle className="text-2xl font-bold text-gray-800">
              ルーム情報
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreate} className="space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-semibold mb-1 text-gray-700">
                    ルーム名 <span className="text-pink-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={roomName}
                    onChange={(e) => setRoomName(e.target.value)}
                    required
                    maxLength={30}
                    placeholder="例: 雑談部屋・ゲーム好き集まれ"
                    className="w-full border border-purple-200 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-purple-400 transition text-base"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-1 text-gray-700">
                    説明 <span className="text-gray-400 text-xs">(任意)</span>
                  </label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    maxLength={100}
                    placeholder="ルームの目的やルールなどを記入できます"
                    className="w-full border border-purple-200 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-purple-400 transition resize-none text-base"
                    rows={3}
                  />
                </div>
              </div>
              <div className="flex items-center mb-2">
                <input
                  type="checkbox"
                  checked={isPrivate}
                  onChange={(e) => setIsPrivate(e.target.checked)}
                  id="private"
                  className="mr-2 accent-purple-500"
                />
                <label htmlFor="private" className="text-sm flex items-center">
                  <Lock className="w-4 h-4 mr-1" />
                  非公開ルームにする
                </label>
              </div>
              {error && (
                <div className="text-sm text-red-500 text-center">{error}</div>
              )}
              <Button
                type="submit"
                disabled={creating}
                className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 disabled:bg-gray-400 disabled:cursor-not-allowed h-12 text-lg font-semibold"
              >
                {creating ? "作成中..." : "ルームを作成"}
              </Button>
              <div className="mt-4 text-xs text-gray-400 text-center">
                <Users className="inline w-4 h-4 mr-1" />
                ルーム作成後、ルームIDをシェアできます
              </div>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
