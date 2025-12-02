// ユーザー関連の型定義
export interface User {
  id: string;
  email: string;
  displayName: string;
  photoURL?: string;
  createdAt: Date;
  updatedAt: Date;
}

// チャット関連の型定義
export interface ChatRoom {
  id: string;
  name: string;
  description?: string;
  createdBy: string;
  participants: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface Message {
  id: string;
  roomId: string;
  userId: string;
  content: string;
  type: "text" | "image" | "file";
  createdAt: Date;
  updatedAt: Date;
}

// API レスポンス関連の型定義
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// Firebase関連の型定義
export interface FirebaseConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
}

// コンポーネントの共通Props
export interface BaseComponentProps {
  className?: string;
  children?: React.ReactNode;
}
