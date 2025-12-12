"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { getFunctions, httpsCallable } from "firebase/functions";
import { app } from "@/lib/firebaseConfig";
import { handleFirebaseFunctionError } from "@/lib/utils";
import { matchingService, MatchingState } from "@/lib/matching-service";
import {
  CreateRoomRequest,
  CreateRoomResponse,
  JoinRoomRequest,
  JoinRoomResponse,
} from "@/types/room";
import { Sparkles, Users, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type TabType = "create" | "join" | "match";

export default function RoomManager() {
  const router = useRouter();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>("create");

  // ルーム作成用の状態
  const [roomName, setRoomName] = useState("");
  const [roomDescription, setRoomDescription] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);
  const [createdRoomId, setCreatedRoomId] = useState<string | null>(null);

  // ルーム参加用の状態
  const [joinRoomId, setJoinRoomId] = useState("");

  // ランダムマッチング用の状態
  const [matchingState, setMatchingState] = useState<MatchingState>({
    status: "idle",
  });

  // 共通の状態
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // タイムアウトIDを保存するref
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user) {
      setError("ログインが必要です");
      return;
    }

    if (!roomName.trim()) {
      setError("ルーム名を入力してください");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const functions = getFunctions(app, "us-central1");
      const createRoom = httpsCallable<CreateRoomRequest, CreateRoomResponse>(
        functions,
        "createRoom"
      );

      const result = await createRoom({
        name: roomName.trim(),
        description: roomDescription.trim(),
        isPrivate,
      });

      const data = result.data;
      setCreatedRoomId(data.roomId);

      // 5秒後に自動的にルームに遷移
      timeoutRef.current = setTimeout(() => {
        router.push(`/room/${data.roomId}`);
      }, 5000);
    } catch (err: unknown) {
      const message = handleFirebaseFunctionError(
        "ルーム作成エラー",
        err,
        "ルームの作成に失敗しました"
      );
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  // クリーンアップ: コンポーネントのアンマウント時にタイマーをキャンセル
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      // マッチング中の場合はキャンセル
      if (matchingState.status === "waiting") {
        matchingService.cancelMatching();
      }
    };
  }, [matchingState.status]);

  const handleJoinRoom = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user) {
      setError("ログインが必要です");
      return;
    }

    if (!joinRoomId.trim()) {
      setError("ルームIDを入力してください");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const functions = getFunctions(app, "us-central1");
      const joinRoom = httpsCallable<JoinRoomRequest, JoinRoomResponse>(
        functions,
        "joinRoom"
      );

      await joinRoom({
        roomId: joinRoomId.trim().toUpperCase(),
      });

      // ルームに遷移
      router.push(`/room/${joinRoomId.trim().toUpperCase()}`);
    } catch (err: unknown) {
      const message = handleFirebaseFunctionError(
        "ルーム参加エラー",
        err,
        "ルームへの参加に失敗しました"
      );
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  // const handleStartMatching = async () => {
  //   if (!user) {
  //     setError('ログインが必要です');
  //     return;
  //   }

  //   setError(null);

  //   await matchingService.startMatching(user.uid, (state) => {
  //     setMatchingState(state);

  //     if (state.status === 'matched' && state.roomId) {
  //       // マッチング成功！少し待ってから遷移
  //       setTimeout(() => {
  //         router.push(`/room/${state.roomId}`);
  //       }, 1500);
  //     } else if (state.status === 'error' && state.error) {
  //       setError(state.error);
  //     }
  //   });
  // };

  // const handleCancelMatching = async () => {
  //   await matchingService.cancelMatching();
  //   setMatchingState({ status: 'idle' });
  // };

  const copyRoomId = () => {
    if (createdRoomId) {
      navigator.clipboard.writeText(createdRoomId);
      alert("ルームIDをコピーしました");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 flex items-center justify-center p-4">
      <style jsx global>{`
        @keyframes progress {
          from {
            width: 0%;
          }
          to {
            width: 100%;
          }
        }
      `}</style>
      <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md">
        <h1 className="text-3xl font-bold text-center mb-8 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
          V-Chat ルーム管理
        </h1>

        {/* タブ切り替え */}
        <div className="flex gap-2 mb-6">
          <button
            type="button"
            onClick={() => {
              setActiveTab("create");
              setError(null);
              setCreatedRoomId(null);
            }}
            className={`flex-1 py-3 px-2 text-sm md:text-base rounded-lg font-semibold transition-all ${
              activeTab === "create"
                ? "bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            作成
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab("join");
              setError(null);
              setCreatedRoomId(null);
            }}
            className={`flex-1 py-3 px-2 text-sm md:text-base rounded-lg font-semibold transition-all ${
              activeTab === "join"
                ? "bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            参加
          </button>
          {/* <button
            type="button"
            onClick={() => {
              setActiveTab('match');
              setError(null);
              setCreatedRoomId(null);
            }}
            className={`flex-1 py-3 px-2 text-sm md:text-base rounded-lg font-semibold transition-all ${activeTab === 'match'
              ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
          >
            ランダム
          </button> */}
        </div>

        {/* エラー表示 */}
        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
            {error}
          </div>
        )}

        {/* ルーム作成成功表示 */}
        {createdRoomId && activeTab === "create" && (
          <div className="mb-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <Card className="border-green-200 bg-green-50">
              <CardContent className="pt-6 pb-6 flex flex-col items-center text-center">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
                  <Sparkles className="w-8 h-8 text-green-600" />
                </div>
                <h3 className="font-bold text-xl text-green-800 mb-2">
                  ルームを作成しました！
                </h3>
                <p className="text-sm text-green-700 mb-6">
                  以下のルームIDを相手に共有してください
                </p>

                <div className="flex gap-2 w-full max-w-xs mb-6">
                  <input
                    type="text"
                    value={createdRoomId}
                    readOnly
                    className="flex-1 px-4 py-2 bg-white border border-green-300 rounded-l-md font-mono text-center text-lg shadow-sm"
                  />
                  <Button
                    type="button"
                    onClick={copyRoomId}
                    className="rounded-l-none bg-green-600 hover:bg-green-700 text-white"
                  >
                    コピー
                  </Button>
                </div>

                <div className="w-full bg-green-200 h-1.5 rounded-full overflow-hidden">
                  <div className="h-full bg-green-500 animate-[progress_3s_ease-in-out_forwards] w-0" />
                </div>
                <p className="text-xs text-green-600 mt-2 font-medium">
                  5秒後に自動的にルームに移動します...
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* ルーム作成フォーム */}
        {activeTab === "create" && !createdRoomId && (
          <form onSubmit={handleCreateRoom} className="space-y-4">
            <div>
              <label
                htmlFor="roomTitle"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                ルーム名 <span className="text-red-500">*</span>
              </label>
              <input
                id="roomTitle"
                type="text"
                value={roomName}
                onChange={(e) => setRoomName(e.target.value)}
                placeholder="例: 友達とのチャット"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                disabled={isLoading}
              />
            </div>

            <div>
              <label
                htmlFor="roomDescription"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                説明（任意）
              </label>
              <textarea
                id="roomDescription"
                value={roomDescription}
                onChange={(e) => setRoomDescription(e.target.value)}
                placeholder="ルームの説明を入力してください"
                rows={3}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                disabled={isLoading}
              />
            </div>

            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="isPrivate"
                checked={isPrivate}
                onChange={(e) => setIsPrivate(e.target.checked)}
                className="w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                disabled={isLoading}
              />
              <label htmlFor="isPrivate" className="text-sm text-gray-700">
                プライベートルーム（IDを知っている人のみ参加可能）
              </label>
            </div>

            <button
              type="submit"
              disabled={isLoading || !roomName.trim()}
              className="w-full py-3 px-6 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold rounded-lg hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  作成中...
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5 mr-2" />
                  ルームを作成
                </>
              )}
            </button>
          </form>
        )}

        {/* ルーム参加フォーム */}
        {activeTab === "join" && (
          <form onSubmit={handleJoinRoom} className="space-y-4">
            <div>
              <label
                htmlFor="joinRoomId"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                ルームID <span className="text-red-500">*</span>
              </label>
              <input
                id="joinRoomId"
                type="text"
                value={joinRoomId}
                onChange={(e) => setJoinRoomId(e.target.value.toUpperCase())}
                placeholder="例: ABC123"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg font-mono text-xl text-center uppercase focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                disabled={isLoading}
                maxLength={8}
              />
              <p className="text-sm text-gray-500 mt-2">
                相手から共有されたルームIDを入力してください
              </p>
            </div>

            <button
              type="submit"
              disabled={isLoading || !joinRoomId.trim()}
              className="w-full py-3 px-6 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold rounded-lg hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  参加中...
                </>
              ) : (
                <>
                  <Users className="w-5 h-5 mr-2" />
                  ルームに参加
                </>
              )}
            </button>
          </form>
        )}
        {/* 
        // ランダムマッチング
        {activeTab === 'match' && (
          <div className="space-y-6 text-center">
            <div className="py-4">
              <div className="w-24 h-24 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Search className={`w-12 h-12 text-blue-600 ${matchingState.status === 'waiting' ? 'animate-pulse' : ''}`} />
              </div>
              <h3 className="text-xl font-bold text-gray-800 mb-2">
                ランダムマッチング
              </h3>
              <p className="text-gray-600">
                {matchingState.status === 'waiting'
                  ? 'マッチング相手を探しています...'
                  : matchingState.status === 'matched'
                    ? 'マッチング成立！ルームへ移動します...'
                    : '世界中の誰かとランダムに通話できます'}
              </p>
            </div>

            {matchingState.status === 'waiting' ? (
              <button
                type="button"
                onClick={handleCancelMatching}
                className="w-full py-3 px-6 bg-gray-200 text-gray-700 font-semibold rounded-lg hover:bg-gray-300 transition-all"
              >
                キャンセル
              </button>
            ) : matchingState.status === 'matched' ? (
              <div className="w-full py-3 px-6 bg-green-100 text-green-700 font-semibold rounded-lg">
                移動中...
              </div>
            ) : (
              <button
                type="button"
                onClick={handleStartMatching}
                className="w-full py-3 px-6 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold rounded-lg hover:shadow-lg transition-all flex items-center justify-center"
              >
                <Search className="w-5 h-5 mr-2" />
                マッチング開始
              </button>
            )}
          </div>
        )}
        */}

        {/* 戻るボタン */}
        <button
          type="button"
          onClick={() => router.push("/")}
          className="w-full mt-6 py-2 text-gray-600 hover:text-gray-800 transition-colors"
        >
          ホームに戻る
        </button>
      </div>
    </div>
  );
}
