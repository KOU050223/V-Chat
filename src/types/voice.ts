/**
 * 音声通話機能の型定義
 */

import type { RemoteParticipant } from 'livekit-client';

/**
 * 音声通話の状態
 */
export interface VoiceCallState {
  /** 接続済みかどうか */
  isConnected: boolean;
  /** ミュート中かどうか */
  isMuted: boolean;
  /** リモート参加者のリスト */
  participants: RemoteParticipant[];
  /** 実際の参加者数（自分を含む） */
  actualParticipantCount?: number;
}
