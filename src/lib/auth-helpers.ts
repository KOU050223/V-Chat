/**
 * API Routes 用の認証ヘルパー関数
 * Firebase ID トークンと NextAuth セッションの両方をサポート
 */

import { NextRequest } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { getAdminAuth } from "@/lib/firebase-admin";

/**
 * 認証結果の型定義
 */
export interface AuthResult {
  authenticated: boolean;
  userId?: string;
  error?: string;
}

/**
 * API リクエストから認証情報を取得・検証
 *
 * 1. NextAuth セッションをチェック
 * 2. Firebase ID トークンをチェック（Authorization ヘッダー）
 *
 * @param request - Next.js API リクエスト
 * @returns 認証結果（userId または error）
 */
export async function authenticateRequest(
  request: NextRequest
): Promise<AuthResult> {
  // 1. NextAuth セッションを確認
  try {
    const session = await getServerSession(authOptions);
    if (session?.user?.id) {
      return {
        authenticated: true,
        userId: session.user.id,
      };
    }
  } catch (error) {
    console.error("NextAuth session check failed:", error);
  }

  // 2. Firebase ID トークンを確認
  const authHeader = request.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const idToken = authHeader.substring(7);

    try {
      const adminAuth = getAdminAuth();
      const decodedToken = await adminAuth.verifyIdToken(idToken);

      return {
        authenticated: true,
        userId: decodedToken.uid,
      };
    } catch (error) {
      console.error("Firebase token verification failed:", error);
      return {
        authenticated: false,
        error: "トークンの検証に失敗しました",
      };
    }
  }

  // どちらの認証方法も失敗
  return {
    authenticated: false,
    error: "認証が必要です",
  };
}
