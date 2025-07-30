// src/app/room/search/page.tsx
'use client';

import { useState } from 'react';
import { Users, Lock, Unlock, Search } from 'lucide-react';

const dummyRooms = [
  {
    id: 'room-1',
    name: '雑談部屋',
    description: '誰でも気軽にどうぞ！',
    isPrivate: false,
    members: 5,
  },
  {
    id: 'room-2',
    name: 'ゲーム好き集まれ',
    description: '最新ゲームの話題で盛り上がろう！',
    isPrivate: false,
    members: 8,
  },
  {
    id: 'room-3',
    name: '秘密の作戦会議',
    description: '招待制の非公開ルームです',
    isPrivate: true,
    members: 2,
  },
];

export default function RoomSearchPage() {
  const [search, setSearch] = useState('');

  // 検索フィルター
  const filteredRooms = dummyRooms.filter(room =>
    room.name.includes(search) || room.description.includes(search)
  );

  return (
    <div className="min-h-screen flex flex-col items-center bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 pt-12 md:pt-20">
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

      {/* ルーム一覧 */}
      <div className="w-full max-w-2xl grid gap-6">
        {filteredRooms.length === 0 ? (
          <div className="bg-white rounded-xl shadow p-8 text-center text-gray-400">
            ルームが見つかりませんでした
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
                  className="bg-gradient-to-r from-purple-500 to-pink-500 text-white px-6 py-2 rounded-lg font-semibold shadow hover:from-purple-600 hover:to-pink-600 transition"
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