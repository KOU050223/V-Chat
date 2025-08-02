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
  serverMemberCount?: number; // サーバー側の参加者数
}

export default function VoiceCall({ roomId, participantName, onLeave, onStateChange, serverMemberCount }: VoiceCallProps) {
  const [room, setRoom] = useState<Room | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [participants, setParticipants] = useState<RemoteParticipant[]>([]);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPanel, setShowPanel] = useState(true);
  const connectionRef = useRef<boolean>(false);
  
  // 強制リセット関数
  const forceResetParticipants = () => {
    console.log('🔄 FORCE RESET: Clearing all participants');
    setParticipants([]);
  };

  // コンポーネントマウント時とroomId変更時に参加者リストをリセット
  useEffect(() => {
    console.log('🔄 Component mount/roomId change - resetting participants');
    forceResetParticipants();
  }, [roomId]);

  // 重複接続を防ぐためのref
  const isConnectingRef = useRef<boolean>(false);
  const hasConnectedRef = useRef<boolean>(false);

  const connectToRoom = async () => {
    // 既に接続処理中の場合は何もしない
    if (isConnectingRef.current) {
      console.log('⚠️ CONNECTION ALREADY IN PROGRESS - skipping');
      return;
    }
    
    // 開発環境でのHMR対応：既に接続済みの場合はスキップ
    if (process.env.NODE_ENV === 'development' && hasConnectedRef.current && room && isConnected) {
      console.log('🔧 DEV MODE: HMR DETECTED - Skipping reconnection (already connected)');
      return;
    }
    try {
      isConnectingRef.current = true;
      setIsConnecting(true);
      setError(null);
      connectionRef.current = false;
      
      // 接続開始時に参加者リストを強制リセット
      console.log('🔄 CONNECTION START: Force clearing participants');
      setParticipants([]);
      
      console.log('🔗 CONNECTING TO ROOM:', roomId);
      console.log('🌐 LiveKit URL:', process.env.NEXT_PUBLIC_LIVEKIT_URL);
      console.log('🔧 Environment:', process.env.NODE_ENV);

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
          console.log('🧹 CLEANING UP existing room connection...');
          
          // 既存の参加者をクリア（複数回実行して確実に）
          setParticipants([]);
          setIsConnected(false);
          setRoom(null);
          
          // ルームのイベントリスナーを削除
          room.removeAllListeners();
          
          // ルームを切断
          await room.disconnect();
          
          // 少し待ってからクリーンアップ完了
          await new Promise(resolve => setTimeout(resolve, 200));
          
          // 再度参加者リストをクリア（念のため）
          setParticipants([]);
          
          console.log('✅ Previous room cleaned up successfully');
        } catch (e) {
          console.warn('❌ Failed to disconnect existing room:', e);
          // エラーが発生してもリセット
          setParticipants([]);
          setIsConnected(false);
          setRoom(null);
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
        isConnectingRef.current = false; // 接続完了
        hasConnectedRef.current = true; // 接続成功フラグ
        
        // 既存の参加者を取得して初期化（自分自身のみを正確に除外）
        const allRemoteParticipants = Array.from(newRoom.remoteParticipants.values());
        
        console.log('=== INITIAL PARTICIPANT FILTER DEBUG ===');
        console.log('Local participant SID:', newRoom.localParticipant?.sid);
        console.log('Local participant identity:', newRoom.localParticipant?.identity);
        console.log('My participantName:', participantName);
        console.log('All remote participants count:', allRemoteParticipants.length);
        console.log('All remote participants:', allRemoteParticipants.map(p => ({ sid: p.sid, identity: p.identity })));
        
        // 自分の名前（タイムスタンプ部分を除く）を取得
        const myBaseName = participantName.split('-')[0];
        
        // 適切にフィルタリング（自分自身のみを除外）
        const existingParticipants = allRemoteParticipants.filter(p => {
          const participantBaseName = p.identity ? p.identity.split('-')[0] : '';
          
          const isMyself = (
            p.sid === newRoom.localParticipant?.sid ||  // SIDで比較
            p.identity === newRoom.localParticipant?.identity || // identityで比較  
            p.identity === participantName || // 直接パラメータと比較
            participantBaseName === myBaseName // ベース名で比較
          );
          
          console.log(`Checking participant ${p.identity}: isMyself=${isMyself}`);
          return !isMyself;
        });
        
        console.log('Filtered participants (excluding self):', existingParticipants.map(p => ({ sid: p.sid, identity: p.identity })));
        console.log('Server member count:', serverMemberCount);
        setParticipants(existingParticipants);
        
        const actualCount = Math.max(existingParticipants.length + 1, 1);
        const initialState = { 
          isConnected: true, 
          isMuted: false, 
          participants: existingParticipants,
          actualParticipantCount: actualCount // 自分も含めた正確な参加者数（最低1）
        };
        console.log('🔄 STATE CHANGE NOTIFICATION (initial connection):', initialState);
        onStateChange?.(initialState);
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
      isConnectingRef.current = false; // 接続失敗時もリセット
      
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
        hasConnectedRef.current = false; // 接続フラグリセット
        await room.disconnect();
        setRoom(null);
        setIsConnected(false);
        setParticipants([]);
        onLeave?.();
      } catch (error) {
        console.error('Error disconnecting from room:', error);
        // エラーが発生しても状態をリセット
        hasConnectedRef.current = false;
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
        const actualCount = Math.max(participants.length + 1, 1);
        onStateChange?.({ 
          isConnected, 
          isMuted: !isMuted, 
          participants,
          actualParticipantCount: actualCount
        });
      } catch (error) {
        console.error('Failed to toggle mute:', error);
      }
    }
  };

  const handleParticipantConnected = (participant: RemoteParticipant) => {
    console.log('=== PARTICIPANT CONNECTED DEBUG ===');
    console.log('Connected participant SID:', participant.sid);
    console.log('Connected participant identity:', participant.identity);
    console.log('Local participant SID:', room?.localParticipant?.sid);
    console.log('Local participant identity:', room?.localParticipant?.identity);
    console.log('My participantName:', participantName);
    
    // 自分の名前（タイムスタンプ部分を除く）を取得
    const myBaseName = participantName.split('-')[0];
    const participantBaseName = participant.identity ? participant.identity.split('-')[0] : '';
    
    console.log('My base name:', myBaseName);
    console.log('Participant base name:', participantBaseName);
    
    // 複数の条件で自分自身を除外（より厳密に）
    const isMyself = room && (
      participant.sid === room.localParticipant?.sid ||  // SIDで比較
      participant.identity === room.localParticipant?.identity || // identityで比較
      participant.identity === participantName || // 直接パラメータと比較
      participantBaseName === myBaseName // ベース名で比較（最も重要）
    );
    
    console.log('Is myself check result:', isMyself);
    
    if (isMyself) {
      console.log('🚫 BLOCKING self participant:', participant.identity);
      return;
    }
    
    console.log('✅ ALLOWING remote participant:', participant.identity);
    
    setParticipants(prev => {
      // より厳密な重複チェック
      const existingParticipant = prev.find(p => {
        const sameId = p.sid === participant.sid;
        const sameIdentity = p.identity === participant.identity;
        const sameBaseName = p.identity && participant.identity && 
                            p.identity.split('-')[0] === participant.identity.split('-')[0];
        
        console.log(`Duplicate check for ${participant.identity}:`);
        console.log(`  - Same SID: ${sameId}`);
        console.log(`  - Same Identity: ${sameIdentity}`);
        console.log(`  - Same Base Name: ${sameBaseName}`);
        
        return sameId || sameIdentity;
      });
      
      if (existingParticipant) {
        console.log('🚫 DUPLICATE BLOCKED: Participant already exists, skipping:', participant.identity);
        console.log('Existing:', existingParticipant.identity, 'New:', participant.identity);
        return prev;
      }
      
      const newParticipants = [...prev, participant];
      console.log('✅ PARTICIPANT ADDED:', participant.identity);
      console.log('New participants count (excluding self):', newParticipants.length);
      console.log('All participants:', newParticipants.map(p => ({ sid: p.sid, identity: p.identity })));
      
      // 非同期で状態変更を通知（Reactの状態更新競合を避ける）
      setTimeout(() => {
        const actualCount = Math.max(newParticipants.length + 1, 1);
        const newState = { 
          isConnected, 
          isMuted, 
          participants: newParticipants,
          actualParticipantCount: actualCount // 自分も含めた正確な参加者数（最低1）
        };
        console.log('🔄 STATE CHANGE NOTIFICATION (participant added):', newState);
        onStateChange?.(newState);
      }, 0);
      
      return newParticipants;
    });
  };

  const handleParticipantDisconnected = (participant: RemoteParticipant) => {
    console.log('Participant disconnected:', participant.identity, 'SID:', participant.sid);
    
    setParticipants(prev => {
      const newParticipants = prev.filter(p => p.sid !== participant.sid);
      console.log('❌ PARTICIPANT REMOVED:', participant.identity);
      console.log('Remaining participants count:', newParticipants.length);
      console.log('Remaining participants:', newParticipants.map(p => ({ sid: p.sid, identity: p.identity })));
      
      // 非同期で状態変更を通知（Reactの状態更新競合を避ける）
      setTimeout(() => {
        const actualCount = Math.max(newParticipants.length + 1, 1);
        const newState = { 
          isConnected, 
          isMuted, 
          participants: newParticipants,
          actualParticipantCount: actualCount // 自分も含めた正確な参加者数（最低1）
        };
        console.log('🔄 STATE CHANGE NOTIFICATION (participant removed):', newState);
        onStateChange?.(newState);
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
    hasConnectedRef.current = false; // 接続フラグリセット
    setIsConnected(false);
    setParticipants([]);
    onStateChange?.({ 
      isConnected: false, 
      isMuted: false, 
      participants: [],
      actualParticipantCount: 0 // 切断時は0
    });
  };

  useEffect(() => {
    let isMounted = true;
    
    const initConnection = async () => {
      if (isMounted) {
        await connectToRoom();
      }
    };
    
    initConnection();
    
    return () => {
      isMounted = false;
      // コンポーネントのアンマウント時にクリーンアップ
      if (room) {
        try {
          console.log('Cleaning up room on unmount...');
          
          // 状態をリセット
          setParticipants([]);
          setIsConnected(false);
          setIsConnecting(false);
          isConnectingRef.current = false;
          hasConnectedRef.current = false;
          
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
  }, [roomId]); // roomIdのみに依存

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
                参加者 ({Math.max(participants.length + 1, 1)})
                {serverMemberCount && serverMemberCount > 0 && serverMemberCount !== (participants.length + 1) && (
                  <span className="ml-2 text-xs text-yellow-400">(サーバー: {serverMemberCount})</span>
                )}
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
                {participants.map((participant, index) => {
                  const displayName = participant.identity ? participant.identity.split('-')[0] : `ユーザー${index + 1}`;
                  const uniqueId = participant.sid?.slice(-6) || 'unknown';
                  
                  return (
                    <div key={`participant-${participant.sid}-${index}-${participant.identity || 'unknown'}`} className="bg-gradient-to-r from-green-600/20 to-emerald-600/20 backdrop-blur-sm border border-green-500/30 rounded-xl p-4 flex items-center space-x-3">
                      <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-emerald-600 rounded-full flex items-center justify-center">
                        <span className="text-white font-bold text-sm">
                          {displayName.charAt(0)}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-white font-medium text-sm truncate">
                          {displayName}
                          {/* 同じ名前の場合は識別番号を追加 */}
                          {participants.filter(p => p.identity?.split('-')[0] === displayName).length > 1 && (
                            <span className="ml-1 text-xs text-gray-400">#{uniqueId}</span>
                          )}
                        </p>
                        <div className="flex items-center space-x-2 mt-1">
                          <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                          <span className="text-xs text-gray-300">音声オン</span>
                          {/* デバッグ情報を一時的に表示 */}
                          <span className="text-xs text-red-400">[SID: {uniqueId}]</span>
                          <span className="text-xs text-blue-400">[ID: {participant.identity}]</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
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