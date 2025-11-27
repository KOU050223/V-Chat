'use client';

import { useState, useEffect, useRef } from 'react';
import {
  Room,
  RoomEvent,
  RemoteParticipant,
  ConnectionState,
} from 'livekit-client';
import {
  Mic,
  MicOff,
  Users,
  Signal,
  ChevronUp,
  ChevronDown,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { app } from '@/lib/firebaseConfig';
import { handleFirebaseFunctionError } from '@/lib/utils';
import type { VoiceCallState } from '@/types/voice';

// setSinkIdメソッドを持つオーディオトラックの型定義
interface AudioTrackWithSinkId {
  setSinkId(deviceId: string): Promise<void>;
}

interface VoiceCallProps {
  roomId: string;
  participantName: string;
  onLeave?: () => void;
  onStateChange?: (state: VoiceCallState) => void;
  serverMemberCount?: number; // サーバー側の参加者数
}

export default function VoiceCall({
  roomId,
  participantName,
  onLeave,
  onStateChange,
  serverMemberCount,
}: VoiceCallProps) {
  const [room, setRoom] = useState<Room | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [participants, setParticipants] = useState<RemoteParticipant[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPanel, setShowPanel] = useState(true);
  const [localAudioLevel, setLocalAudioLevel] = useState(0);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedInput, setSelectedInput] = useState<string>('');
  const [selectedOutput, setSelectedOutput] = useState<string>('');
  const [showDeviceSettings, setShowDeviceSettings] = useState(false);
  const [isAudioMonitoringActive, setIsAudioMonitoringActive] = useState(false);
  const connectionRef = useRef<boolean>(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationRef = useRef<number | null>(null);
  const localAudioTrackRef = useRef<MediaStreamTrack | null>(null);

  // 強制リセット関数
  const forceResetParticipants = () => {
    setParticipants([]);
  };

  // コンポーネントマウント時とroomId変更時に参加者リストをリセット
  useEffect(() => {
    forceResetParticipants();
  }, [roomId]);

  // デバイス一覧を取得
  useEffect(() => {
    async function fetchDevices() {
      try {
        const deviceInfos = await navigator.mediaDevices.enumerateDevices();
        setDevices(deviceInfos);

        // デフォルトデバイスを設定
        const defaultInput = deviceInfos.find(
          (device) => device.kind === 'audioinput'
        );
        const defaultOutput = deviceInfos.find(
          (device) => device.kind === 'audiooutput'
        );

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // デバイス変更時のハンドラー
  const handleInputChange = async (
    event: React.ChangeEvent<HTMLSelectElement>
  ) => {
    setSelectedInput(event.target.value);

    // 入力デバイスが変更された場合、音声レベル監視を再開
    if (isConnected && room) {
      await restartAudioMonitoring();
    }
  };

  const handleOutputChange = async (
    event: React.ChangeEvent<HTMLSelectElement>
  ) => {
    const newOutputDevice = event.target.value;
    setSelectedOutput(newOutputDevice);

    // 全ての参加者のオーディオトラックに出力デバイスを適用
    if (room && newOutputDevice) {
      // setSinkIdのサポートチェック
      const testAudio = new Audio();
      if (typeof testAudio.setSinkId !== 'function') {
        const errorMsg =
          'このブラウザは出力デバイスの選択をサポートしていません。デフォルトのスピーカーが使用されます。';
        console.warn(errorMsg);
        setError(errorMsg);
        setTimeout(() => setError(null), 5000);
        return;
      }

      try {
        let successCount = 0;
        let failCount = 0;

        // リモート参加者のオーディオトラックに適用
        for (const participant of participants) {
          // 各参加者のオーディオトラックパブリケーションを取得
          const promises = Array.from(
            participant.audioTrackPublications.values()
          ).map(async (publication) => {
            if (publication.audioTrack) {
              try {
                // LiveKitのRemoteAudioTrack.setSinkId()を使用
                await (
                  publication.audioTrack as unknown as AudioTrackWithSinkId
                ).setSinkId(newOutputDevice);
                successCount++;
              } catch (err) {
                failCount++;
                console.warn(
                  `Failed to set sink ID for participant ${participant.identity}:`,
                  err
                );
              }
            }
          });

          await Promise.all(promises);
        }

        console.log(
          `Output device changed to: ${newOutputDevice} (${successCount} succeeded, ${failCount} failed)`
        );

        if (failCount > 0) {
          const errorMsg = `一部の参加者の出力デバイス変更に失敗しました (${failCount}/${successCount + failCount})`;
          setError(errorMsg);
          setTimeout(() => setError(null), 5000);
        }
      } catch (error) {
        console.error('Failed to change output device:', error);
        const errorMsg =
          '出力デバイスの変更に失敗しました。デフォルトのスピーカーが使用されます。';
        setError(errorMsg);
        setTimeout(() => setError(null), 5000);
      }
    }
  };

  // デバイス変更時に音声レベル監視を再開
  const restartAudioMonitoring = async () => {
    if (!isConnected || !room) return;

    try {
      // 継続的な音声レベル監視を開始
      await startContinuousAudioMonitoring();
    } catch (error) {
      console.error('Failed to restart audio monitoring:', error);
    }
  };

  // シンプルな音声レベルテスト（LiveKitをバイパス）
  const testAudioLevel = async () => {
    try {
      // 既存の音声レベル監視を停止
      stopAudioLevelMonitoring();

      const constraints = {
        audio: {
          deviceId: selectedInput ? { exact: selectedInput } : undefined,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      const audioTrack = stream.getAudioTracks()[0];

      if (audioTrack) {
        startAudioLevelMonitoring(audioTrack);

        // 5秒後にストリームと監視を停止
        setTimeout(() => {
          stream.getTracks().forEach((track) => track.stop());
          stopAudioLevelMonitoring();
        }, 5000);
      }
    } catch (error) {
      console.error('Failed to test audio level:', error);
    }
  };

  // 継続的な音声レベル監視（独立したストリームを使用）
  const startContinuousAudioMonitoring = async () => {
    try {
      // 既存の監視を停止
      stopAudioLevelMonitoring();

      // 既存のAudioContextがある場合は再利用
      let audioContext = audioContextRef.current;
      if (!audioContext || audioContext.state === 'closed') {
        audioContext = new AudioContext();
        audioContextRef.current = audioContext;
      }

      // 独立したストリームを作成（音声レベル監視専用）
      const constraints = {
        audio: {
          deviceId: selectedInput ? { exact: selectedInput } : undefined,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      const audioTrack = stream.getAudioTracks()[0];

      if (!audioTrack) {
        throw new Error('No audio track available for monitoring');
      }

      localAudioTrackRef.current = audioTrack;

      // MediaStreamを作成
      const mediaStream = new MediaStream([audioTrack]);

      // 音声分析用のノードを作成
      const source = audioContext.createMediaStreamSource(mediaStream);
      const analyser = audioContext.createAnalyser();

      analyserRef.current = analyser;
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0.8;

      // ノードを接続
      source.connect(analyser);

      // 音声レベル監視を開始
      startAudioLevelMonitoringLoop();

      setIsAudioMonitoringActive(true);
    } catch (error) {
      console.error('Failed to start continuous audio monitoring:', error);
      setIsAudioMonitoringActive(false);
      // エラーが発生しても通話には影響しない
    }
  };

  // 重複接続を防ぐためのref
  const isConnectingRef = useRef<boolean>(false);
  const hasConnectedRef = useRef<boolean>(false);

  // 音声レベル監視ループ（修正版）
  const startAudioLevelMonitoringLoop = () => {
    if (!analyserRef.current) {
      return;
    }

    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);

    const updateAudioLevel = () => {
      if (!analyserRef.current) {
        setLocalAudioLevel(0);
        return;
      }

      // ローカルのミュート状態のみを確認（LiveKitの状態は信頼しない）
      if (isMuted) {
        // ミュートされている場合は音声レベルを0に設定
        setLocalAudioLevel(0);
      } else {
        // ミュートされていない場合のみ音声レベルを計算
        analyserRef.current.getByteFrequencyData(dataArray);

        // 音声レベル計算
        let sum = 0;
        let count = 0;
        for (let i = 0; i < dataArray.length; i++) {
          if (dataArray[i] > 0) {
            sum += dataArray[i];
            count++;
          }
        }
        const average = count > 0 ? sum / count : 0;
        const normalizedLevel = Math.min(100, (average / 255) * 100);
        setLocalAudioLevel(normalizedLevel);
      }

      // 監視を継続
      animationRef.current = requestAnimationFrame(updateAudioLevel);
    };

    updateAudioLevel();
  };

  // 音声レベル監視関数（簡素化版）
  const startAudioLevelMonitoring = (audioTrack: MediaStreamTrack) => {
    if (!audioTrack || audioTrack.kind !== 'audio') {
      return;
    }

    try {
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

      // 新しいループ関数を使用
      startAudioLevelMonitoringLoop();
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

    if (localAudioTrackRef.current) {
      localAudioTrackRef.current.stop();
      localAudioTrackRef.current = null;
    }

    setLocalAudioLevel(0);
    setIsAudioMonitoringActive(false);
  };

  const connectToRoom = async () => {
    // 既に接続処理中の場合は何もしない
    if (isConnectingRef.current) {
      return;
    }

    // 開発環境でのHMR対応：既に接続済みの場合はスキップ
    if (
      process.env.NODE_ENV === 'development' &&
      hasConnectedRef.current &&
      room &&
      isConnected
    ) {
      return;
    }
    try {
      isConnectingRef.current = true;
      setIsConnecting(true);
      setError(null);
      connectionRef.current = false;

      // 接続開始時に参加者リストを強制リセット
      setParticipants([]);

      // 参加者名をそのまま使用（タイムスタンプは追加しない）
      // これにより、ルーム作成者と参加者で同じ表示名が使用される

      // Get access token from Cloud Functions
      const functions = getFunctions(app, 'us-central1');
      const generateToken = httpsCallable(functions, 'generateLivekitToken');

      let token: string;
      try {
        const result = await generateToken({ roomId });
        const tokenData = result.data as {
          token: string;
          livekitRoomId: string;
        };
        token = tokenData.token;

        if (typeof token !== 'string') {
          throw new Error(
            'LiveKit access token is not a string. Check Cloud Functions response.'
          );
        }

        console.log('Successfully obtained token from Cloud Functions');
        console.log('LiveKit Room ID:', tokenData.livekitRoomId);
      } catch (tokenError: unknown) {
        const errorMessage = handleFirebaseFunctionError(
          'トークン取得エラー',
          tokenError,
          'トークンの取得に失敗しました'
        );
        throw new Error(errorMessage);
      }

      // 既存のルームがあれば完全にクリーンアップ
      if (room) {
        try {
          // 既存の参加者をクリア（複数回実行して確実に）
          setParticipants([]);
          setIsConnected(false);
          setRoom(null);

          // ルームのイベントリスナーを削除
          room.removeAllListeners();

          // ルームを切断
          await room.disconnect();

          // 少し待ってからクリーンアップ完了
          await new Promise((resolve) => setTimeout(resolve, 200));

          // 再度参加者リストをクリア（念のため）
          setParticipants([]);
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
        } catch (e) {
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
          dtx: false,
        },
        // DataChannelエラーを防ぐための設定
        disconnectOnPageLeave: true,
      });

      // イベントリスナーを設定（roomインスタンスを明示的に渡す）
      newRoom
        .on(RoomEvent.ParticipantConnected, (participant) =>
          handleParticipantConnected(newRoom, participant)
        )
        .on(RoomEvent.ParticipantDisconnected, handleParticipantDisconnected)
        .on(
          RoomEvent.AudioPlaybackStatusChanged,
          handleAudioPlaybackStatusChanged
        )
        .on(RoomEvent.Disconnected, handleDisconnected)
        .on(RoomEvent.ConnectionStateChanged, handleConnectionStateChanged)
        .on(RoomEvent.Reconnecting, handleReconnecting)
        .on(RoomEvent.Reconnected, handleReconnected);

      try {
        const livekitUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL;

        if (!livekitUrl) {
          throw new Error(
            'LiveKit URL is not configured. Please set NEXT_PUBLIC_LIVEKIT_URL in your .env.local file'
          );
        }

        await newRoom.connect(livekitUrl, token, {
          autoSubscribe: true,
        });

        // 接続が成功したと仮定して処理を続行
        connectionRef.current = true;

        try {
          // まずマイクアクセス許可を要求（選択されたデバイスを使用）
          const constraints = {
            audio: {
              deviceId: selectedInput ? { exact: selectedInput } : undefined,
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true,
            },
          };

          const stream = await navigator.mediaDevices.getUserMedia(constraints);
          console.log('Microphone permission granted with selected device');

          // ストリームを停止（LiveKitが管理するため）
          stream.getTracks().forEach((track) => track.stop());

          // LiveKitでマイクを有効化
          await newRoom.localParticipant.setMicrophoneEnabled(true);

          // 継続的な音声レベル監視を開始（LiveKitトラックを使用）
          try {
            await startContinuousAudioMonitoring();
          } catch (error) {
            console.error(
              'Failed to start audio monitoring on connection:',
              error
            );
            // 接続時のエラーは致命的ではないので、接続は続行
          }
        } catch (micError) {
          console.warn('マイクの有効化に失敗:', micError);

          let errorMessage = 'マイクの有効化に失敗しました。';
          if (micError instanceof Error) {
            if (micError.name === 'NotAllowedError') {
              errorMessage =
                'マイクのアクセスが拒否されました。ブラウザの設定でマイクアクセスを許可してください。';
            } else if (micError.name === 'NotFoundError') {
              errorMessage =
                'マイクが見つかりません。マイクが接続されていることを確認してください。';
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
        const allRemoteParticipants = Array.from(
          newRoom.remoteParticipants.values()
        );

        console.log('=== INITIAL PARTICIPANT FILTER DEBUG ===');
        console.log('Local participant SID:', newRoom.localParticipant?.sid);
        console.log(
          'Local participant identity:',
          newRoom.localParticipant?.identity
        );
        console.log('My participantName:', participantName);
        console.log('Room ID:', roomId);
        console.log(
          'All remote participants count:',
          allRemoteParticipants.length
        );
        console.log(
          'All remote participants:',
          allRemoteParticipants.map((p) => ({
            sid: p.sid,
            identity: p.identity,
          }))
        );

        // 適切にフィルタリング（自分自身のみを厳密に除外）
        // NOTE: SID と identity の厳密一致のみで自己判定します。
        const existingParticipants = allRemoteParticipants.filter((p) => {
          const isMyself =
            p.sid === newRoom.localParticipant?.sid ||
            p.identity === newRoom.localParticipant?.identity ||
            p.identity === participantName; // 直接指定した名前と完全一致する場合も除外

          console.log(
            `Checking participant ${p.identity}: isMyself=${isMyself}`
          );
          console.log(`  - SID: ${p.sid} vs ${newRoom.localParticipant?.sid}`);
          console.log(
            `  - Identity: ${p.identity} vs ${newRoom.localParticipant?.identity}`
          );

          return !isMyself;
        });

        console.log(
          'Filtered participants (excluding self):',
          existingParticipants.map((p) => ({
            sid: p.sid,
            identity: p.identity,
          }))
        );
        console.log('Server member count:', serverMemberCount);
        setParticipants(existingParticipants);

        // 既存の参加者に出力デバイスを適用
        if (selectedOutput && existingParticipants.length > 0) {
          console.log('Applying output device to existing participants...');
          for (const participant of existingParticipants) {
            await applyOutputDeviceToParticipant(participant);
          }
        }

        const actualCount = Math.max(existingParticipants.length + 1, 1);
        const initialState = {
          isConnected: true,
          isMuted: false,
          participants: existingParticipants,
          actualParticipantCount: actualCount, // 自分も含めた正確な参加者数（最低1）
        };
        console.log(
          '🔄 STATE CHANGE NOTIFICATION (initial connection):',
          initialState
        );
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
          errorMessage =
            'LiveKitサーバーに接続できません。環境変数を確認してください。';
        } else if (err.message.includes('LiveKit URL is not configured')) {
          errorMessage =
            'LiveKit URLが設定されていません。.env.localファイルでNEXT_PUBLIC_LIVEKIT_URLを設定してください。';
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
        onStateChange?.({
          isConnected: false,
          isMuted: false,
          participants: [],
        });
      }
    }
  };

  const handleConnectionStateChanged = (state: ConnectionState) => {
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
        setIsConnecting(true);
      }
    } else if (state === 'reconnecting') {
      // 既に接続済みの場合は、軽微な再接続では接続中状態に戻さない
      if (!isConnected) {
        setIsConnecting(true);
      }
    }
  };

  const handleReconnecting = () => {
    // 既に接続済みの場合は、軽微な再接続でUI状態を変更しない
    if (!isConnected) {
      setIsConnecting(true);
    }
  };

  const handleReconnected = () => {
    // 再接続完了時は接続状態を確実に更新
    setIsConnected(true);
    setIsConnecting(false);
    connectionRef.current = true;
  };

  const disconnectFromRoom = async () => {
    // 音声レベル監視を停止
    stopAudioLevelMonitoring();

    if (room) {
      try {
        await room.disconnect();
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
        // LiveKitのミュート状態を切り替え
        await room.localParticipant.setMicrophoneEnabled(!isMuted);
        const newMuteState = !isMuted;
        setIsMuted(newMuteState);

        // 音声レベル監視は継続（ミュート状態は監視ループ内で処理）
        // 特別な処理は不要 - 監視ループがLiveKitの状態を確認する

        const actualCount = Math.max(participants.length + 1, 1);
        onStateChange?.({
          isConnected,
          isMuted: newMuteState,
          participants,
          actualParticipantCount: actualCount,
        });
      } catch (error) {
        console.error('Failed to toggle mute:', error);
      }
    }
  };

  // 参加者のオーディオトラックに出力デバイスを適用するヘルパー関数
  const applyOutputDeviceToParticipant = async (
    participant: RemoteParticipant
  ) => {
    if (!selectedOutput) return;

    // setSinkIdのサポートチェック
    const testAudio = new Audio();
    if (typeof testAudio.setSinkId !== 'function') {
      console.warn(
        'Browser does not support setSinkId, using default audio output'
      );
      return;
    }

    // 既存のオーディオトラックに適用
    const promises = Array.from(
      participant.audioTrackPublications.values()
    ).map(async (publication) => {
      if (publication.audioTrack) {
        try {
          await (
            publication.audioTrack as unknown as AudioTrackWithSinkId
          ).setSinkId(selectedOutput);
          console.log(
            `Applied output device to participant: ${participant.identity}`
          );
        } catch (err) {
          console.warn(
            `Failed to set sink ID for participant ${participant.identity}:`,
            err
          );
        }
      }
    });

    await Promise.all(promises);

    // TrackSubscribedイベントをリッスンして、新しいオーディオトラックにも適用
    participant.on('trackSubscribed', async (track, publication) => {
      if (track.kind === 'audio' && selectedOutput) {
        try {
          await (track as unknown as AudioTrackWithSinkId).setSinkId(
            selectedOutput
          );
          console.log(
            `Applied output device to new audio track from: ${participant.identity}`
          );
        } catch (err) {
          console.warn(
            `Failed to set sink ID for new track from ${participant.identity}:`,
            err
          );
        }
      }
    });
  };

  const handleParticipantConnected = (
    currentRoom: Room,
    participant: RemoteParticipant
  ) => {
    // SIDとidentityのみで自分自身を判定（より信頼性が高い）
    const isMyself =
      participant.sid === currentRoom.localParticipant?.sid ||
      participant.identity === currentRoom.localParticipant?.identity;

    if (isMyself) {
      return;
    }

    // 新しい参加者のオーディオトラックに出力デバイスを適用
    applyOutputDeviceToParticipant(participant);

    setParticipants((prev) => {
      // SIDとidentityのみで重複チェック
      const existingParticipant = prev.find(
        (p) => p.sid === participant.sid || p.identity === participant.identity
      );

      if (existingParticipant) {
        return prev;
      }

      const newParticipants = [...prev, participant];

      // 非同期で状態変更を通知（Reactの状態更新競合を避ける）
      setTimeout(() => {
        const actualCount = Math.max(newParticipants.length + 1, 1);
        const newState = {
          isConnected,
          isMuted,
          participants: newParticipants,
          actualParticipantCount: actualCount, // 自分も含めた正確な参加者数（最低1）
        };
        onStateChange?.(newState);
      }, 0);

      return newParticipants;
    });
  };

  const handleParticipantDisconnected = (participant: RemoteParticipant) => {
    setParticipants((prev) => {
      const newParticipants = prev.filter((p) => p.sid !== participant.sid);

      // 非同期で状態変更を通知（Reactの状態更新競合を避ける）
      setTimeout(() => {
        const actualCount = newParticipants.length + 1; // 自分を含めた正確な参加者数
        const newState = {
          isConnected,
          isMuted,
          participants: newParticipants,
          actualParticipantCount: actualCount, // 自分も含めた正確な参加者数
        };
        onStateChange?.(newState);
      }, 0);

      return newParticipants;
    });
  };

  const handleAudioPlaybackStatusChanged = (playing: boolean) => {
    // Audio playback status changed
  };

  const handleDisconnected = () => {
    connectionRef.current = false;
    hasConnectedRef.current = false; // 接続フラグリセット
    setIsConnected(false);
    setParticipants([]);
    onStateChange?.({
      isConnected: false,
      isMuted: false,
      participants: [],
      actualParticipantCount: 0, // 切断時は0
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
                  <span className="text-green-400 text-sm font-medium">
                    音声通話
                  </span>
                </div>
                <div className="text-gray-400 text-sm">
                  ルーム:{' '}
                  <span className="font-mono text-gray-300">{roomId}</span>
                </div>
              </div>
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-2">
                  <Users className="w-4 h-4 text-gray-400" />
                  <span className="text-gray-300 text-sm">
                    {participants.length + 1}人参加中
                  </span>
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
                <h4 className="text-gray-300 font-semibold mb-3">
                  音声デバイス設定
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* 入力デバイス選択 */}
                  <div className="space-y-2">
                    <label
                      htmlFor="inputDevice"
                      className="text-sm text-gray-400"
                    >
                      入力デバイス（マイク）:
                    </label>
                    <select
                      id="inputDevice"
                      onChange={handleInputChange}
                      value={selectedInput}
                      className="w-full p-2 bg-gray-700 border border-gray-600 rounded text-white text-sm"
                    >
                      {devices
                        .filter((device) => device.kind === 'audioinput')
                        .map((device) => (
                          <option key={device.deviceId} value={device.deviceId}>
                            {device.label ||
                              `マイク ${device.deviceId.slice(0, 8)}...`}
                          </option>
                        ))}
                    </select>
                  </div>

                  {/* 出力デバイス選択 */}
                  <div className="space-y-2">
                    <label
                      htmlFor="outputDevice"
                      className="text-sm text-gray-400"
                    >
                      出力デバイス（スピーカー）:
                    </label>
                    <select
                      id="outputDevice"
                      onChange={handleOutputChange}
                      value={selectedOutput}
                      className="w-full p-2 bg-gray-700 border border-gray-600 rounded text-white text-sm"
                    >
                      {devices
                        .filter((device) => device.kind === 'audiooutput')
                        .map((device) => (
                          <option key={device.deviceId} value={device.deviceId}>
                            {device.label ||
                              `スピーカー ${device.deviceId.slice(0, 8)}...`}
                          </option>
                        ))}
                    </select>
                  </div>
                </div>

                {/* 音声レベルテスト */}
                <div className="mt-4 p-3 bg-gray-700/30 rounded">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-gray-300">
                      音声レベルテスト
                    </span>
                    <span className="text-xs text-gray-400">
                      レベル: {localAudioLevel.toFixed(1)}%
                    </span>
                  </div>
                  <div className="w-full bg-gray-600 rounded-full h-2">
                    <div
                      className="bg-gradient-to-r from-green-400 to-blue-500 h-2 rounded-full transition-all duration-100"
                      style={{
                        width: `${localAudioLevel}%`,
                      }}
                    ></div>
                  </div>
                  {/* 音声監視状態の表示 */}
                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-xs text-gray-400">監視状態:</span>
                    <span
                      className={`text-xs font-medium ${isAudioMonitoringActive ? 'text-green-400' : 'text-red-400'}`}
                    >
                      {isAudioMonitoringActive ? 'アクティブ' : '停止中'}
                    </span>
                  </div>
                </div>

                {/* デバイス更新ボタン */}
                <div className="mt-3 flex justify-end space-x-2">
                  <Button
                    onClick={async () => {
                      try {
                        const deviceInfos =
                          await navigator.mediaDevices.enumerateDevices();
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
                        console.log(
                          '⚠️ Cannot restart audio monitoring: not connected'
                        );
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
                {serverMemberCount &&
                  serverMemberCount > 0 &&
                  serverMemberCount !== participants.length + 1 && (
                    <span className="ml-2 text-xs text-yellow-400">
                      (サーバー: {serverMemberCount})
                    </span>
                  )}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {/* 自分 */}
                <div
                  className={`bg-gradient-to-r from-blue-600/20 to-purple-600/20 backdrop-blur-sm border rounded-xl p-4 flex items-center space-x-3 transition-all duration-200 ${
                    localAudioLevel > 10
                      ? 'border-blue-400 shadow-lg shadow-blue-500/30'
                      : 'border-blue-500/30'
                  }`}
                >
                  <div
                    className={`w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center transition-all duration-200 ${
                      localAudioLevel > 20
                        ? 'scale-110 shadow-lg shadow-blue-400/50'
                        : 'scale-100'
                    }`}
                  >
                    <span className="text-white font-bold text-sm">あ</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-medium text-sm truncate">
                      あなた
                    </p>
                    <div className="flex items-center space-x-2 mt-1">
                      <div
                        className={`w-2 h-2 rounded-full ${isMuted ? 'bg-red-400' : 'bg-blue-400'}`}
                      ></div>
                      <span
                        className={`text-xs ${isMuted ? 'text-red-300' : 'text-blue-300'} font-medium`}
                      >
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
                          style={{
                            width: `${localAudioLevel}%`,
                          }}
                        ></div>
                      </div>
                    )}
                  </div>
                </div>

                {/* 他の参加者 */}
                {participants.map((participant, index) => {
                  // 参加者の表示名を取得（-で分割して最初の部分）
                  const displayName = participant.identity
                    ? participant.identity.split('-')[0]
                    : `ユーザー${index + 1}`;

                  return (
                    <div
                      key={`participant-${participant.sid}-${index}`}
                      className="bg-gradient-to-r from-green-600/20 to-emerald-600/20 backdrop-blur-sm border border-green-500/30 rounded-xl p-4 flex items-center space-x-3"
                    >
                      <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-emerald-600 rounded-full flex items-center justify-center">
                        <span className="text-white font-bold text-sm">
                          {displayName.charAt(0)}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-white font-medium text-sm truncate">
                          {displayName}
                        </p>
                        <div className="flex items-center space-x-2 mt-1">
                          <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                          <span className="text-xs text-gray-300">
                            音声オン
                          </span>
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
              variant={isMuted ? 'destructive' : 'outline'}
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
              <div
                className={`w-2 h-2 rounded-full mr-2 ${isConnected ? 'bg-green-400 animate-pulse' : 'bg-yellow-400 animate-pulse'}`}
              ></div>
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
