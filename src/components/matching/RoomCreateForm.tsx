// src/components/matching/RoomCreateForm.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Sparkles, Lock, Users, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function RoomCreateForm() {
  const [roomName, setRoomName] = useState('');
  const [description, setDescription] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!roomName.trim()) {
      setError('ルーム名は必須です');
      return;
    }
    setCreating(true);

    // 仮API
    const res = await fetch('/api/room/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roomName, description, isPrivate }),
    });
    const data = await res.json();

    setCreating(false);

    if (data.roomId) {
      router.push(`/room/${data.roomId}`);
    } else {
      setError('ルーム作成に失敗しました');
    }
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

      {/* カードUI */}
      <Card className="w-full max-w-2xl mx-auto shadow-2xl border-0 px-4">
        <CardHeader className="text-center pb-2">
          <CardTitle className="text-2xl font-bold text-gray-800">ルーム情報</CardTitle>
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
                  onChange={e => setRoomName(e.target.value)}
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
                  onChange={e => setDescription(e.target.value)}
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
                onChange={e => setIsPrivate(e.target.checked)}
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
              {creating ? '作成中...' : 'ルームを作成'}
            </Button>
            <div className="mt-4 text-xs text-gray-400 text-center">
              <Users className="inline w-4 h-4 mr-1" />
              ルーム作成後、招待リンクをシェアできます
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}