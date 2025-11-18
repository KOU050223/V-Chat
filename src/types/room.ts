/**
 * ルーム機能の型定義
 */

/**
 * ルームのステータス
 */
export type RoomStatus = 'waiting' | 'active' | 'ended';

/**
 * Firestore Timestampの型定義
 */
export interface FirestoreTimestamp {
    seconds: number;
    nanoseconds: number;
    toDate(): Date;
}

/**
 * ルームドキュメントの構造
 */
export interface Room {
    /** ルームID */
    roomId: string;
    /** ルーム名 */
    name: string;
    /** ルームの説明 */
    description?: string;
    /** プライベートルームかどうか */
    isPrivate: boolean;
    /** ルーム作成者のユーザーID */
    creatorId: string;
    /** 参加メンバーのユーザーID配列 */
    members: string[];
    /** 最大参加人数 */
    maxMembers: number;
    /** ルームのステータス */
    status: RoomStatus;
    /** LiveKitのルームID */
    livekitRoomId: string;
    /** ルームが作成された時刻 */
    createdAt: Date;
    /** ルームが終了した時刻 */
    endedAt: Date | null;
}

/**
 * FirestoreのルームドキュメントType
 */
export interface RoomDoc extends Omit<Room, 'createdAt' | 'endedAt'> {
    createdAt: FirestoreTimestamp;
    endedAt: FirestoreTimestamp | null;
}

/**
 * ルーム作成のリクエスト
 */
export interface CreateRoomRequest {
    name: string;
    description?: string;
    isPrivate: boolean;
}

/**
 * ルーム作成のレスポンス
 */
export interface CreateRoomResponse {
    success: boolean;
    roomId: string;
    livekitRoomId: string;
    message?: string;
}

/**
 * ルーム参加のリクエスト
 */
export interface JoinRoomRequest {
    roomId: string;
}

/**
 * ルーム参加のレスポンス
 */
export interface JoinRoomResponse {
    success: boolean;
    room: RoomDoc;
    message?: string;
}
