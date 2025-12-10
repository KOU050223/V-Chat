import { initializeApp, getApps, getApp, FirebaseApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

// 環境変数の検証
const requiredEnvVars = {
  NEXT_PUBLIC_FIREBASE_API_KEY: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN:
    process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET:
    process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID:
    process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  NEXT_PUBLIC_FIREBASE_APP_ID: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// オプショナルな環境変数
const optionalEnvVars = {
  NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID:
    process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

// 必須の環境変数をチェック（テスト環境以外で実行）
if (process.env.NODE_ENV !== "test") {
  const missingVars = Object.entries(requiredEnvVars)
    .filter(([, value]) => !value)
    .map(([key]) => key);

  if (missingVars.length > 0) {
    const errorMessage = `Missing required Firebase environment variables: ${missingVars.join(", ")}`;
    console.error(errorMessage);

    // クライアントサイドではエラーをスローして開発者に通知
    if (typeof window !== "undefined") {
      throw new Error(errorMessage);
    }
    // サーバーサイドでは警告を出すが、Firebase Admin SDK使用を想定して続行
    console.warn(
      "Warning: Firebase client SDK initialized with missing configuration. " +
        "Server-side operations should use Firebase Admin SDK instead."
    );
  }
}

const firebaseConfig = {
  apiKey: requiredEnvVars.NEXT_PUBLIC_FIREBASE_API_KEY || "",
  authDomain: requiredEnvVars.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "",
  projectId: requiredEnvVars.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "",
  storageBucket: requiredEnvVars.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "",
  messagingSenderId:
    requiredEnvVars.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "",
  appId: requiredEnvVars.NEXT_PUBLIC_FIREBASE_APP_ID || "",
  measurementId: optionalEnvVars.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID || "",
};

// Firebase アプリケーションの初期化（重複初期化を防ぐ）
let app: FirebaseApp;
if (getApps().length === 0) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApp();
}

// Firebase Authentication の初期化（クライアントサイドのみ）
export const auth = typeof window !== "undefined" ? getAuth(app) : null;

// Firestore の初期化（サーバーサイドとクライアントサイド両方で使用可能）
export const db = getFirestore(app);

// Storage の初期化
export const storage = getStorage(app);

// Firebase App インスタンスのエクスポート（Cloud Functions用）
export { app };

export default firebaseConfig;
