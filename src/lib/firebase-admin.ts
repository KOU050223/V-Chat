/**
 * Firebase Admin SDK の初期化とユーティリティ
 * サーバーサイド（API Routes、Cloud Functionsなど）でのみ使用
 */

import { initializeApp, getApps, cert, App } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';
import { getAuth, Auth } from 'firebase-admin/auth';

let adminApp: App | null = null;

/**
 * Firebase Admin アプリケーションのシングルトンインスタンスを取得
 * 初回呼び出し時に初期化され、以降は同じインスタンスを返す
 */
export function getAdminApp(): App {
  if (adminApp) {
    return adminApp;
  }

  // 既に初期化されている場合は既存のアプリを使用
  const existingApps = getApps();
  if (existingApps.length > 0) {
    adminApp = existingApps[0];
    return adminApp;
  }

  // 環境変数から認証情報を取得
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;

  // 認証情報がすべて揃っている場合はサービスアカウントで初期化
  if (projectId && clientEmail && privateKey) {
    try {
      adminApp = initializeApp({
        credential: cert({
          projectId,
          clientEmail,
          // 環境変数内の改行エスケープを実際の改行に変換
          privateKey: privateKey.replace(/\\n/g, '\n'),
        }),
      });
      console.log('Firebase Admin initialized with service account');
    } catch (error) {
      console.error(
        'Failed to initialize Firebase Admin with service account:',
        error
      );
      throw error;
    }
  } else {
    // 環境変数が不足している場合はデフォルト認証情報を使用
    // （Google Cloud環境で自動的に認証情報が提供される場合）
    try {
      adminApp = initializeApp();
      console.log('Firebase Admin initialized with default credentials');
    } catch (error) {
      console.error('Failed to initialize Firebase Admin:', error);
      throw new Error(
        'Firebase Admin initialization failed. Please check your environment variables.'
      );
    }
  }

  return adminApp;
}

/**
 * Firebase Admin Firestore インスタンスを取得
 */
export function getAdminFirestore(): Firestore {
  return getFirestore(getAdminApp());
}

/**
 * Firebase Admin Auth インスタンスを取得
 */
export function getAdminAuth(): Auth {
  return getAuth(getAdminApp());
}

// 便利なエイリアス
export const adminAuth = getAdminAuth();
export const adminDb = getAdminFirestore();

/**
 * 環境変数が正しく設定されているかチェック
 * ビルド時のエラーを防ぐため、ランタイムでのみチェックを行う
 */
export function validateAdminConfig(): { valid: boolean; missing: string[] } {
  const required = [
    'FIREBASE_PROJECT_ID',
    'FIREBASE_CLIENT_EMAIL',
    'FIREBASE_PRIVATE_KEY',
  ];
  const missing: string[] = [];

  for (const key of required) {
    if (!process.env[key]) {
      missing.push(key);
    }
  }

  return {
    valid: missing.length === 0,
    missing,
  };
}
