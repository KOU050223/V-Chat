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
  const [localAudioLevel, setLocalAudioLevel] = useState(0);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedInput, setSelectedInput] = useState<string>('');
  const [selectedOutput, setSelectedOutput] = useState<string>('');
  const [showDeviceSettings, setShowDeviceSettings] = useState(false);
  const connectionRef = useRef<boolean>(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationRef = useRef<number | null>(null);
  const localAudioTrackRef = useRef<MediaStreamTrack | null>(null);
  
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

  // デバイス一覧を取得
  useEffect(() => {
    async function fetchDevices() {
      try {
        const deviceInfos = await navigator.mediaDevices.enumerateDevices();
        setDevices(deviceInfos);
        
        // デフォルトデバイスを設定
        const defaultInput = deviceInfos.find(device => device.kind === 'audioinput');
        const defaultOutput = deviceInfos.find(device => device.kind === 'audiooutput');
        
        if (defaultInput && !selectedInput) {
          setSelectedInput(defaultInput.deviceId);
        }
        if (defaultOutput && !selectedOutput) {
          setSelectedOutput(defaultOutput.deviceId);
        }
      } catch (error) {
        console.error('Failed to enumerate devices:', error);
      }
    }
    
    fetchDevices();
  }, []);

  // デバイス変更時のハンドラー
  const handleInputChange = async (event: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedInput(event.target.value);
    
    // 入力デバイスが変更された場合、音声レベル監視を再開
    if (isConnected && room) {
      await restartAudioMonitoring();
    }
  };

  const handleOutputChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedOutput(event.target.value);
  };

  // デバイス変更時に音声レベル監視を再開
  const restartAudioMonitoring = async () => {
    if (!isConnected || !room) return;
    
    try {
      console.log('🔄 Restarting audio monitoring with new device...');
      
      // 継続的な音声レベル監視を開始
      await startContinuousAudioMonitoring();
      console.log('✅ Audio monitoring restarted with new device');
    } catch (error) {
      console.error('Failed to restart audio monitoring:', error);
    }
  };

  // シンプルな音声レベルテスト（LiveKitをバイパス）
  const testAudioLevel = async () => {
    try {
      console.log('🧪 Starting simple audio level test...');
      
      // 既存の音声レベル監視を停止
      stopAudioLevelMonitoring();
      
      const constraints = {
        audio: {
          deviceId: selectedInput ? { exact: selectedInput } : undefined,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      };
      
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      const audioTrack = stream.getAudioTracks()[0];
      
      if (audioTrack) {
        console.log('✅ Got audio track for testing');
        startAudioLevelMonitoring(audioTrack);
        
        // 5秒後にストリームを停止
        setTimeout(() => {
          stream.getTracks().forEach(track => track.stop());
          console.log('🧪 Audio level test completed');
        }, 5000);
      }
    } catch (error) {
      console.error('Failed to test audio level:', error);
    }
  };

  // 継続的な音声レベル監視（LiveKitをバイパス）
  const startContinuousAudioMonitoring = async () => {
    try {
      console.log('🎤 Starting continuous audio level monitoring...');
      
      // 既存の音声レベル監視を停止
      stopAudioLevelMonitoring();
      
      const constraints = {
        audio: {
          deviceId: selectedInput ? { exact: selectedInput } : undefined,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      };
      
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      const audioTrack = stream.getAudioTracks()[0];
      
      if (audioTrack) {
        console.log('✅ Got audio track for continuous monitoring');
        localAudioTrackRef.current = audioTrack;
        startAudioLevelMonitoring(audioTrack);
        
        // ストリームを保持（継続監視のため）
        // 注意: この方法ではLiveKitのストリームと競合する可能性があります
        console.log('⚠️ Note: Using separate stream for audio monitoring');
      }
    } catch (error) {
      console.error('Failed to start continuous audio monitoring:', error);
    }
  };

  // 重複接続を防ぐためのref
  const isConnectingRef = useRef<boolean>(false);
  const hasConnectedRef = useRef<boolean>(false);

  // 音声レベル監視関数
  const startAudioLevelMonitoring = (audioTrack: MediaStreamTrack) => {
    if (!audioTrack || audioTrack.kind !== 'audio') {
      console.warn('Invalid audio track for monitoring:', audioTrack);
      return;
    }

    try {
      console.log('🎤 Starting audio level monitoring...');
      console.log('Audio track details:', {
        id: audioTrack.id,
        kind: audioTrack.kind,
        enabled: audioTrack.enabled,
        muted: audioTrack.muted,
        readyState: audioTrack.readyState
      });
      
      // AudioContextを作成
      const audioContext = new AudioContext();
      audioContextRef.current = audioContext;

      // MediaStreamを作成
      const stream = new MediaStream([audioTrack]);
      
      // 音声分析用のノードを作成
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      
      analyserRef.current = analyser;
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0.8;
      
      // ノードを接続
      source.connect(analyser);
      
      console.log('🎤 Audio analysis setup completed');
      
      // 音声レベルを監視
      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      
      const updateAudioLevel = () => {
        if (analyserRef.current && !isMuted && isConnected) {
          analyserRef.current.getByteFrequencyData(dataArray);
          
          // より正確な音声レベル計算
          let sum = 0;
          let count = 0;
          for (let i = 0; i < dataArray.length; i++) {
            if (dataArray[i] > 0) {
              sum += dataArray[i];
              count++;
            }
          }
          const average = count > 0 ? sum / count : 0;
          
          // 音声レベルを正規化（0-100の範囲）
          const normalizedLevel = Math.min(100, (average / 255) * 100);
          
          // デバッグログ（音声レベルが高い場合のみ）
          if (normalizedLevel > 5) {
            console.log('🎤 Audio level detected:', normalizedLevel.toFixed(1));
          }
          
          setLocalAudioLevel(normalizedLevel);

          animationRef.current = requestAnimationFrame(updateAudioLevel);
        } else {
          // ミュート中または接続されていない場合は音声レベルを0に設定
          setLocalAudioLevel(0);
          
          // ミュート中でも監視を継続（ミュート解除時にすぐに反応するため）
          if (isConnected) {
            animationRef.current = requestAnimationFrame(updateAudioLevel);
          }
        }
      };
      
      updateAudioLevel();
    } catch (error) {
      console.error('音声レベル監視エラー:', error);
    }
  };

  // 音声レベル監視の停止
  const stopAudioLevelMonitoring = () => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
    
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    
    setLocalAudioLevel(0);
  };

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
          // まずマイクアクセス許可を要求（選択されたデバイスを使用）
          const constraints = {
            audio: {
              deviceId: selectedInput ? { exact: selectedInput } : undefined,
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true
            }
          };
          
          const stream = await navigator.mediaDevices.getUserMedia(constraints);
          console.log('Microphone permission granted with selected device');
          
          // ストリームを停止（LiveKitが管理するため）
          stream.getTracks().forEach(track => track.stop());
          
          // LiveKitでマイクを有効化
          await newRoom.localParticipant.setMicrophoneEnabled(true);
          console.log('Microphone enabled successfully in LiveKit');
          
          // 継続的な音声レベル監視を開始（LiveKitのトラック取得をバイパス）
          console.log('🎤 Starting continuous audio monitoring after microphone enablement...');
          setTimeout(() => {
            startContinuousAudioMonitoring();
          }, 1000);
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
            participantBaseName === myBaseName || // ベース名で比較
            p.identity?.includes(myBaseName) || // 名前が含まれている場合
            p.identity?.includes(participantName) // 完全な名前が含まれている場合
          );
          
          console.log(`Checking participant ${p.identity}: isMyself=${isMyself}`);
          console.log(`  - SID: ${p.sid} vs ${newRoom.localParticipant?.sid}`);
          console.log(`  - Identity: ${p.identity} vs ${newRoom.localParticipant?.identity}`);
          console.log(`  - Base name: ${participantBaseName} vs ${myBaseName}`);
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
      setIsConnecting(false); // 接続完了時は接続中状態を解除
    } else if (state === 'disconnected') {
      connectionRef.current = false;
      setIsConnected(false);
      setIsConnecting(false); // 切断時も接続中状態を解除
    } else if (state === 'connecting') {
      // 既に接続済みの場合は接続中状態に戻さない（新規参加者による一時的な状態変更を無視）
      if (!isConnected) {
        console.log('Setting connecting state (not yet connected)');
      setIsConnecting(true);
      } else {
        console.log('⚠️ IGNORING connecting state - already connected (new participant joined)');
      }
    } else if (state === 'reconnecting') {
      // 既に接続済みの場合は、軽微な再接続では接続中状態に戻さない
      if (!isConnected) {
        console.log('Setting reconnecting state (connection lost)');
      setIsConnecting(true);
      } else {
        console.log('⚠️ IGNORING reconnecting state - connection stable (participant event)');
      }
    }
  };

  const handleReconnecting = () => {
    console.log('Reconnecting to LiveKit...');
    // 既に接続済みの場合は、軽微な再接続でUI状態を変更しない
    if (!isConnected) {
      console.log('Setting reconnecting state');
      setIsConnecting(true);
    } else {
      console.log('⚠️ IGNORING reconnecting event - already connected');
    }
  };

  const handleReconnected = () => {
    console.log('Reconnected to LiveKit');
    // 再接続完了時は接続状態を確実に更新
    setIsConnected(true);
    setIsConnecting(false);
    connectionRef.current = true;
  };

  const disconnectFromRoom = async () => {
    console.log('🔄 DISCONNECTING FROM ROOM');
    
    // 音声レベル監視を停止
    stopAudioLevelMonitoring();
    
    if (room) {
      try {
        await room.disconnect();
        console.log('Room disconnected successfully');
      } catch (error) {
        console.error('Error disconnecting from room:', error);
      }
    }
    
    setRoom(null);
    setIsConnected(false);
    setIsConnecting(false);
    setParticipants([]);
    connectionRef.current = false;
    isConnectingRef.current = false;
    hasConnectedRef.current = false;
    
    if (onLeave) {
      onLeave();
    }
  };

  const toggleMute = async () => {
    if (room && connectionRef.current) {
      try {
        await room.localParticipant.setMicrophoneEnabled(!isMuted);
        const newMuteState = !isMuted;
        setIsMuted(newMuteState);
        
        // マイクの状態に応じて音声レベル監視を開始/停止
        if (newMuteState) {
          // ミュートになった場合、音声レベル監視を停止
          console.log('🔇 Microphone muted - stopping audio level monitoring');
          stopAudioLevelMonitoring();
        } else {
          // ミュートが解除された場合、継続的な音声レベル監視を開始
          console.log('🎤 Microphone unmuted - starting continuous audio monitoring');
          await startContinuousAudioMonitoring();
        }
        
        const actualCount = Math.max(participants.length + 1, 1);
        onStateChange?.({ 
          isConnected, 
          isMuted: newMuteState, 
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
    
    // より厳密な自分自身の除外チェック
    const isMyself = room && (
      participant.sid === room.localParticipant?.sid ||  // SIDで比較
      participant.identity === room.localParticipant?.identity || // identityで比較
      participant.identity === participantName || // 直接パラメータと比較
      participantBaseName === myBaseName || // ベース名で比較
      participant.identity?.includes(myBaseName) || // 名前が含まれている場合
      participant.identity?.includes(participantName) // 完全な名前が含まれている場合
    );
    
    console.log('Is myself check result:', isMyself);
    console.log('Exclusion checks:');
    console.log('  - SID match:', participant.sid === room?.localParticipant?.sid);
    console.log('  - Identity match:', participant.identity === room?.localParticipant?.identity);
    console.log('  - Direct name match:', participant.identity === participantName);
    console.log('  - Base name match:', participantBaseName === myBaseName);
    console.log('  - Contains base name:', participant.identity?.includes(myBaseName));
    console.log('  - Contains full name:', participant.identity?.includes(participantName));
    
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
        const actualCount = newParticipants.length + 1; // 自分を含めた正確な参加者数
        const newState = { 
          isConnected, 
          isMuted, 
          participants: newParticipants,
          actualParticipantCount: actualCount // 自分も含めた正確な参加者数
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
          
          // 音声レベル監視を停止
          stopAudioLevelMonitoring();
          
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
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-2">
                  <Users className="w-4 h-4 text-gray-400" />
                  <span className="text-gray-300 text-sm">{participants.length + 1}人参加中</span>
                </div>
                
                {/* デバイス設定ボタン */}
                <Button
                  onClick={() => setShowDeviceSettings(!showDeviceSettings)}
                  variant="outline"
                  size="sm"
                  className="bg-gray-800/50 hover:bg-gray-700/50 border-gray-600 text-gray-300"
                >
                  デバイス設定
                </Button>
              </div>
            </div>

            {/* デバイス設定パネル */}
            {showDeviceSettings && (
              <div className="mb-6 p-4 bg-gray-800/30 rounded-lg border border-gray-600/30">
                <h4 className="text-gray-300 font-semibold mb-3">音声デバイス設定</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* 入力デバイス選択 */}
                  <div className="space-y-2">
                    <label className="text-sm text-gray-400">入力デバイス（マイク）:</label>
                    <select 
                      onChange={handleInputChange} 
                      value={selectedInput}
                      className="w-full p-2 bg-gray-700 border border-gray-600 rounded text-white text-sm"
                    >
                      {devices
                        .filter(device => device.kind === 'audioinput')
                        .map(device => (
                          <option key={device.deviceId} value={device.deviceId}>
                            {device.label || `マイク ${device.deviceId.slice(0, 8)}...`}
                          </option>
                        ))}
                    </select>
                  </div>
                  
                  {/* 出力デバイス選択 */}
                  <div className="space-y-2">
                    <label className="text-sm text-gray-400">出力デバイス（スピーカー）:</label>
                    <select 
                      onChange={handleOutputChange} 
                      value={selectedOutput}
                      className="w-full p-2 bg-gray-700 border border-gray-600 rounded text-white text-sm"
                    >
                      {devices
                        .filter(device => device.kind === 'audiooutput')
                        .map(device => (
                          <option key={device.deviceId} value={device.deviceId}>
                            {device.label || `スピーカー ${device.deviceId.slice(0, 8)}...`}
                          </option>
                        ))}
                    </select>
                  </div>
                </div>
                
                {/* 音声レベルテスト */}
                <div className="mt-4 p-3 bg-gray-700/30 rounded">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-gray-300">音声レベルテスト</span>
                    <span className="text-xs text-gray-400">レベル: {localAudioLevel.toFixed(1)}%</span>
                  </div>
                  <div className="w-full bg-gray-600 rounded-full h-2">
                    <div 
                      className="bg-gradient-to-r from-green-400 to-blue-500 h-2 rounded-full transition-all duration-100"
                      style={{ width: `${localAudioLevel}%` }}
                    ></div>
                  </div>
                </div>
                
                {/* デバイス更新ボタン */}
                <div className="mt-3 flex justify-end space-x-2">
                  <Button
                    onClick={async () => {
                      try {
                        const deviceInfos = await navigator.mediaDevices.enumerateDevices();
                        setDevices(deviceInfos);
                        console.log('Devices refreshed');
                      } catch (error) {
                        console.error('Failed to refresh devices:', error);
                      }
                    }}
                    variant="outline"
                    size="sm"
                    className="bg-gray-700/50 hover:bg-gray-600/50 border-gray-500 text-gray-300"
                  >
                    デバイス一覧を更新
                  </Button>
                  
                  <Button
                    onClick={async () => {
                      if (isConnected && room) {
                        console.log('🔄 Manual audio monitoring restart...');
                        await restartAudioMonitoring();
                      } else {
                        console.log('⚠️ Cannot restart audio monitoring: not connected');
                      }
                    }}
                    variant="outline"
                    size="sm"
                    className="bg-blue-700/50 hover:bg-blue-600/50 border-blue-500 text-blue-300"
                  >
                    音声監視再開
                  </Button>
                  
                  <Button
                    onClick={testAudioLevel}
                    variant="outline"
                    size="sm"
                    className="bg-green-700/50 hover:bg-green-600/50 border-green-500 text-green-300"
                  >
                    音声テスト（5秒）
                  </Button>
                </div>
              </div>
            )}

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
                {/* デバッグ情報 */}
                <div className="col-span-full mb-2 p-2 bg-gray-800/50 rounded text-xs text-gray-400">
                  <div>参加者数: {participants.length}</div>
                  <div>参加者リスト: {participants.map(p => p.identity).join(', ')}</div>
                  <div>自分の名前: {participantName}</div>
                </div>

                {/* 自分 */}
                <div className={`bg-gradient-to-r from-blue-600/20 to-purple-600/20 backdrop-blur-sm border rounded-xl p-4 flex items-center space-x-3 transition-all duration-200 ${
                  localAudioLevel > 10 
                    ? 'border-blue-400 shadow-lg shadow-blue-500/30' 
                    : 'border-blue-500/30'
                }`}>
                  <div className={`w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center transition-all duration-200 ${
                    localAudioLevel > 20 
                      ? 'scale-110 shadow-lg shadow-blue-400/50' 
                      : 'scale-100'
                  }`}>
                    <span className="text-white font-bold text-sm">あ</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-medium text-sm truncate">あなた</p>
                    <div className="flex items-center space-x-2 mt-1">
                      <div className={`w-2 h-2 rounded-full ${isMuted ? 'bg-red-400' : 'bg-blue-400'}`}></div>
                      <span className={`text-xs ${isMuted ? 'text-red-300' : 'text-blue-300'} font-medium`}>
                        {isMuted ? 'ミュート中' : '音声オン'}
                      </span>
                      {!isMuted && localAudioLevel > 5 && (
                        <div className="flex items-center space-x-1">
                          <div className="w-1 h-1 bg-green-400 rounded-full animate-pulse"></div>
                          <span className="text-xs text-green-300">話し中</span>
                        </div>
                      )}
                    </div>
                    {/* 音声レベルバー */}
                    {!isMuted && (
                      <div className="mt-2 w-full bg-gray-700/50 rounded-full h-1">
                        <div 
                          className="bg-gradient-to-r from-green-400 to-blue-500 h-1 rounded-full transition-all duration-100"
                          style={{ width: `${localAudioLevel}%` }}
                        ></div>
                      </div>
                    )}
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