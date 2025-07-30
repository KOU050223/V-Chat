'use client';

import { useState, useEffect, useRef } from 'react';
import { 
  Room, 
  RoomEvent, 
  RemoteParticipant, 
  LocalParticipant,
  AudioTrack,
  RemoteAudioTrack,
  LocalTrackPublication
} from 'livekit-client';
import { Mic, MicOff, Phone, PhoneOff, Volume2, VolumeX } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface VoiceCallProps {
  roomId: string;
  participantName: string;
  onLeave?: () => void;
}

export default function VoiceCall({ roomId, participantName, onLeave }: VoiceCallProps) {
  const [room, setRoom] = useState<Room | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [participants, setParticipants] = useState<RemoteParticipant[]>([]);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const connectToRoom = async () => {
    try {
      setIsConnecting(true);
      setError(null);

      const newRoom = new Room({
        adaptiveStream: true,
        dynacast: true,
      });

      // ルームイベントの設定
      newRoom
        .on(RoomEvent.ParticipantConnected, handleParticipantConnected)
        .on(RoomEvent.ParticipantDisconnected, handleParticipantDisconnected)
        .on(RoomEvent.AudioPlaybackStatusChanged, handleAudioPlaybackStatusChanged)
        .on(RoomEvent.Disconnected, handleDisconnected);

     // 新しいコード
// アクセストークンを取得
    const tokenResponse = await fetch('/api/livekit/token', {
        method: 'POST',
        headers: {
        'Content-Type': 'application/json',
        },
        body: JSON.stringify({
        roomName: roomId,
        participantName: participantName,
        }),
    });
  
    if (!tokenResponse.ok) {
        throw new Error('Failed to get access token');
    }
  
    const { token } = await tokenResponse.json();
  
    // アクセストークンを使用して接続
    await newRoom.connect(
        process.env.NEXT_PUBLIC_LIVEKIT_URL!, 
        token
    );
      // 接続後にマイクを有効化
      try {
        await newRoom.localParticipant.setMicrophoneEnabled(true);
      } catch (micError) {
        console.warn('マイクの有効化に失敗:', micError);
      }

      setRoom(newRoom);
      setIsConnected(true);
      setIsConnecting(false);
    } catch (err) {
      console.error('Failed to connect to room:', err);
      setError('ルームへの接続に失敗しました');
      setIsConnecting(false);
    }
  };

  const disconnectFromRoom = async () => {
    if (room) {
      await room.disconnect();
      setRoom(null);
      setIsConnected(false);
      setParticipants([]);
      onLeave?.();
    }
  };

  const toggleMute = async () => {
    if (room) {
      try {
        if (isMuted) {
          await room.localParticipant.setMicrophoneEnabled(true);
        } else {
          await room.localParticipant.setMicrophoneEnabled(false);
        }
        setIsMuted(!isMuted);
      } catch (error) {
        console.error('マイクの切り替えに失敗:', error);
      }
    }
  };

  const handleParticipantConnected = (participant: RemoteParticipant) => {
    setParticipants(prev => [...prev, participant]);
  };

  const handleParticipantDisconnected = (participant: RemoteParticipant) => {
    setParticipants(prev => prev.filter(p => p.sid !== participant.sid));
  };

  const handleAudioPlaybackStatusChanged = (playing: boolean) => {
    console.log('Audio playback status:', playing);
  };

  const handleDisconnected = () => {
    setIsConnected(false);
    setParticipants([]);
  };

  useEffect(() => {
    // コンポーネントマウント時に自動接続
    connectToRoom();

    return () => {
      if (room) {
        room.disconnect();
      }
    };
  }, [roomId]);

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center">
        <p className="text-red-600 mb-4">{error}</p>
        <Button onClick={connectToRoom} className="bg-red-600 hover:bg-red-700">
          再接続
        </Button>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <div className="text-center mb-6">
        <h3 className="text-xl font-bold text-gray-800 mb-2">音声通話</h3>
        <p className="text-gray-600">ルーム: {roomId}</p>
        {isConnecting && (
          <div className="mt-2">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-purple-500 mx-auto"></div>
            <p className="text-sm text-gray-500 mt-2">接続中...</p>
          </div>
        )}
      </div>

      {/* 参加者一覧 */}
      <div className="mb-6">
        <h4 className="font-semibold text-gray-700 mb-3">参加者 ({participants.length + 1})</h4>
        <div className="space-y-2">
          <div className="flex items-center space-x-3 p-3 bg-purple-50 rounded-lg">
            <div className="w-8 h-8 bg-gradient-to-r from-purple-400 to-pink-400 rounded-full flex items-center justify-center text-white font-bold">
              {participantName.charAt(0)}
            </div>
            <div className="flex-1">
              <p className="font-medium text-gray-800">{participantName} (あなた)</p>
              <p className="text-sm text-gray-500">
                {isMuted ? 'ミュート中' : '音声オン'}
              </p>
            </div>
            {isMuted && <MicOff className="w-4 h-4 text-red-500" />}
          </div>
          
          {participants.map((participant) => (
            <div key={participant.sid} className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
              <div className="w-8 h-8 bg-gradient-to-r from-blue-400 to-green-400 rounded-full flex items-center justify-center text-white font-bold">
                {participant.identity.charAt(0)}
              </div>
              <div className="flex-1">
                <p className="font-medium text-gray-800">{participant.identity}</p>
                <p className="text-sm text-gray-500">音声オン</p>
              </div>
              <Volume2 className="w-4 h-4 text-green-500" />
            </div>
          ))}
        </div>
      </div>

      {/* コントロールボタン */}
      <div className="flex justify-center space-x-4">
        <Button
          onClick={toggleMute}
          disabled={!isConnected}
          variant={isMuted ? "destructive" : "default"}
          className="w-16 h-16 rounded-full"
        >
          {isMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
        </Button>
        
        <Button
          onClick={disconnectFromRoom}
          disabled={!isConnected}
          variant="destructive"
          className="w-16 h-16 rounded-full bg-red-500 hover:bg-red-600"
        >
          <PhoneOff className="w-6 h-6" />
        </Button>
      </div>

      {/* 接続状態 */}
      <div className="mt-4 text-center">
        <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm ${
          isConnected 
            ? 'bg-green-100 text-green-800' 
            : 'bg-gray-100 text-gray-800'
        }`}>
          <div className={`w-2 h-2 rounded-full mr-2 ${
            isConnected ? 'bg-green-500' : 'bg-gray-400'
          }`}></div>
          {isConnected ? '接続中' : '未接続'}
        </div>
      </div>
    </div>
  );
}