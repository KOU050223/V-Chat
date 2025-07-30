'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Send, Users, MessageCircle, Phone, PhoneOff, Mic, MicOff, Settings, MoreVertical, Volume2, VolumeX, Monitor, MonitorOff } from 'lucide-react';
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
  const [showSettings, setShowSettings] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [voiceCallState, setVoiceCallState] = useState({
    isConnected: false,
    isMuted: false,
    participants: []
  });

  useEffect(() => {
    fetchRoomInfo();
    fetchMessages();
  }, [roomId]);

  // ルーム情報が取得できたら参加処理を実行
  useEffect(() => {
    if (roomInfo && !isLoading) {
      joinRoom();
    }
  }, [roomInfo, isLoading]);

  // ページを離れる時に参加者数を減らす
  useEffect(() => {
    return () => {
      if (roomInfo) {
        leaveRoom();
      }
    };
  }, [roomInfo]);

  // 定期的にルーム情報を更新（参加者数の同期）
  useEffect(() => {
    if (roomInfo) {
      const interval = setInterval(() => {
        fetchRoomInfo();
      }, 3000); // 3秒ごとに更新

      return () => clearInterval(interval);
    }
  }, [roomInfo]);

  const fetchRoomInfo = async () => {
    try {
      const response = await fetch(`/api/rooms/${roomId}`);
      if (response.ok) {
        const data = await response.json();
        setRoomInfo(data.room);
      } else {
        // ルームが見つからない場合はデフォルト情報を設定
        setRoomInfo({
          id: roomId,
          name: '不明なルーム',
          description: 'ルーム情報を取得できませんでした',
          isPrivate: false,
          members: 1
        });
      }
    } catch (error) {
      console.error('Failed to fetch room info:', error);
      setRoomInfo({
        id: roomId,
        name: '不明なルーム',
        description: 'ルーム情報を取得できませんでした',
        isPrivate: false,
        members: 1
      });
    }
  };

  // ルームに参加する処理
  const joinRoom = async () => {
    try {
      // 既に参加済みかチェック（重複参加を防ぐ）
      const hasJoined = sessionStorage.getItem(`room-${roomId}-joined`);
      if (hasJoined) {
        console.log('Already joined this room');
        return;
      }

      // 現在の参加者数を取得してから+1
      const currentMembers = roomInfo?.members || 0;
      const newMembers = currentMembers + 1;
      
      console.log('Joining room:', { roomId, currentMembers, newMembers });

      const response = await fetch(`/api/rooms/${roomId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          members: newMembers
        }),
      });

      if (response.ok) {
        const data = await response.json();
        console.log('Join response:', data);
        setRoomInfo(data.room);
        sessionStorage.setItem(`room-${roomId}-joined`, 'true');
        console.log('Successfully joined room:', data.room);
      } else {
        console.error('Failed to join room');
      }
    } catch (error) {
      console.error('Error joining room:', error);
    }
  };

  const fetchMessages = async () => {
    try {
      const dummyMessages: Message[] = [
        {
          id: '1',
          userId: 'system',
          userName: 'システム',
          content: 'ルームに参加しました。音声通話を開始できます。',
          timestamp: new Date(Date.now() - 60000)
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

  const handleVoiceCallStateChange = (state: any) => {
    console.log('Voice call state changed:', state);
    setVoiceCallState(state);
    
    // 参加者数も更新
    if (roomInfo) {
      setRoomInfo(prev => prev ? {
        ...prev,
        members: state.participants ? state.participants.length + 1 : 1
      } : null);
    }
  };

  const handleMicTest = () => {
    // 新しいウィンドウでマイクテストページを開く
    window.open('/mic-test', '_blank', 'width=500,height=700,scrollbars=no,resizable=yes');
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

  const handleExitClick = () => {
    setShowExitConfirm(true);
  };

  const leaveRoom = async () => {
    try {
      // 参加済みの場合のみ退出処理を実行
      const hasJoined = sessionStorage.getItem(`room-${roomId}-joined`);
      if (!hasJoined) {
        console.log('Not joined this room');
        return;
      }

      if (roomInfo) {
        const currentMembers = roomInfo.members || 1;
        const newMembers = Math.max(0, currentMembers - 1);
        
        console.log('Leaving room:', { roomId, currentMembers, newMembers });

        const response = await fetch(`/api/rooms/${roomId}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            members: newMembers
          }),
        });

        if (response.ok) {
          console.log('Successfully left room');
          sessionStorage.removeItem(`room-${roomId}-joined`);
        } else {
          console.error('Failed to leave room');
        }
      }
    } catch (error) {
      console.error('Error leaving room:', error);
    }
  };

  const handleExitConfirm = () => {
    setShowExitConfirm(false);
    leaveRoom();
    router.push('/dashboard');
  };

  const handleExitCancel = () => {
    setShowExitConfirm(false);
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
              variant={showChat ? "default" : "outline"}
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
                  <div className="p-2">
                    <Button
                      onClick={handleCopyRoomId}
                      variant="outline"
                      size="sm"
                      className="w-full justify-start bg-gray-700 border-gray-600 text-gray-200 hover:bg-gray-600"
                    >
                      ルームIDをコピー
                    </Button>
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
              <div className={`w-32 h-32 rounded-full flex items-center justify-center mx-auto mb-6 ${
                voiceCallState.isConnected 
                  ? 'bg-gradient-to-br from-blue-500 to-purple-600' 
                  : 'bg-gray-700'
              }`}>
                <Mic className={`w-16 h-16 ${voiceCallState.isConnected ? 'text-white' : 'text-gray-400'}`} />
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">
                {voiceCallState.isConnected ? '音声通話中' : '接続中...'}
              </h2>
              <p className="text-gray-400 mb-6">
                {voiceCallState.isConnected 
                  ? 'マイクをクリックしてミュート/ミュート解除' 
                  : 'LiveKitサーバーに接続しています...'
                }
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
        participantName="あなた"
        onLeave={() => router.push('/dashboard')}
        onStateChange={handleVoiceCallStateChange}
      />

      {/* 退出確認ダイアログ */}
      {showExitConfirm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-xl p-6 max-w-md mx-4 border border-gray-700 shadow-2xl">
            <div className="text-center">
              <div className="w-16 h-16 bg-red-600/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <ArrowLeft className="w-8 h-8 text-red-400" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">ルームから退出しますか？</h3>
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