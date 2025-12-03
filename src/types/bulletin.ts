/**
 * 掲示板機能の型定義
 */

// 投稿カテゴリ
export type PostCategory =
  | "雑談"
  | "ゲーム"
  | "趣味"
  | "技術"
  | "イベント"
  | "その他";

// 投稿の型
export interface BulletinPost {
  id: string;
  title: string;
  content: string;
  category: PostCategory;
  maxParticipants: number; // 募集人数
  currentParticipants: number; // 現在の参加者数
  authorId: string;
  authorName: string;
  authorPhoto?: string;
  roomId?: string; // 作成されたルームID
  likes: string[]; // いいねしたユーザーIDの配列
  tags?: string[]; // タグ
  replyCount?: number; // 返信数（Firestoreから取得時に追加）
  isBookmarked?: boolean; // ブックマーク済みか（クライアント側で管理）
  createdAt: Date;
  updatedAt: Date;
}

// 返信の型
export interface BulletinReply {
  id: string;
  postId: string;
  content: string;
  authorId: string;
  authorName: string;
  authorPhoto?: string;
  isEdited?: boolean; // 編集されたかどうか
  createdAt: Date;
  updatedAt: Date;
}

// 投稿作成リクエストの型
export interface CreatePostRequest {
  title: string;
  content: string;
  category: PostCategory;
  maxParticipants: number;
  tags?: string[];
  // userId は Authorization ヘッダーから取得されるため不要
  userName?: string;
  userPhoto?: string;
}

// 返信作成リクエストの型
export interface CreateReplyRequest {
  content: string;
  // userId は Authorization ヘッダーから取得されるため不要
  userName?: string;
  userPhoto?: string;
}

// 投稿更新リクエストの型
export interface UpdatePostRequest {
  title?: string;
  content?: string;
  category?: PostCategory;
  maxParticipants?: number;
  tags?: string[];
}

// ソート順
export type SortOrder = "newest" | "popular" | "participants";

// フィルター条件
export interface PostFilter {
  category?: PostCategory;
  search?: string;
  sortOrder?: SortOrder;
}

// API レスポンスの型
export interface BulletinApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}
