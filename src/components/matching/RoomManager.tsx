'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { app } from '@/lib/firebaseConfig';
import { handleFirebaseFunctionError } from '@/lib/utils';
import {
  CreateRoomRequest,
  CreateRoomResponse,
  JoinRoomRequest,
  JoinRoomResponse,
} from '@/types/room';

type TabType = 'create' | 'join';

export default function RoomManager() {
  const router = useRouter();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>('create');

  // ルーム作成用の状態
  const [roomName, setRoomName] = useState('');
  const [roomDescription, setRoomDescription] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [createdRoomId, setCreatedRoomId] = useState<string | null>(null);

  // ルーム参加用の状態
  const [joinRoomId, setJoinRoomId] = useState('');

  // 共通の状態
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // タイムアウトIDを保存するref
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user) {
      setError('ログインが必要です');
      return;
    }

    if (!roomName.trim()) {
      setError('ルーム名を入力してください');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const functions = getFunctions(app, 'us-central1');
      const createRoom = httpsCallable<CreateRoomRequest, CreateRoomResponse>(
        functions,
        'createRoom'
      );

      const result = await createRoom({
        name: roomName.trim(),
        description: roomDescription.trim(),
        isPrivate,
      });

      const data = result.data;
      setCreatedRoomId(data.roomId);

      // 3秒後に自動的にルームに遷移
      timeoutRef.current = setTimeout(() => {
        router.push(`/room/${data.roomId}`);
      }, 3000);
    } catch (err: unknown) {
      const message = handleFirebaseFunctionError(
        'ルーム作成エラー',
        err,
        'ルームの作成に失敗しました'
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
    };
  }, []);

  const handleJoinRoom = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user) {
      setError('ログインが必要です');
      return;
    }

    if (!joinRoomId.trim()) {
      setError('ルームIDを入力してください');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const functions = getFunctions(app, 'us-central1');
      const joinRoom = httpsCallable<JoinRoomRequest, JoinRoomResponse>(
        functions,
        'joinRoom'
      );

      await joinRoom({
        roomId: joinRoomId.trim().toUpperCase(),
      });

      // ルームに遷移
      router.push(`/room/${joinRoomId.trim().toUpperCase()}`);
    } catch (err: unknown) {
      const message = handleFirebaseFunctionError(
        'ルーム参加エラー',
        err,
        'ルームへの参加に失敗しました'
      );
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  const copyRoomId = () => {
    if (createdRoomId) {
      navigator.clipboard.writeText(createdRoomId);
      alert('ルームIDをコピーしました');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md">
        <h1 className="text-3xl font-bold text-center mb-8 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
          V-Chat ルーム管理
        </h1>

        {/* タブ切り替え */}
        <div className="flex gap-2 mb-6">
          <button
            type="button"
            onClick={() => {
              setActiveTab('create');
              setError(null);
              setCreatedRoomId(null);
            }}
            className={`flex-1 py-3 px-4 rounded-lg font-semibold transition-all ${
              activeTab === 'create'
                ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            ルームを作成
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('join');
              setError(null);
              setCreatedRoomId(null);
            }}
            className={`flex-1 py-3 px-4 rounded-lg font-semibold transition-all ${
              activeTab === 'join'
                ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            ルームに参加
          </button>
        </div>

        {/* エラー表示 */}
        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-600">
            {error}
          </div>
        )}

        {/* ルーム作成成功表示 */}
        {createdRoomId && activeTab === 'create' && (
          <div className="mb-6 p-6 bg-green-50 border border-green-200 rounded-lg">
            <h3 className="font-bold text-green-800 mb-2">
              ルームを作成しました！
            </h3>
            <p className="text-sm text-green-700 mb-3">
              以下のルームIDを相手に共有してください
            </p>
            <div className="flex gap-2">
              <input
                type="text"
                value={createdRoomId}
                readOnly
                className="flex-1 px-4 py-3 bg-white border border-green-300 rounded-lg font-mono text-xl text-center"
              />
              <button
                type="button"
                onClick={copyRoomId}
                className="px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                コピー
              </button>
            </div>
            <p className="text-sm text-green-600 mt-3 text-center">
              3秒後に自動的にルームに移動します...
            </p>
          </div>
        )}

        {/* ルーム作成フォーム */}
        {activeTab === 'create' && !createdRoomId && (
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
              className="w-full py-3 px-6 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold rounded-lg hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? '作成中...' : 'ルームを作成'}
            </button>
          </form>
        )}

        {/* ルーム参加フォーム */}
        {activeTab === 'join' && (
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
                maxLength={6}
              />
              <p className="text-sm text-gray-500 mt-2">
                相手から共有されたルームIDを入力してください
              </p>
            </div>

            <button
              type="submit"
              disabled={isLoading || !joinRoomId.trim()}
              className="w-full py-3 px-6 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold rounded-lg hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? '参加中...' : 'ルームに参加'}
            </button>
          </form>
        )}

        {/* 戻るボタン */}
        <button
          type="button"
          onClick={() => router.push('/')}
          className="w-full mt-6 py-2 text-gray-600 hover:text-gray-800 transition-colors"
        >
          ホームに戻る
        </button>
      </div>
    </div>
  );
}
