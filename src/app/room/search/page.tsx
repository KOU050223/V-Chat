'use client';

import { useState, useEffect } from 'react';
import { Users, Lock, Unlock, Search, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

interface Room {
  id: string;
  name: string;
  description: string;
  isPrivate: boolean;
  members: number;
  createdAt: Date;
  createdBy: string;
}

export default function RoomSearchPage() {
  const [search, setSearch] = useState('');
  const [rooms, setRooms] = useState<Room[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchRooms();
  }, []);

  const fetchRooms = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // 実際のAPIエンドポイントからルーム一覧を取得
      // 現在は空の配列を返す（実際の実装ではAPIから取得）
      const response = await fetch('/api/rooms');
      
      if (response.ok) {
        const data = await response.json();
        setRooms(data.rooms || []);
      } else {
        // APIが実装されていない場合は空の配列を設定
        setRooms([]);
      }
    } catch (error) {
      console.error('Failed to fetch rooms:', error);
      setError('ルーム一覧の取得に失敗しました');
      setRooms([]);
    } finally {
      setIsLoading(false);
    }
  };

  // 検索フィルター
  const filteredRooms = rooms.filter(room =>
    room.name.toLowerCase().includes(search.toLowerCase()) || 
    room.description.toLowerCase().includes(search.toLowerCase())
  );

  const handleJoinRoom = async (roomId: string) => {
    try {
      // ルーム参加のAPIを呼び出し
      const response = await fetch(`/api/rooms/${roomId}/join`, {
        method: 'POST',
      });

      if (response.ok) {
        const data = await response.json();
        // ルームに参加後、チャットルーム画面に遷移
        window.location.href = `/room/${roomId}`;
      } else {
        setError('ルームへの参加に失敗しました');
      }
    } catch (error) {
      console.error('Failed to join room:', error);
      setError('ルームへの参加に失敗しました');
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
      <p className="mb-8 text-gray-600">公開ルーム一覧から参加したいルームを選んでください</p>

      {/* 検索バー */}
      <div className="w-full max-w-2xl mb-8 flex items-center bg-white rounded-full shadow px-4 py-2">
        <Search className="w-5 h-5 text-gray-400 mr-2" />
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="ルーム名・説明で検索"
          className="w-full bg-transparent outline-none text-base"
        />
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
                <p className="text-gray-600 mb-2">検索条件に一致するルームが見つかりませんでした</p>
                <Button 
                  onClick={() => setSearch('')} 
                  variant="outline" 
                  className="text-sm"
                >
                  検索をクリア
                </Button>
              </div>
            ) : (
              <div>
                <p className="text-gray-600 mb-2">現在公開されているルームがありません</p>
                <Link href="/room/create">
                  <Button className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600">
                    最初のルームを作成
                  </Button>
                </Link>
              </div>
            )}
          </div>
        ) : (
          filteredRooms.map(room => (
            <div
              key={room.id}
              className="bg-white rounded-xl shadow flex flex-col md:flex-row items-center md:items-stretch justify-between p-6 gap-4"
            >
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-bold text-lg text-gray-800">{room.name}</span>
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
                  title={room.isPrivate ? '非公開ルームには招待が必要です' : 'このルームに参加'}
                >
                  {room.isPrivate ? '招待制' : '参加'}
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}