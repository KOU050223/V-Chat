import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// 環境変数の検証
const requiredEnvVars = {
    NEXT_PUBLIC_FIREBASE_API_KEY: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN:
        process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    NEXT_PUBLIC_FIREBASE_PROJECT_ID:
        process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
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

// 必須の環境変数をチェック（SSR時はスキップ）
if (typeof window !== 'undefined') {
    const missingVars = Object.entries(requiredEnvVars)
        .filter(([_, value]) => !value)
        .map(([key]) => key);

    if (missingVars.length > 0) {
        console.error('Missing Firebase environment variables:', missingVars);
        throw new Error(
            `Missing Firebase configuration: ${missingVars.join(', ')}`
        );
    }
}

const firebaseConfig = {
    apiKey: requiredEnvVars.NEXT_PUBLIC_FIREBASE_API_KEY || '',
    authDomain: requiredEnvVars.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || '',
    projectId: requiredEnvVars.NEXT_PUBLIC_FIREBASE_PROJECT_ID || '',
    storageBucket: requiredEnvVars.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || '',
    messagingSenderId:
        requiredEnvVars.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '',
    appId: requiredEnvVars.NEXT_PUBLIC_FIREBASE_APP_ID || '',
    measurementId: optionalEnvVars.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID || '',
};

// Firebase アプリケーションの初期化（重複初期化を防ぐ）
let app: FirebaseApp;
if (getApps().length === 0) {
    app = initializeApp(firebaseConfig);
} else {
    app = getApp();
}

// Firebase Authentication の初期化（クライアントサイドのみ）
export const auth = typeof window !== 'undefined' ? getAuth(app) : null;

// Firestore の初期化（クライアントサイドのみ）
export const db = typeof window !== 'undefined' ? getFirestore(app) : null;

// Firebase App インスタンスのエクスポート（Cloud Functions用）
export { app };

export default firebaseConfig;
