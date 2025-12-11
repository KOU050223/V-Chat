"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import {
  ArrowLeft,
  Send,
  Users,
  MessageCircle,
  MoreVertical,
} from "lucide-react";
import { Button } from "@/components/ui";
import VoiceCall from "@/components/voice/VoiceCall";
import { getFunctions, httpsCallable } from "firebase/functions";
import { app } from "@/lib/firebaseConfig";
import { handleFirebaseFunctionError } from "@/lib/utils";
import { getFirestore, doc, getDoc, onSnapshot } from "firebase/firestore";
import type {
  JoinRoomRequest,
  JoinRoomResponse,
  ChatMessage,
  RoomDisplayInfo,
} from "@/types/room";
import type { VoiceCallState } from "@/types/voice";

export default function ChatRoom() {
  const params = useParams();
  const router = useRouter();
  const roomId = params.roomId as string;
  const { user, nextAuthSession } = useAuth();

  const [roomInfo, setRoomInfo] = useState<RoomDisplayInfo | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isExiting, setIsExiting] = useState(false); // 退出処理中のローディング状態
  const [showChat, setShowChat] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [voiceCallState, setVoiceCallState] = useState<VoiceCallState>({
    isConnected: false,
    isMuted: false,
    participants: [],
  });

  useEffect(() => {
    fetchMessages();

    // ページ読み込み時に古いセッションストレージをクリーンアップ
    const cleanupOldSessionData = () => {
      const allKeys = Object.keys(sessionStorage);
      const roomKeys = allKeys.filter((key) =>
        key.startsWith(`room-${roomId}-`)
      );

      // 現在のルーム以外の古いデータを削除
      allKeys.forEach((key) => {
        if (key.startsWith("room-") && !key.startsWith(`room-${roomId}-`)) {
          sessionStorage.removeItem(key);
          console.log("🧹 Cleaned up old session data:", key);
        }
      });

      console.log(`🔍 Current room session keys: ${roomKeys.length}`);
    };

    cleanupOldSessionData();
  }, [roomId]);

  // useRefで初回参加済みフラグを管理
  const hasJoinedRef = useRef(false);

  // ルーム情報が取得できたら参加処理を実行（HMR対応）
  useEffect(() => {
    if (roomInfo && !isLoading && !hasJoinedRef.current) {
      // セッションストレージから既存の参加状態をチェック
      const sessionJoinKey = `room-${roomId}-joined`;
      const hasJoined = sessionStorage.getItem(sessionJoinKey);
      const existingUserKeys = Object.keys(sessionStorage).filter((key) =>
        key.startsWith(`room-${roomId}-user-`)
      );

      console.log(
        "🔍 Checking join status - hasJoined:",
        hasJoined,
        "existingUserKeys:",
        existingUserKeys.length
      );

      // 開発環境でのHMR対応：既に参加済みの場合は再参加をスキップ
      if (
        process.env.NODE_ENV === "development" &&
        (hasJoined || existingUserKeys.length > 0)
      ) {
        console.log(
          "🔧 DEV MODE: HMR DETECTED - Skipping joinRoom() - already joined"
        );
        console.log("Session join status:", hasJoined);
        console.log("Existing user keys:", existingUserKeys);
        return;
      }

      // 本番環境または初回参加の場合のみjoinRoomを実行
      if (!hasJoined && existingUserKeys.length === 0) {
        console.log("🚀 EXECUTING: joinRoom()");
        joinRoom();
        hasJoinedRef.current = true; //フラグを立てる
      }
    }
  }, [isLoading, roomId]);

  // ページを離れる時に参加者数を減らす（通常のクリーンアップ）
  useEffect(() => {
    return () => {
      // 開発環境でのHMR時はleaveRoomをスキップ
      if (process.env.NODE_ENV === "development") {
        console.log(
          "🔧 DEV MODE: HMR DETECTED - Skipping leaveRoom() on cleanup"
        );
        return;
      }

      if (roomInfo) {
        leaveRoom();
      }
    };
  }, []); // 依存配列を空にしてHMRによる再実行を防ぐ

  // ブラウザ閉じる・タブ閉じる・リロード時の退出処理
  // Note: beforeunload時にCloud Functionsを呼び出すことはできないため、
  // 通常のleaveRoom()での退出処理に依存します
  useEffect(() => {
    const handleBeforeUnload = () => {
      console.log("Page unloading, clearing session...");

      // セッションストレージをクリア
      const hasJoined = sessionStorage.getItem(`room-${roomId}-joined`);
      if (hasJoined) {
        sessionStorage.removeItem(`room-${roomId}-joined`);
      }
    };

    // イベントリスナーを追加
    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      // クリーンアップ時にもイベントリスナーを削除
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [roomId]);

  // リアルタイムでルーム情報を監視（Firestore onSnapshot）
  useEffect(() => {
    if (!roomId) return;

    const db = getFirestore(app);
    const roomRef = doc(db, "rooms", roomId);

    // リアルタイムリスナーをセットアップ
    const unsubscribe = onSnapshot(
      roomRef,
      (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data();

          // 開発環境でのみデバッグ情報を出力
          if (process.env.NODE_ENV === "development") {
            console.log("🔄 Real-time Room Update:", {
              roomId,
              status: data.status,
              participantCount: data.participants?.length || 0,
              name: data.name,
            });
          }

          setRoomInfo({
            roomId: roomId,
            name: data.name || "不明なルーム",
            description: data.description || "",
            isPrivate: data.isPrivate || false,
            members: data.participants?.length || 0,
          });
        } else {
          console.warn("Room not found in Firestore:", roomId);
          setRoomInfo({
            roomId: roomId,
            name: "不明なルーム",
            description: "ルーム情報を取得できませんでした",
            isPrivate: false,
            members: 0,
          });
        }
      },
      (error) => {
        console.error("Failed to listen to room updates:", error);
        setRoomInfo({
          roomId: roomId,
          name: "不明なルーム",
          description: "ルーム情報を取得できませんでした",
          isPrivate: false,
          members: 0,
        });
      }
    );

    // クリーンアップ時にリスナーを解除
    return () => unsubscribe();
  }, [roomId]);

  // 参加処理のデバウンス用
  const joinAttemptRef = useRef<boolean>(false);
  const lastJoinTimeRef = useRef<number>(0);

  // ルームに参加する処理（Firebase Cloud Functions版）
  const joinRoom = async () => {
    try {
      // デバウンス：短時間での重複実行を防ぐ
      const now = Date.now();
      if (joinAttemptRef.current || now - lastJoinTimeRef.current < 2000) {
        console.log("🔧 JOIN DEBOUNCED - Skipping duplicate join attempt");
        return;
      }

      joinAttemptRef.current = true;
      lastJoinTimeRef.current = now;

      const roomJoinKey = `room-${roomId}-joined`;
      const hasJoined = sessionStorage.getItem(roomJoinKey);

      // 既に参加済みの場合はスキップ
      if (hasJoined) {
        console.log("⚠️ Already joined this room");
        joinAttemptRef.current = false;
        return;
      }

      // ルーム情報を取得して、ルーム作成者かチェック
      const db = getFirestore(app);
      const roomRef = doc(db, "rooms", roomId);
      const roomSnap = await getDoc(roomRef);

      if (roomSnap.exists()) {
        const roomData = roomSnap.data();
        const currentUserId = user?.uid || nextAuthSession?.user?.id;

        // currentUserIdが未定義の場合は早期リターン
        // Note: roomJoinKeyは削除せず、ログイン後の再参加を可能にする
        if (!currentUserId) {
          console.warn("⚠️ currentUserId is undefined - cannot join room");
          console.warn("💡 Please sign in to join the room");
          joinAttemptRef.current = false;
          // TODO: ミドルウェアレベルでの認証チェックを実装し、
          // 未認証ユーザーをログインページにリダイレクトすることを検討
          return;
        }

        // ルーム作成者の場合は、既にparticipantsに含まれているためjoinRoomをスキップ
        if (roomData.createdBy === currentUserId) {
          console.log(
            "👑 Room creator - skipping joinRoom, already in participants"
          );
          sessionStorage.setItem(roomJoinKey, "true");
          joinAttemptRef.current = false;
          return;
        }

        // 既にparticipantsに含まれている場合もスキップ
        if (roomData.participants?.includes(currentUserId)) {
          console.log("✅ Already in participants - skipping joinRoom");
          sessionStorage.setItem(roomJoinKey, "true");
          joinAttemptRef.current = false;
          return;
        }
      }

      console.log("Joining room via Cloud Functions:", roomId);

      // Firebase Cloud Functionsでルームに参加
      const functions = getFunctions(app, "us-central1");
      const joinRoomFunction = httpsCallable<JoinRoomRequest, JoinRoomResponse>(
        functions,
        "joinRoom"
      );

      const result = await joinRoomFunction({
        roomId: roomId,
      });

      const data = result.data;
      console.log("Successfully joined room:", data);

      // セッション情報を保存
      sessionStorage.setItem(roomJoinKey, "true");
    } catch (error) {
      const message = handleFirebaseFunctionError(
        "ルーム参加エラー",
        error,
        "ルームへの参加に失敗しました"
      );
      console.error("Error joining room:", message);
    } finally {
      // デバウンスフラグをリセット
      joinAttemptRef.current = false;
    }
  };

  const fetchMessages = async () => {
    try {
      const dummyMessages: ChatMessage[] = [
        {
          id: "1",
          userId: "system",
          userName: "システム",
          content: "ルームに参加しました。音声通話を開始できます。",
          timestamp: new Date(Date.now() - 60000),
        },
      ];
      setMessages(dummyMessages);
      setIsLoading(false);
    } catch (error) {
      console.error("Failed to fetch messages:", error);
      setIsLoading(false);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    const message: ChatMessage = {
      id: Date.now().toString(),
      userId: "currentUser",
      userName: "あなた",
      content: newMessage,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, message]);
    setNewMessage("");
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString("ja-JP", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const handleVoiceCallStateChange = useCallback((state: VoiceCallState) => {
    if (process.env.NODE_ENV === "development") {
      console.log("=== VOICE CALL STATE CHANGE DEBUG ===");
      console.log("State:", state);
      console.log("State participants:", state.participants);
      console.log(
        "State participants count:",
        state.participants ? state.participants.length : 0
      );
    }

    setVoiceCallState(state);

    // 参加者数も更新（より正確に、最低1人として）
    setRoomInfo((prev: RoomDisplayInfo | null) => {
      if (!prev) return null;

      const rawMemberCount =
        state.actualParticipantCount ||
        (state.participants ? state.participants.length + 1 : 1);
      const newMemberCount = Math.max(rawMemberCount, 1); // 最低1人

      // 値が変わっていない場合は更新しない（再レンダリング防止）
      if (prev.members === newMemberCount) {
        return prev;
      }
      if (process.env.NODE_ENV === "development") {
        console.log(
          "Updating room members to:",
          newMemberCount,
          "(raw:",
          rawMemberCount,
          ")"
        );
      }

      return {
        ...prev,
        members: newMemberCount,
      };
    });
  }, []);

  const handleToggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  };

  const handleCopyRoomId = () => {
    navigator.clipboard.writeText(roomId);
    alert("ルームIDをコピーしました");
  };

  const handleResetRoom = async () => {
    if (process.env.NODE_ENV !== "development") return; // 本番環境では実行しない

    try {
      const response = await fetch(`/api/rooms/${roomId}/reset`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (response.ok) {
        const data = await response.json();
        console.log("Room reset successfully:", data);
        setRoomInfo(data.room);

        // セッションストレージもクリア
        Object.keys(sessionStorage).forEach((key) => {
          if (key.startsWith(`room-${roomId}-`)) {
            sessionStorage.removeItem(key);
          }
        });

        alert("ルームがリセットされました");
        window.location.reload(); // ページをリロードして状態をクリア
      } else {
        console.error("Failed to reset room");
        alert("ルームのリセットに失敗しました");
      }
    } catch (error) {
      console.error("Error resetting room:", error);
      alert("ルームのリセットに失敗しました");
    }
  };

  const handleExitClick = () => {
    setShowExitConfirm(true);
  };

  // ルームから退出する処理（Firebase Cloud Functions版）
  const leaveRoom = useCallback(async () => {
    try {
      // 参加済みの場合のみ退出処理を実行
      const hasJoined = sessionStorage.getItem(`room-${roomId}-joined`);
      if (!hasJoined) {
        console.log("Not joined this room");
        return;
      }

      console.log("Leaving room via Cloud Functions:", roomId);

      // Firebase Cloud Functionsでルームから退出
      const functions = getFunctions(app, "us-central1");
      const leaveRoomFunction = httpsCallable<
        { roomId: string },
        { success: boolean }
      >(functions, "leaveRoom");

      await leaveRoomFunction({
        roomId: roomId,
      });

      console.log("Successfully left room");

      // セッション情報をクリア
      sessionStorage.removeItem(`room-${roomId}-joined`);
    } catch (error) {
      const message = handleFirebaseFunctionError(
        "ルーム退出エラー",
        error,
        "ルームからの退出に失敗しました"
      );
      console.error("Error leaving room:", message);
    }
  }, [roomId]);

  const handleExitConfirm = async () => {
    if (isExiting) return;
    setIsExiting(true);
    setShowExitConfirm(false);

    try {
      // 退出処理が完了するまで待つ
      await leaveRoom();
      console.log("Exit process completed, navigating to dashboard");

      // 退出処理完了後にダッシュボードに移動
      router.push("/dashboard");
    } catch (error) {
      console.error("Error during exit process:", error);
      // エラーが発生してもダッシュボードに移動
      router.push("/dashboard");
    } finally {
      // 遷移するのでfalseに戻す必要はないかもしれないが、念のため
      // setIsExiting(false);
    }
  };

  const handleExitCancel = () => {
    setShowExitConfirm(false);
  };

  const handleVoiceCallLeave = useCallback(async () => {
    if (isExiting) return;
    setIsExiting(true);
    console.log("Voice call leave requested");
    try {
      // 退出処理が完了するまで待つ
      await leaveRoom();
      console.log(
        "Voice call leave process completed, navigating to dashboard"
      );

      // 退出処理完了後にダッシュボードに移動
      router.push("/dashboard");
    } catch (error) {
      console.error("Error during voice call leave process:", error);
      // エラーが発生してもダッシュボードに移動
      router.push("/dashboard");
    }
  }, [leaveRoom, router, isExiting]);

  const participantName = useMemo(() => {
    const userId = user?.uid || nextAuthSession?.user?.id || "anonymous";
    const userName =
      user?.displayName || nextAuthSession?.user?.name || "ゲスト";

    if (typeof window === "undefined") return userName;

    const stableUserIdKey = `stable-user-id-${userId}`;
    let stableUserId = sessionStorage.getItem(stableUserIdKey);
    if (!stableUserId) {
      stableUserId = `${userId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      sessionStorage.setItem(stableUserIdKey, stableUserId);
    }
    return `${userName}-${stableUserId.split("-").slice(-2).join("-")}`;
  }, [
    user?.uid,
    nextAuthSession?.user?.id,
    user?.displayName,
    nextAuthSession?.user?.name,
  ]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-300">ルームを読み込み中...</p>
        </div>
      </div>
    );
  }

  // 退出処理中のローディング画面
  if (isExiting) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-500 mx-auto mb-4"></div>
          <p className="text-gray-300">退出処理中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col">
      {/* ヘッダー */}
      <div className="bg-gray-800 border-b border-gray-700 px-4 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div>
              <h1 className="text-xl font-bold text-white">{roomInfo?.name}</h1>
              <p className="text-sm text-gray-400">{roomInfo?.description}</p>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2 text-sm text-gray-300">
              <Users className="w-4 h-4" />
              <span>{roomInfo?.members || 0}人参加中</span>
            </div>
            <div className="relative">
              <Button
                onClick={() => setShowMoreMenu(!showMoreMenu)}
                variant="outline"
                size="sm"
                className="flex items-center bg-gray-700 border-gray-600 text-gray-200 hover:bg-gray-600"
              >
                <MoreVertical className="w-4 h-4" />
              </Button>
              {showMoreMenu && (
                <div className="absolute right-0 top-full mt-2 w-48 bg-gray-800 rounded-lg shadow-xl border border-gray-700 z-50">
                  <div className="p-2 space-y-1">
                    <Button
                      onClick={handleCopyRoomId}
                      variant="outline"
                      size="sm"
                      className="w-full justify-start bg-gray-700 border-gray-600 text-gray-200 hover:bg-gray-600"
                    >
                      ルームIDをコピー
                    </Button>
                    {/* 開発環境でのテスト用に常に表示 */}
                    {process.env.NODE_ENV === "development" && (
                      <Button
                        onClick={handleResetRoom}
                        variant="outline"
                        size="sm"
                        className="w-full justify-start bg-red-700 border-red-600 text-red-200 hover:bg-red-600"
                      >
                        🔧 ルームをリセット（開発用）
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* メインコンテンツ */}
      <div className="flex-1 flex">
        {/* 音声通話メインエリア（参加者グリッド） */}
        <div
          className={`flex-1 flex flex-col ${showChat ? "mr-80" : ""} relative`}
        >
          <VoiceCall
            roomId={roomId}
            participantName={participantName}
            onLeave={handleVoiceCallLeave}
            onStateChange={handleVoiceCallStateChange}
            serverMemberCount={roomInfo?.members}
            className="flex-1"
          />
        </div>
      </div>

      {/* 退出確認ダイアログ */}
      {showExitConfirm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-xl p-6 max-w-md mx-4 border border-gray-700 shadow-2xl">
            <div className="text-center">
              <div className="w-16 h-16 bg-red-600/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <ArrowLeft className="w-8 h-8 text-red-400" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">
                ルームから退出しますか？
              </h3>
              <p className="text-gray-300 mb-6">
                ルームから退出すると、音声通話が終了します。この操作は取り消せません。
              </p>
              <div className="flex space-x-3">
                <Button
                  onClick={handleExitCancel}
                  variant="outline"
                  className="flex-1 bg-gray-700 hover:bg-gray-600 border-gray-600 text-gray-300"
                >
                  キャンセル
                </Button>
                <Button
                  onClick={handleExitConfirm}
                  variant="destructive"
                  className="flex-1 bg-red-600 hover:bg-red-700"
                >
                  退出する
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 設定メニューの外側クリックで閉じる */}
      {(showSettings || showMoreMenu) && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => {
            setShowSettings(false);
            setShowMoreMenu(false);
          }}
        />
      )}
    </div>
  );
}
