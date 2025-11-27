'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import {
  ArrowLeft,
  Send,
  Users,
  MessageCircle,
  Mic,
  Settings,
  MoreVertical,
  Monitor,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import VoiceCall from '@/components/voice/VoiceCall';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { app } from '@/lib/firebaseConfig';
import { handleFirebaseFunctionError } from '@/lib/utils';
import { getFirestore, doc, getDoc, onSnapshot } from 'firebase/firestore';
import type {
  JoinRoomRequest,
  JoinRoomResponse,
  ChatMessage,
  RoomDisplayInfo,
} from '@/types/room';
import type { VoiceCallState } from '@/types/voice';

export default function ChatRoom() {
  const params = useParams();
  const router = useRouter();
  const roomId = params.roomId as string;
  const { user, nextAuthSession } = useAuth();

  const [roomInfo, setRoomInfo] = useState<RoomDisplayInfo | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);
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
        if (key.startsWith('room-') && !key.startsWith(`room-${roomId}-`)) {
          sessionStorage.removeItem(key);
          console.log('🧹 Cleaned up old session data:', key);
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
        '🔍 Checking join status - hasJoined:',
        hasJoined,
        'existingUserKeys:',
        existingUserKeys.length
      );

      // 開発環境でのHMR対応：既に参加済みの場合は再参加をスキップ
      if (
        process.env.NODE_ENV === 'development' &&
        (hasJoined || existingUserKeys.length > 0)
      ) {
        console.log(
          '🔧 DEV MODE: HMR DETECTED - Skipping joinRoom() - already joined'
        );
        console.log('Session join status:', hasJoined);
        console.log('Existing user keys:', existingUserKeys);
        return;
      }

      // 本番環境または初回参加の場合のみjoinRoomを実行
      if (!hasJoined && existingUserKeys.length === 0) {
        console.log('🚀 EXECUTING: joinRoom()');
        joinRoom();
        hasJoinedRef.current = true; //フラグを立てる
      }
    }
  }, [isLoading, roomId]);

  // ページを離れる時に参加者数を減らす（通常のクリーンアップ）
  useEffect(() => {
    return () => {
      // 開発環境でのHMR時はleaveRoomをスキップ
      if (process.env.NODE_ENV === 'development') {
        console.log(
          '🔧 DEV MODE: HMR DETECTED - Skipping leaveRoom() on cleanup'
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
      console.log('Page unloading, clearing session...');

      // セッションストレージをクリア
      const hasJoined = sessionStorage.getItem(`room-${roomId}-joined`);
      if (hasJoined) {
        sessionStorage.removeItem(`room-${roomId}-joined`);
      }
    };

    // イベントリスナーを追加
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      // クリーンアップ時にもイベントリスナーを削除
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [roomId]);

  // リアルタイムでルーム情報を監視（Firestore onSnapshot）
  useEffect(() => {
    if (!roomId) return;

    const db = getFirestore(app);
    const roomRef = doc(db, 'rooms', roomId);

    // リアルタイムリスナーをセットアップ
    const unsubscribe = onSnapshot(
      roomRef,
      (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data();

          console.log('🔄 Real-time Room Update:', {
            roomId,
            status: data.status,
            participants: data.participants,
            createdBy: data.createdBy,
            livekitRoomId: data.livekitRoomId,
            name: data.name,
          });

          setRoomInfo({
            id: roomId,
            name: data.name || '不明なルーム',
            description: data.description || '',
            isPrivate: data.isPrivate || false,
            members: data.participants?.length || 0,
          });
        } else {
          console.warn('Room not found in Firestore:', roomId);
          setRoomInfo({
            id: roomId,
            name: '不明なルーム',
            description: 'ルーム情報を取得できませんでした',
            isPrivate: false,
            members: 0,
          });
        }
      },
      (error) => {
        console.error('Failed to listen to room updates:', error);
        setRoomInfo({
          id: roomId,
          name: '不明なルーム',
          description: 'ルーム情報を取得できませんでした',
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
        console.log('🔧 JOIN DEBOUNCED - Skipping duplicate join attempt');
        return;
      }

      joinAttemptRef.current = true;
      lastJoinTimeRef.current = now;

      const roomJoinKey = `room-${roomId}-joined`;
      const hasJoined = sessionStorage.getItem(roomJoinKey);

      // 既に参加済みの場合はスキップ
      if (hasJoined) {
        console.log('⚠️ Already joined this room');
        joinAttemptRef.current = false;
        return;
      }

      // ルーム情報を取得して、ルーム作成者かチェック
      const db = getFirestore(app);
      const roomRef = doc(db, 'rooms', roomId);
      const roomSnap = await getDoc(roomRef);

      if (roomSnap.exists()) {
        const roomData = roomSnap.data();
        const currentUserId = user?.uid || nextAuthSession?.user?.id;

        // ルーム作成者の場合は、既にparticipantsに含まれているためjoinRoomをスキップ
        if (roomData.createdBy === currentUserId) {
          console.log(
            '👑 Room creator - skipping joinRoom, already in participants'
          );
          sessionStorage.setItem(roomJoinKey, 'true');
          joinAttemptRef.current = false;
          return;
        }

        // 既にparticipantsに含まれている場合もスキップ
        if (roomData.participants?.includes(currentUserId)) {
          console.log('✅ Already in participants - skipping joinRoom');
          sessionStorage.setItem(roomJoinKey, 'true');
          joinAttemptRef.current = false;
          return;
        }
      }

      console.log('Joining room via Cloud Functions:', roomId);

      // Firebase Cloud Functionsでルームに参加
      const functions = getFunctions(app, 'us-central1');
      const joinRoomFunction = httpsCallable<JoinRoomRequest, JoinRoomResponse>(
        functions,
        'joinRoom'
      );

      const result = await joinRoomFunction({
        roomId: roomId,
      });

      const data = result.data;
      console.log('Successfully joined room:', data);

      // セッション情報を保存
      sessionStorage.setItem(roomJoinKey, 'true');
    } catch (error) {
      const message = handleFirebaseFunctionError(
        'ルーム参加エラー',
        error,
        'ルームへの参加に失敗しました'
      );
      console.error('Error joining room:', message);
    } finally {
      // デバウンスフラグをリセット
      joinAttemptRef.current = false;
    }
  };

  const fetchMessages = async () => {
    try {
      const dummyMessages: ChatMessage[] = [
        {
          id: '1',
          userId: 'system',
          userName: 'システム',
          content: 'ルームに参加しました。音声通話を開始できます。',
          timestamp: new Date(Date.now() - 60000),
        },
      ];
      setMessages(dummyMessages);
      setIsLoading(false);
    } catch (error) {
      console.error('Failed to fetch messages:', error);
      setIsLoading(false);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    const message: ChatMessage = {
      id: Date.now().toString(),
      userId: 'currentUser',
      userName: 'あなた',
      content: newMessage,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, message]);
    setNewMessage('');
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('ja-JP', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const handleVoiceCallStateChange = (state: VoiceCallState) => {
    console.log('=== VOICE CALL STATE CHANGE DEBUG ===');
    console.log('State:', state);
    console.log('State participants:', state.participants);
    console.log(
      'State participants count:',
      state.participants ? state.participants.length : 0
    );
    console.log('Current roomInfo:', roomInfo);

    setVoiceCallState(state);

    // 参加者数も更新（より正確に、最低1人として）
    if (roomInfo) {
      const rawMemberCount =
        state.actualParticipantCount ||
        (state.participants ? state.participants.length + 1 : 1);
      const newMemberCount = Math.max(rawMemberCount, 1); // 最低1人
      console.log(
        'Updating room members to:',
        newMemberCount,
        '(raw:',
        rawMemberCount,
        ')'
      );

      setRoomInfo((prev: RoomDisplayInfo | null) =>
        prev
          ? {
              ...prev,
              members: newMemberCount,
            }
          : null
      );
    }
  };

  const handleMicTest = () => {
    // 新しいウィンドウでマイクテストページを開く
    window.open(
      '/mic-test',
      '_blank',
      'width=500,height=700,scrollbars=no,resizable=yes'
    );
    setShowSettings(false);
  };

  const handleToggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  };

  const handleCopyRoomId = () => {
    navigator.clipboard.writeText(roomId);
    alert('ルームIDをコピーしました');
  };

  const handleResetRoom = async () => {
    // if (process.env.NODE_ENV !== 'development') return; // 開発用に一時的にコメントアウト

    try {
      const response = await fetch(`/api/rooms/${roomId}/reset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (response.ok) {
        const data = await response.json();
        console.log('Room reset successfully:', data);
        setRoomInfo(data.room);

        // セッションストレージもクリア
        Object.keys(sessionStorage).forEach((key) => {
          if (key.startsWith(`room-${roomId}-`)) {
            sessionStorage.removeItem(key);
          }
        });

        alert('ルームがリセットされました');
        window.location.reload(); // ページをリロードして状態をクリア
      } else {
        console.error('Failed to reset room');
        alert('ルームのリセットに失敗しました');
      }
    } catch (error) {
      console.error('Error resetting room:', error);
      alert('ルームのリセットに失敗しました');
    }
  };

  const handleExitClick = () => {
    setShowExitConfirm(true);
  };

  // ルームから退出する処理（Firebase Cloud Functions版）
  const leaveRoom = async () => {
    try {
      // 参加済みの場合のみ退出処理を実行
      const hasJoined = sessionStorage.getItem(`room-${roomId}-joined`);
      if (!hasJoined) {
        console.log('Not joined this room');
        return;
      }

      console.log('Leaving room via Cloud Functions:', roomId);

      // Firebase Cloud Functionsでルームを終了
      const functions = getFunctions(app, 'us-central1');
      const endRoomFunction = httpsCallable<
        { roomId: string },
        { success: boolean }
      >(functions, 'endRoom');

      await endRoomFunction({
        roomId: roomId,
      });

      console.log('Successfully left room');

      // セッション情報をクリア
      sessionStorage.removeItem(`room-${roomId}-joined`);
    } catch (error) {
      const message = handleFirebaseFunctionError(
        'ルーム退出エラー',
        error,
        'ルームからの退出に失敗しました'
      );
      console.error('Error leaving room:', message);
    }
  };

  const handleExitConfirm = async () => {
    setShowExitConfirm(false);

    try {
      // 退出処理が完了するまで待つ
      await leaveRoom();
      console.log('Exit process completed, navigating to dashboard');

      // 退出処理完了後にダッシュボードに移動
      router.push('/dashboard');
    } catch (error) {
      console.error('Error during exit process:', error);
      // エラーが発生してもダッシュボードに移動
      router.push('/dashboard');
    }
  };

  const handleExitCancel = () => {
    setShowExitConfirm(false);
  };

  const handleVoiceCallLeave = async () => {
    console.log('Voice call leave requested');
    try {
      // 退出処理が完了するまで待つ
      await leaveRoom();
      console.log(
        'Voice call leave process completed, navigating to dashboard'
      );

      // 退出処理完了後にダッシュボードに移動
      router.push('/dashboard');
    } catch (error) {
      console.error('Error during voice call leave process:', error);
      // エラーが発生してもダッシュボードに移動
      router.push('/dashboard');
    }
  };

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

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col">
      {/* ヘッダー */}
      <div className="bg-gray-800 border-b border-gray-700 px-4 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Button
              onClick={handleExitClick}
              variant="outline"
              size="sm"
              className="flex items-center bg-gray-700 border-gray-600 text-gray-200 hover:bg-gray-600"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              退出
            </Button>
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
            <Button
              onClick={() => setShowChat(!showChat)}
              variant={showChat ? 'default' : 'outline'}
              size="sm"
              className="flex items-center bg-blue-600 hover:bg-blue-700 text-white"
            >
              <MessageCircle className="w-4 h-4 mr-2" />
              チャット
            </Button>
            <div className="relative">
              <Button
                onClick={() => setShowSettings(!showSettings)}
                variant="outline"
                size="sm"
                className="flex items-center bg-gray-700 border-gray-600 text-gray-200 hover:bg-gray-600"
              >
                <Settings className="w-4 h-4" />
              </Button>
              {showSettings && (
                <div className="absolute right-0 top-full mt-2 w-64 bg-gray-800 rounded-lg shadow-xl border border-gray-700 z-50">
                  <div className="p-4">
                    <h3 className="text-white font-semibold mb-3">設定</h3>
                    <div className="space-y-2">
                      <Button
                        onClick={handleMicTest}
                        variant="outline"
                        size="sm"
                        className="w-full justify-start bg-gray-700 border-gray-600 text-gray-200 hover:bg-gray-600"
                      >
                        <Mic className="w-4 h-4 mr-2" />
                        マイクテスト
                      </Button>
                      <Button
                        onClick={handleToggleFullscreen}
                        variant="outline"
                        size="sm"
                        className="w-full justify-start bg-gray-700 border-gray-600 text-gray-200 hover:bg-gray-600"
                      >
                        <Monitor className="w-4 h-4 mr-2" />
                        全画面表示
                      </Button>
                    </div>
                  </div>
                </div>
              )}
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
                    {true && (
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
        {/* 音声通話メインエリア */}
        <div className={`flex-1 flex flex-col ${showChat ? 'mr-80' : ''}`}>
          <div className="flex-1 flex items-center justify-center p-8">
            <div className="text-center">
              <div
                className={`w-32 h-32 rounded-full flex items-center justify-center mx-auto mb-6 ${
                  voiceCallState.isConnected
                    ? 'bg-gradient-to-br from-blue-500 to-purple-600'
                    : 'bg-gray-700'
                }`}
              >
                <Mic
                  className={`w-16 h-16 ${voiceCallState.isConnected ? 'text-white' : 'text-gray-400'}`}
                />
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">
                {voiceCallState.isConnected ? '音声通話中' : '接続中...'}
              </h2>
              <p className="text-gray-400 mb-6">
                {voiceCallState.isConnected
                  ? 'マイクをクリックしてミュート/ミュート解除'
                  : 'LiveKitサーバーに接続しています...'}
              </p>

              {/* 接続状態表示 */}
              {!voiceCallState.isConnected && (
                <div className="mt-8">
                  <div className="inline-flex items-center px-4 py-2 rounded-full bg-yellow-900 text-yellow-200">
                    <div className="w-2 h-2 bg-yellow-400 rounded-full mr-2 animate-pulse"></div>
                    接続中...
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* チャットサイドパネル */}
        {showChat && (
          <div className="w-80 bg-gray-800 border-l border-gray-700 flex flex-col">
            <div className="p-4 border-b border-gray-700">
              <h3 className="text-lg font-semibold text-white">チャット</h3>
            </div>

            {/* メッセージエリア */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {messages.map((message) => (
                <div key={message.id} className="flex items-start space-x-3">
                  <div className="w-8 h-8 bg-gradient-to-r from-blue-400 to-purple-400 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                    {message.userName.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2 mb-1">
                      <span className="font-semibold text-white text-sm">
                        {message.userName}
                      </span>
                      <span className="text-xs text-gray-400">
                        {formatTime(message.timestamp)}
                      </span>
                    </div>
                    <p className="text-gray-300 text-sm bg-gray-700 rounded-lg px-3 py-2">
                      {message.content}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {/* メッセージ入力エリア */}
            <div className="p-4 border-t border-gray-700">
              <form onSubmit={handleSendMessage} className="flex space-x-2">
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="メッセージを入力..."
                  className="flex-1 bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <Button
                  type="submit"
                  disabled={!newMessage.trim()}
                  size="sm"
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  <Send className="w-4 h-4" />
                </Button>
              </form>
            </div>
          </div>
        )}
      </div>

      {/* 音声通話コンポーネント（実際に動作） */}
      <VoiceCall
        roomId={roomId}
        participantName={(() => {
          // 安定したparticipantNameを取得
          const stableUserIdKey = `stable-user-id-${user?.uid || nextAuthSession?.user?.id || 'anonymous'}`;
          let stableUserId = sessionStorage.getItem(stableUserIdKey);
          if (!stableUserId) {
            stableUserId = `${user?.uid || nextAuthSession?.user?.id || 'anonymous'}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            sessionStorage.setItem(stableUserIdKey, stableUserId);
          }
          return `${user?.displayName || nextAuthSession?.user?.name || 'ゲスト'}-${stableUserId.split('-').slice(-2).join('-')}`;
        })()}
        onLeave={handleVoiceCallLeave}
        onStateChange={handleVoiceCallStateChange}
        serverMemberCount={roomInfo?.members}
      />

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
