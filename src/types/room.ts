/**
 * ルーム機能の型定義
 */

/**
 * ルームのステータス
 */
export type RoomStatus = "waiting" | "active" | "ended";

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
  createdBy: string;
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
export interface RoomDoc extends Omit<Room, "createdAt" | "endedAt"> {
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
 * @note API レスポンスは変換済みのドメイン型（Room）を返す
 */
export interface JoinRoomResponse {
  success: boolean;
  room: Room;
  message?: string;
}

/**
 * チャットメッセージの構造（UI用）
 */
export interface ChatMessage {
  /** メッセージID */
  id: string;
  /** 送信者のユーザーID */
  userId: string;
  /** 送信者の表示名 */
  userName: string;
  /** メッセージ内容 */
  content: string;
  /** 送信時刻 */
  timestamp: Date;
}

/**
 * Firestoreのチャットメッセージドキュメント型
 */
export interface ChatMessageDoc extends Omit<ChatMessage, "timestamp"> {
  timestamp: FirestoreTimestamp;
}

/**
 * ルーム表示用の情報（UI用の簡易版）
 */
export interface RoomDisplayInfo {
  /** ルームID */
  roomId: string;
  /** ルーム名 */
  name: string;
  /** ルームの説明 */
  description?: string;
  /** プライベートルームかどうか */
  isPrivate: boolean;
  /** 現在の参加人数 */
  members: number;
}

/**
 * RoomDoc を Room に変換するヘルパー関数
 * @param doc Firestore から取得したルームドキュメント
 * @returns UI 用の Room オブジェクト
 * @throws {Error} doc または doc.createdAt が不正な場合
 */
export function roomDocToRoom(doc: RoomDoc): Room {
  if (!doc) {
    throw new Error("RoomDoc is required");
  }

  if (!doc.createdAt || typeof doc.createdAt.toDate !== "function") {
    throw new Error("RoomDoc.createdAt must be a valid Firestore Timestamp");
  }

  return {
    ...doc,
    createdAt: doc.createdAt.toDate(),
    endedAt:
      doc.endedAt && typeof doc.endedAt.toDate === "function"
        ? doc.endedAt.toDate()
        : null,
  };
}

/**
 * ChatMessageDoc を ChatMessage に変換するヘルパー関数
 * @param doc Firestore から取得したメッセージドキュメント
 * @returns UI 用の ChatMessage オブジェクト
 * @throws {Error} doc または doc.timestamp が不正な場合
 */
export function chatMessageDocToChatMessage(doc: ChatMessageDoc): ChatMessage {
  if (!doc) {
    throw new Error("ChatMessageDoc is required");
  }

  if (!doc.timestamp || typeof doc.timestamp.toDate !== "function") {
    throw new Error(
      "ChatMessageDoc.timestamp must be a valid Firestore Timestamp"
    );
  }

  return {
    ...doc,
    timestamp: doc.timestamp.toDate(),
  };
}
