"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Users, Key, AlertCircle } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function JoinRoomPage() {
  const [roomId, setRoomId] = useState("");
  const [isJoining, setIsJoining] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  const handleJoinRoom = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!roomId.trim()) {
      setError("ルームIDを入力してください");
      return;
    }

    setIsJoining(true);
    setError("");

    try {
      console.log("Attempting to join room:", roomId);

      // ルームの存在確認（実際の実装ではAPIで確認）
      const response = await fetch(`/api/rooms/${roomId}`);

      console.log("API Response status:", response.status);
      console.log("API Response headers:", response.headers);

      if (response.ok) {
        const data = await response.json();
        console.log("Room data received:", data);
        // ルームが存在する場合、そのルームに参加
        router.push(`/room/${roomId}`);
      } else {
        const errorData = await response
          .json()
          .catch(() => ({ error: "Unknown error" }));
        console.log("API Error data:", errorData);
        setError("ルームが見つかりません。ルームIDを確認してください。");
      }
    } catch (error) {
      console.error("Failed to join room:", error);
      setError("ルームへの参加に失敗しました。");
    } finally {
      setIsJoining(false);
    }
  };

  const handleCreateRoom = () => {
    router.push("/room/create");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* ヘッダー */}
        <div className="flex items-center justify-between mb-8">
          <Link href="/dashboard">
            <Button
              variant="outline"
              size="sm"
              className="flex items-center bg-white border-gray-200 text-gray-700 hover:bg-gray-50"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              ダッシュボードに戻る
            </Button>
          </Link>
          <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
            ルームに参加
          </h1>
          <div className="w-20"></div> {/* スペーサー */}
        </div>

        {/* メインカード */}
        <Card className="w-full shadow-2xl border-0">
          <CardHeader className="text-center pb-2">
            <CardTitle className="text-2xl font-bold text-gray-800">
              ルームIDを入力
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleJoinRoom} className="space-y-6">
              <div>
                <label
                  htmlFor="roomId"
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  ルームID
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Key className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    id="roomId"
                    type="text"
                    value={roomId}
                    onChange={(e) => setRoomId(e.target.value)}
                    placeholder="例: room-1753883576886"
                    className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    disabled={isJoining}
                  />
                </div>
                <p className="mt-2 text-sm text-gray-500">
                  ルーム作成者から共有されたルームIDを入力してください
                </p>
              </div>

              {/* エラーメッセージ */}
              {error && (
                <div className="flex items-center space-x-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <AlertCircle className="w-5 h-5 text-red-500" />
                  <span className="text-sm text-red-700">{error}</span>
                </div>
              )}

              {/* 参加ボタン */}
              <Button
                type="submit"
                disabled={isJoining || !roomId.trim()}
                className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white py-3"
              >
                {isJoining ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    参加中...
                  </>
                ) : (
                  <>
                    <Users className="w-4 h-4 mr-2" />
                    ルームに参加
                  </>
                )}
              </Button>

              {/* 区切り線 */}
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-300"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-white text-gray-500">または</span>
                </div>
              </div>

              {/* ルーム作成ボタン */}
              <Button
                type="button"
                onClick={handleCreateRoom}
                variant="outline"
                className="w-full border-purple-300 text-purple-600 hover:bg-purple-50 py-3"
              >
                新しいルームを作成
              </Button>
            </form>

            {/* 説明 */}
            <div className="mt-6 p-4 bg-gray-50 rounded-lg">
              <h3 className="text-sm font-semibold text-gray-700 mb-2">
                ルームIDについて
              </h3>
              <ul className="text-xs text-gray-600 space-y-1">
                <li>• ルームIDは「room-」で始まる文字列です</li>
                <li>• ルーム作成者から共有されたIDを正確に入力してください</li>
                <li>• プライベートルームの場合は、作成者の許可が必要です</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
