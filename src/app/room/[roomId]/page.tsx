'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Send, Users, MessageCircle, Phone, PhoneOff, Mic, MicOff, Settings, MoreVertical } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import VoiceCall from '@/components/voice/VoiceCall';

interface Message {
  id: string;
  userId: string;
  userName: string;
  content: string;
  timestamp: Date;
}

interface RoomInfo {
  id: string;
  name: string;
  description: string;
  isPrivate: boolean;
  members: number;
}

export default function ChatRoom() {
  const params = useParams();
  const router = useRouter();
  const roomId = params.roomId as string;
  
  const [roomInfo, setRoomInfo] = useState<RoomInfo | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [showChat, setShowChat] = useState(false);
  const [isMuted, setIsMuted] = useState(false);

  useEffect(() => {
    fetchRoomInfo();
    fetchMessages();
  }, [roomId]);

  const fetchRoomInfo = async () => {
    try {
      setRoomInfo({
        id: roomId,
        name: '雑談部屋',
        description: '気軽に雑談できるルームです',
        isPrivate: false,
        members: 3
      });
    } catch (error) {
      console.error('Failed to fetch room info:', error);
    }
  };

  const fetchMessages = async () => {
    try {
      const dummyMessages: Message[] = [
        {
          id: '1',
          userId: 'user1',
          userName: 'ユーザー1',
          content: 'こんにちは！',
          timestamp: new Date(Date.now() - 60000)
        },
        {
          id: '2',
          userId: 'user2',
          userName: 'ユーザー2',
          content: 'よろしくお願いします！',
          timestamp: new Date(Date.now() - 30000)
        }
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

    const message: Message = {
      id: Date.now().toString(),
      userId: 'currentUser',
      userName: 'あなた',
      content: newMessage,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, message]);
    setNewMessage('');
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('ja-JP', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
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
            <Link href="/dashboard">
              <Button variant="outline" size="sm" className="flex items-center bg-gray-700 border-gray-600 text-gray-200 hover:bg-gray-600">
                <ArrowLeft className="w-4 h-4 mr-2" />
                退出
              </Button>
            </Link>
            <div>
              <h1 className="text-xl font-bold text-white">{roomInfo?.name}</h1>
              <p className="text-sm text-gray-400">{roomInfo?.description}</p>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2 text-sm text-gray-300">
              <Users className="w-4 h-4" />
              <span>{roomInfo?.members}人参加中</span>
            </div>
            <Button
              onClick={() => setShowChat(!showChat)}
              variant={showChat ? "default" : "outline"}
              size="sm"
              className="flex items-center bg-blue-600 hover:bg-blue-700 text-white"
            >
              <MessageCircle className="w-4 h-4 mr-2" />
              チャット
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="flex items-center bg-gray-700 border-gray-600 text-gray-200 hover:bg-gray-600"
            >
              <Settings className="w-4 h-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="flex items-center bg-gray-700 border-gray-600 text-gray-200 hover:bg-gray-600"
            >
              <MoreVertical className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* メインコンテンツ */}
      <div className="flex-1 flex">
        {/* 音声通話メインエリア */}
        <div className={`flex-1 flex flex-col ${showChat ? 'mr-80' : ''}`}>
          <div className="flex-1 flex items-center justify-center p-8">
            <div className="text-center">
              <div className="w-32 h-32 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-6">
                <Mic className="w-16 h-16 text-white" />
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">音声通話中</h2>
              <p className="text-gray-400 mb-6">マイクをクリックしてミュート/ミュート解除</p>
              
              {/* 参加者表示エリア */}
              <div className="grid grid-cols-3 gap-4 max-w-md mx-auto">
                <div className="bg-gray-800 rounded-lg p-4 text-center">
                  <div className="w-12 h-12 bg-blue-500 rounded-full flex items-center justify-center mx-auto mb-2">
                    <span className="text-white font-bold">あ</span>
                  </div>
                  <p className="text-sm text-white">あなた</p>
                  <p className="text-xs text-gray-400">音声オン</p>
                </div>
                <div className="bg-gray-800 rounded-lg p-4 text-center">
                  <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-2">
                    <span className="text-white font-bold">ユ</span>
                  </div>
                  <p className="text-sm text-white">ユーザー1</p>
                  <p className="text-xs text-gray-400">音声オン</p>
                </div>
                <div className="bg-gray-800 rounded-lg p-4 text-center">
                  <div className="w-12 h-12 bg-purple-500 rounded-full flex items-center justify-center mx-auto mb-2">
                    <span className="text-white font-bold">ユ</span>
                  </div>
                  <p className="text-sm text-white">ユーザー2</p>
                  <p className="text-xs text-gray-400">音声オン</p>
                </div>
              </div>
            </div>
          </div>

          {/* コントロールバー */}
          <div className="bg-gray-800 border-t border-gray-700 p-4">
            <div className="flex justify-center items-center space-x-4">
              <Button
                onClick={() => setIsMuted(!isMuted)}
                variant={isMuted ? "destructive" : "outline"}
                size="lg"
                className="w-16 h-16 rounded-full bg-gray-700 border-gray-600 hover:bg-gray-600"
              >
                {isMuted ? <MicOff className="w-8 h-8" /> : <Mic className="w-8 h-8" />}
              </Button>
              
              <Button
                variant="destructive"
                size="lg"
                className="w-16 h-16 rounded-full bg-red-600 hover:bg-red-700"
              >
                <PhoneOff className="w-8 h-8" />
              </Button>
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
                      <span className="font-semibold text-white text-sm">{message.userName}</span>
                      <span className="text-xs text-gray-400">{formatTime(message.timestamp)}</span>
                    </div>
                    <p className="text-gray-300 text-sm bg-gray-700 rounded-lg px-3 py-2">{message.content}</p>
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
                  className="flex-1 bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
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
    </div>
  );
}