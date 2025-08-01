'use client';

import { useState, useEffect, useRef } from 'react';
import { Room, RoomEvent, RemoteParticipant } from 'livekit-client';
import { Mic, MicOff, Users, Signal, ChevronUp, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface VoiceCallProps {
  roomId: string;
  participantName: string;
  onLeave?: () => void;
  onStateChange?: (state: any) => void;
}

export default function VoiceCall({ roomId, participantName, onLeave, onStateChange }: VoiceCallProps) {
  const [room, setRoom] = useState<Room | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [participants, setParticipants] = useState<RemoteParticipant[]>([]);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPanel, setShowPanel] = useState(true);
  const connectionRef = useRef<boolean>(false);

  const connectToRoom = async () => {
    try {
      setIsConnecting(true);
      setError(null);
      connectionRef.current = false;
      
      console.log('Connecting to room:', roomId);
      console.log('LiveKit URL:', process.env.NEXT_PUBLIC_LIVEKIT_URL);

      // より確実にユニークな参加者名を生成（タイムスタンプ + ランダム + セッション）
      const timestamp = Date.now();
      const random = Math.random().toString(36).substr(2, 9);
      const sessionId = Math.random().toString(36).substr(2, 6);
      const uniqueParticipantName = `${participantName}-${timestamp}-${random}-${sessionId}`;
      console.log('Unique participant name:', uniqueParticipantName);

      // Get access token from API
      const tokenResponse = await fetch('/api/livekit/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomName: roomId, participantName: uniqueParticipantName }),
      });
      console.log('Token API Response Status:', tokenResponse.status);
      const tokenData = await tokenResponse.json();
      console.log('Token API Response Data:', tokenData);

      if (!tokenResponse.ok) {
        throw new Error(`Failed to get access token: ${tokenData.error || tokenResponse.statusText}`);
      }
      const { token } = tokenData;
      console.log('Extracted Token:', token);
      console.log('Type of Extracted Token:', typeof token);
      if (typeof token !== 'string') {
        throw new Error('LiveKit access token is not a string. Check API response.');
      }

      // 既存のルームがあれば完全にクリーンアップ
      if (room) {
        try {
          console.log('Cleaning up existing room connection...');
          
          // 既存の参加者をクリア
          setParticipants([]);
          setIsConnected(false);
          
          // ルームのイベントリスナーを削除
          room.removeAllListeners();
          
          // ルームを切断
          await room.disconnect();
          
          // 少し待ってからクリーンアップ完了
          await new Promise(resolve => setTimeout(resolve, 100));
          
          console.log('Previous room cleaned up successfully');
        } catch (e) {
          console.warn('Failed to disconnect existing room:', e);
        }
      }

      const newRoom = new Room({
        adaptiveStream: true,
        dynacast: true,
        publishDefaults: { 
          simulcast: false,
          videoSimulcastLayers: [],
          dtx: false
        },
        // DataChannelエラーを防ぐための設定
        disconnectOnPageLeave: true
      });

      // イベントリスナーを設定
      newRoom
        .on(RoomEvent.ParticipantConnected, handleParticipantConnected)
        .on(RoomEvent.ParticipantDisconnected, handleParticipantDisconnected)
        .on(RoomEvent.AudioPlaybackStatusChanged, handleAudioPlaybackStatusChanged)
        .on(RoomEvent.Disconnected, handleDisconnected)
        .on(RoomEvent.ConnectionStateChanged, handleConnectionStateChanged)
        .on(RoomEvent.Reconnecting, handleReconnecting)
        .on(RoomEvent.Reconnected, handleReconnected);

      console.log('Connecting to LiveKit with token...');
      console.log('LiveKit URL:', process.env.NEXT_PUBLIC_LIVEKIT_URL);
      
      try {
        const livekitUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL;
        
        if (!livekitUrl) {
          throw new Error('LiveKit URL is not configured. Please set NEXT_PUBLIC_LIVEKIT_URL in your .env.local file');
        }
        
        await newRoom.connect(livekitUrl, token, {
          autoSubscribe: true
        });
        
        console.log('Successfully connected to LiveKit');
        
        // 接続が成功したと仮定して処理を続行
        connectionRef.current = true;
        
        try {
          // まずマイクアクセス許可を要求
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          console.log('Microphone permission granted');
          
          // ストリームを停止（LiveKitが管理するため）
          stream.getTracks().forEach(track => track.stop());
          
          // LiveKitでマイクを有効化
          await newRoom.localParticipant.setMicrophoneEnabled(true);
          console.log('Microphone enabled successfully in LiveKit');
        } catch (micError) {
          console.warn('マイクの有効化に失敗:', micError);
          
          let errorMessage = 'マイクの有効化に失敗しました。';
          if (micError instanceof Error) {
            if (micError.name === 'NotAllowedError') {
              errorMessage = 'マイクのアクセスが拒否されました。ブラウザの設定でマイクアクセスを許可してください。';
            } else if (micError.name === 'NotFoundError') {
              errorMessage = 'マイクが見つかりません。マイクが接続されていることを確認してください。';
            } else {
              errorMessage = `マイクエラー: ${micError.message}`;
            }
          }
          
          setError(errorMessage);
          // マイクエラーでも接続は続行（音声なしでも参加可能）
        }

        setRoom(newRoom);
        setIsConnected(true);
        setIsConnecting(false);
        
        // 既存の参加者を取得して初期化（自分自身は除外）
        const existingParticipants = Array.from(newRoom.remoteParticipants.values())
          .filter(p => p.sid !== newRoom.localParticipant?.sid);
        console.log('Existing participants on connect (excluding self):', existingParticipants.length);
        setParticipants(existingParticipants);
        
        onStateChange?.({ isConnected: true, isMuted: false, participants: existingParticipants });
      } catch (connectError) {
        console.error('Connection failed:', connectError);
        throw connectError;
      }

    } catch (err) {
      console.error('Failed to connect to room:', err);
      
      // 開発環境での接続エラーをより分かりやすく表示
      let errorMessage = 'LiveKit接続に失敗しました';
      
      if (err instanceof Error) {
        if (err.message.includes('could not establish pc connection')) {
          errorMessage = 'LiveKitサーバーに接続できません。環境変数を確認してください。';
        } else if (err.message.includes('LiveKit URL is not configured')) {
          errorMessage = 'LiveKit URLが設定されていません。.env.localファイルでNEXT_PUBLIC_LIVEKIT_URLを設定してください。';
        } else {
          errorMessage = `接続エラー: ${err.message}`;
        }
      }
      
      setError(errorMessage);
      setIsConnecting(false);
      connectionRef.current = false;
      
      // 開発環境では接続失敗でも画面表示を続行
      if (process.env.NODE_ENV === 'development') {
        console.warn('開発環境: LiveKit接続失敗ですが、画面表示を続行します');
        setIsConnected(false); // 実際には接続されていない状態
        onStateChange?.({ isConnected: false, isMuted: false, participants: [] });
      }
    }
  };

  const handleConnectionStateChanged = (state: any) => {
    console.log('Connection state changed:', state);
    if (state === 'connected') {
      connectionRef.current = true;
      setIsConnected(true);
    } else if (state === 'disconnected') {
      connectionRef.current = false;
      setIsConnected(false);
    } else if (state === 'connecting') {
      setIsConnecting(true);
    } else if (state === 'reconnecting') {
      setIsConnecting(true);
    }
  };

  const handleReconnecting = () => {
    console.log('Reconnecting to LiveKit...');
  };

  const handleReconnected = () => {
    console.log('Reconnected to LiveKit');
  };

  const disconnectFromRoom = async () => {
    if (room) {
      try {
        connectionRef.current = false;
        await room.disconnect();
        setRoom(null);
        setIsConnected(false);
        setParticipants([]);
        onLeave?.();
      } catch (error) {
        console.error('Error disconnecting from room:', error);
        // エラーが発生しても状態をリセット
        setRoom(null);
        setIsConnected(false);
        setParticipants([]);
        onLeave?.();
      }
    }
  };

  const toggleMute = async () => {
    if (room && connectionRef.current) {
      try {
        await room.localParticipant.setMicrophoneEnabled(!isMuted);
        setIsMuted(!isMuted);
        onStateChange?.({ isConnected, isMuted: !isMuted, participants });
      } catch (error) {
        console.error('Failed to toggle mute:', error);
      }
    }
  };

  const handleParticipantConnected = (participant: RemoteParticipant) => {
    console.log('Participant connected:', participant.identity, 'SID:', participant.sid);
    console.log('Current room local participant SID:', room?.localParticipant?.sid);
    
    // 自分自身は参加者リストに含めない
    if (room && participant.sid === room.localParticipant?.sid) {
      console.log('Skipping local participant (yourself)');
      return;
    }
    
    setParticipants(prev => {
      // 既に存在する参加者は追加しない（重複防止）
      const existingParticipant = prev.find(p => p.sid === participant.sid);
      if (existingParticipant) {
        console.log('Participant already exists, skipping:', participant.identity);
        return prev;
      }
      
      const newParticipants = [...prev, participant];
      console.log('New participants count (excluding self):', newParticipants.length);
      
      // 非同期で状態変更を通知（Reactの状態更新競合を避ける）
      setTimeout(() => {
        onStateChange?.({ isConnected, isMuted, participants: newParticipants });
      }, 0);
      
      return newParticipants;
    });
  };

  const handleParticipantDisconnected = (participant: RemoteParticipant) => {
    console.log('Participant disconnected:', participant.identity, 'SID:', participant.sid);
    
    setParticipants(prev => {
      const newParticipants = prev.filter(p => p.sid !== participant.sid);
      console.log('Remaining participants count:', newParticipants.length);
      
      // 非同期で状態変更を通知（Reactの状態更新競合を避ける）
      setTimeout(() => {
        onStateChange?.({ isConnected, isMuted, participants: newParticipants });
      }, 0);
      
      return newParticipants;
    });
  };

  const handleAudioPlaybackStatusChanged = (playing: boolean) => {
    console.log('Audio playback status changed:', playing);
  };

  const handleDisconnected = () => {
    console.log('Disconnected from room');
    connectionRef.current = false;
    setIsConnected(false);
    setParticipants([]);
    onStateChange?.({ isConnected: false, isMuted: false, participants: [] });
  };

  useEffect(() => {
    connectToRoom();
    return () => {
      // コンポーネントのアンマウント時にクリーンアップ
      if (room) {
        try {
          console.log('Cleaning up room on unmount...');
          
          // 状態をリセット
          setParticipants([]);
          setIsConnected(false);
          setIsConnecting(false);
          
          // イベントリスナーを全て削除
          room.removeAllListeners();
          
          // ルームを切断
          room.disconnect();
          
          console.log('Room cleanup completed on unmount');
        } catch (error) {
          console.warn('Error during cleanup:', error);
        }
      }
    };
  }, [roomId]);

  if (error) {
    return (
      <div className="fixed bottom-0 left-0 right-0 bg-red-900/90 backdrop-blur-sm border-t border-red-700 p-4">
        <div className="max-w-md mx-auto text-center">
          <p className="text-red-200 text-sm">{error}</p>
          <Button 
            onClick={connectToRoom} 
            size="sm" 
            className="mt-2 bg-red-700 hover:bg-red-600"
          >
            再接続
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed bottom-0 left-0 right-0">
      {/* パネル表示/非表示切り替えボタン */}
      <div className="flex justify-center mb-2">
        <Button
          onClick={() => setShowPanel(!showPanel)}
          variant="outline"
          size="sm"
          className="bg-gray-800/80 hover:bg-gray-700/80 border-gray-600 text-gray-300 backdrop-blur-sm"
        >
          {showPanel ? (
            <>
              <ChevronDown className="w-4 h-4 mr-1" />
              パネルを隠す
            </>
          ) : (
            <>
              <ChevronUp className="w-4 h-4 mr-1" />
              パネルを表示
            </>
          )}
        </Button>
      </div>

      {/* パネル部分（表示/非表示切り替え可能） */}
      {showPanel && (
        <div className="bg-gradient-to-t from-gray-900 via-gray-800/95 to-gray-900/80 backdrop-blur-xl border-t border-gray-700/50 shadow-2xl">
          <div className="max-w-4xl mx-auto p-6">
            {/* ヘッダー部分 */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse"></div>
                  <span className="text-green-400 text-sm font-medium">音声通話</span>
                </div>
                <div className="text-gray-400 text-sm">
                  ルーム: <span className="font-mono text-gray-300">{roomId}</span>
                </div>
              </div>
                                        <div className="flex items-center space-x-2">
                            <Users className="w-4 h-4 text-gray-400" />
                            <span className="text-gray-300 text-sm">{participants.length + 1}人参加中</span>
                          </div>
            </div>

            {/* 参加者リスト */}
            <div className="mb-6">
              <h3 className="text-gray-300 font-semibold mb-3 flex items-center">
                <Signal className="w-4 h-4 mr-2 text-blue-400" />
                参加者 ({participants.length + 1})
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {/* 自分 */}
                <div className="bg-gradient-to-r from-blue-600/20 to-purple-600/20 backdrop-blur-sm border border-blue-500/30 rounded-xl p-4 flex items-center space-x-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                    <span className="text-white font-bold text-sm">あ</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-medium text-sm truncate">あなた</p>
                    <div className="flex items-center space-x-2 mt-1">
                      <div className={`w-2 h-2 rounded-full ${isMuted ? 'bg-red-400' : 'bg-blue-400'}`}></div>
                      <span className={`text-xs ${isMuted ? 'text-red-300' : 'text-blue-300'} font-medium`}>
                        {isMuted ? 'ミュート中' : '音声オン'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* 他の参加者 */}
                {participants.map((participant, index) => (
                  <div key={`participant-${participant.sid}-${index}-${participant.identity || 'unknown'}`} className="bg-gradient-to-r from-green-600/20 to-emerald-600/20 backdrop-blur-sm border border-green-500/30 rounded-xl p-4 flex items-center space-x-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-emerald-600 rounded-full flex items-center justify-center">
                      <span className="text-white font-bold text-sm">
                        {participant.identity ? participant.identity.charAt(0) : 'ユ'}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-medium text-sm truncate">
                        {participant.identity || `ユーザー${index + 1}`}
                      </p>
                      <div className="flex items-center space-x-2 mt-1">
                        <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                        <span className="text-xs text-gray-300">音声オン</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* コントロールボタン（常に表示） */}
      <div className="bg-gradient-to-t from-gray-900/90 to-gray-900/70 backdrop-blur-sm border-t border-gray-700/50">
        <div className="max-w-4xl mx-auto p-4">
          <div className="flex justify-center items-center">
            <Button
              onClick={toggleMute}
              variant={isMuted ? "destructive" : "outline"}
              size="lg"
              disabled={!isConnected}
              className={`w-16 h-16 rounded-full transition-all duration-300 ${
                isMuted 
                  ? 'bg-red-600 hover:bg-red-700 border-red-600 shadow-lg' 
                  : 'bg-gradient-to-r from-blue-600/80 to-blue-700/80 hover:from-blue-600 hover:to-blue-700 border-blue-500/50 shadow-md'
              }`}
            >
              {isMuted ? (
                <div className="flex flex-col items-center">
                  <MicOff className="w-6 h-6 mb-1" />
                  <div className="w-1 h-1 bg-red-200 rounded-full"></div>
                </div>
              ) : (
                <div className="flex flex-col items-center">
                  <Mic className="w-6 h-6 mb-1" />
                  <div className="w-1 h-1 bg-blue-300 rounded-full"></div>
                </div>
              )}
            </Button>
          </div>

          {/* 接続状態 */}
          <div className="mt-3 text-center">
            <div className="inline-flex items-center px-4 py-2 rounded-full bg-gray-800/50 backdrop-blur-sm border border-gray-600/50">
              <div className={`w-2 h-2 rounded-full mr-2 ${isConnected ? 'bg-green-400 animate-pulse' : 'bg-yellow-400 animate-pulse'}`}></div>
              <span className="text-sm text-gray-300">
                {isConnected ? '接続済み' : '接続中...'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}