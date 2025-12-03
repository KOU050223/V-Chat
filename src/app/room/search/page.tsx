"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Users, Lock, Unlock, Search, ArrowLeft, Key } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

import { Room } from "@/lib/roomStore";

export default function RoomSearchPage() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [rooms, setRooms] = useState<Room[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCleaningUp, setIsCleaningUp] = useState(false);

  useEffect(() => {
    fetchRooms();
  }, []);

  const fetchRooms = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // 実際のAPIエンドポイントからルーム一覧を取得
      // 現在は空の配列を返す（実際の実装ではAPIから取得）
      const response = await fetch("/api/rooms");

      if (response.ok) {
        const data = await response.json();
        setRooms(data.rooms || []);
      } else {
        // APIが実装されていない場合は空の配列を設定
        setRooms([]);
      }
    } catch (error) {
      console.error("Failed to fetch rooms:", error);
      setError("ルーム一覧の取得に失敗しました");
      setRooms([]);
    } finally {
      setIsLoading(false);
    }
  };

  // 検索フィルター
  const filteredRooms = rooms.filter(
    (room) =>
      room.name.toLowerCase().includes(search.toLowerCase()) ||
      room.description.toLowerCase().includes(search.toLowerCase())
  );

  const handleJoinRoom = async (roomId: string) => {
    try {
      // 直接ルームページに遷移（参加処理はルームページ内で行う）
      window.location.href = `/room/${roomId}`;
    } catch (error) {
      console.error("Failed to join room:", error);
      setError("ルームへの参加に失敗しました");
    }
  };

  const handleCleanupRooms = async () => {
    try {
      setIsCleaningUp(true);
      setError(null);

      // 包括的なクリーンアップを実行
      const response = await fetch("/api/rooms/cleanup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cleanupType: "comprehensive",
          includeOldRooms: true,
          includeOrphanedData: true,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        console.log("Comprehensive cleanup result:", data);

        // ルーム一覧を再取得
        await fetchRooms();

        const totalCleaned =
          (data.emptyRooms || 0) +
          (data.oldRooms || 0) +
          (data.orphanedParticipants || 0);
        if (totalCleaned > 0) {
          let message = `クリーンアップ完了！\n`;
          if (data.emptyRooms > 0)
            message += `- 空ルーム: ${data.emptyRooms}個\n`;
          if (data.oldRooms > 0)
            message += `- 古いルーム: ${data.oldRooms}個\n`;
          if (data.orphanedParticipants > 0)
            message += `- 孤立データ: ${data.orphanedParticipants}個\n`;
          if (data.sessionStorageKeys > 0)
            message += `- セッション: ${data.sessionStorageKeys}個\n`;
          alert(message);
        } else {
          alert("クリーンアップ対象のデータはありませんでした");
        }
      } else {
        setError("包括的クリーンアップに失敗しました");
      }
    } catch (error) {
      console.error("Failed to perform comprehensive cleanup:", error);
      setError("包括的クリーンアップに失敗しました");
    } finally {
      setIsCleaningUp(false);
    }
  };

  const handleForceResetAll = async () => {
    if (
      !confirm(
        "全てのルームの参加者数を0にリセットします。この操作は取り消せません。続行しますか？"
      )
    ) {
      return;
    }

    try {
      setIsCleaningUp(true);
      setError(null);

      // セッションストレージをクリア
      const keysToRemove = [];
      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i);
        if (key && key.startsWith("room-")) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach((key) => sessionStorage.removeItem(key));

      // 全ルームの参加者数をリセット
      const response = await fetch("/api/rooms/force-reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reset_all_participants" }),
      });

      if (response.ok) {
        const data = await response.json();
        console.log("Force reset result:", data);

        // ルーム一覧を再取得
        await fetchRooms();

        alert(
          `全ルームの参加者数をリセットしました。リセット対象: ${data.resetCount}ルーム`
        );
      } else {
        setError("強制リセットに失敗しました");
      }
    } catch (error) {
      console.error("Failed to force reset rooms:", error);
      setError("強制リセットに失敗しました");
    } finally {
      setIsCleaningUp(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 pt-12 md:pt-20">
      {/* ダッシュボードに戻るボタン */}
      <div className="w-full max-w-2xl flex justify-start mb-6 px-4">
        <Link href="/dashboard">
          <Button variant="outline" className="flex items-center">
            <ArrowLeft className="w-4 h-4 mr-2" />
            ダッシュボードに戻る
          </Button>
        </Link>
      </div>

      <h1 className="text-3xl font-bold mb-2 bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
        ルームを探す
      </h1>
      <p className="mb-8 text-gray-600">
        公開ルーム一覧から参加したいルームを選んでください
      </p>

      {/* ルームID入力ボタン */}
      <div className="w-full max-w-2xl mb-6">
        <Button
          onClick={() => router.push("/room/join")}
          variant="outline"
          className="w-full bg-white border-purple-300 text-purple-600 hover:bg-purple-50 py-3 flex items-center justify-center"
        >
          <Key className="w-4 h-4 mr-2" />
          ルームIDを入力して参加
        </Button>
      </div>

      {/* 検索バー */}
      <div className="w-full max-w-2xl mb-4 flex items-center bg-white rounded-full shadow px-4 py-2">
        <Search className="w-5 h-5 text-gray-400 mr-2" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="ルーム名・説明で検索"
          className="w-full bg-transparent outline-none text-base"
        />
      </div>

      {/* クリーンアップボタン */}
      <div className="w-full max-w-2xl mb-8 flex justify-center gap-3">
        <Button
          onClick={handleCleanupRooms}
          disabled={isCleaningUp}
          variant="outline"
          size="sm"
          className="bg-red-50 border-red-200 text-red-600 hover:bg-red-100"
        >
          {isCleaningUp ? "クリーンアップ中..." : "🧹 包括的クリーンアップ"}
        </Button>
        <Button
          onClick={handleForceResetAll}
          disabled={isCleaningUp}
          variant="outline"
          size="sm"
          className="bg-orange-50 border-orange-200 text-orange-600 hover:bg-orange-100"
        >
          {isCleaningUp ? "リセット中..." : "🔄 全ルーム強制リセット"}
        </Button>
      </div>

      {/* エラーメッセージ */}
      {error && (
        <div className="w-full max-w-2xl mb-6 bg-red-50 border border-red-200 rounded-lg p-4 text-center">
          <p className="text-red-600">{error}</p>
        </div>
      )}

      {/* ルーム一覧 */}
      <div className="w-full max-w-2xl grid gap-6">
        {isLoading ? (
          <div className="bg-white rounded-xl shadow p-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500 mx-auto mb-4"></div>
            <p className="text-gray-600">ルーム一覧を読み込み中...</p>
          </div>
        ) : filteredRooms.length === 0 ? (
          <div className="bg-white rounded-xl shadow p-8 text-center">
            {search ? (
              <div>
                <p className="text-gray-600 mb-2">
                  検索条件に一致するルームが見つかりませんでした
                </p>
                <Button
                  onClick={() => setSearch("")}
                  variant="outline"
                  className="text-sm"
                >
                  検索をクリア
                </Button>
              </div>
            ) : (
              <div>
                <p className="text-gray-600 mb-2">
                  現在公開されているルームがありません
                </p>
                <Link href="/room/create">
                  <Button className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600">
                    最初のルームを作成
                  </Button>
                </Link>
              </div>
            )}
          </div>
        ) : (
          filteredRooms.map((room) => (
            <div
              key={room.id}
              className="bg-white rounded-xl shadow flex flex-col md:flex-row items-center md:items-stretch justify-between p-6 gap-4"
            >
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-bold text-lg text-gray-800">
                    {room.name}
                  </span>
                  {room.isPrivate ? (
                    <span className="inline-flex items-center">
                      <Lock className="w-4 h-4 text-gray-400" />
                      <span className="sr-only">非公開</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center">
                      <Unlock className="w-4 h-4 text-green-400" />
                      <span className="sr-only">公開</span>
                    </span>
                  )}
                </div>
                <p className="text-gray-600 text-sm mb-2">{room.description}</p>
                <div className="flex items-center text-xs text-gray-500">
                  <Users className="w-4 h-4 mr-1" />
                  {room.members}人参加中
                </div>
              </div>
              <div>
                <button
                  onClick={() => handleJoinRoom(room.id)}
                  className="bg-gradient-to-r from-purple-500 to-pink-500 text-white px-6 py-2 rounded-lg font-semibold shadow hover:from-purple-600 hover:to-pink-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={room.isPrivate}
                  title={
                    room.isPrivate
                      ? "非公開ルームには招待が必要です"
                      : "このルームに参加"
                  }
                >
                  {room.isPrivate ? "招待制" : "参加"}
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
