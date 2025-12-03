"use client";

import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { signIn } from "next-auth/react";
import { auth } from "@/lib/firebaseConfig";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import Image from "next/image";
import { getAuthErrorMessage } from "@/lib/utils/authErrors";

/**
 * unknown型のエラーを安全な文字列に変換
 * @param error - 未知の型のエラー
 * @returns エラーメッセージの文字列
 */
function safeErrorString(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "string") {
    return error;
  }
  try {
    return JSON.stringify(error);
  } catch {
    return "Unknown error";
  }
}

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const { login, register, loginWithGoogle, loginWithGithub, resetPassword } =
    useAuth();

  // Firebase設定チェック
  if (!auth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-r from-blue-50 to-indigo-100 p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="space-y-1">
            <div className="flex justify-center mb-4">
              <Image
                src="/v-chat_logo.png"
                alt="V-Chat Logo"
                width={200}
                height={60}
                priority
                className="h-12 w-auto"
              />
            </div>
            <CardTitle className="text-2xl font-bold text-center text-red-600">
              設定エラー
            </CardTitle>
            <CardDescription className="text-center">
              Firebase設定が正しくありません。環境変数を確認してください。
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-gray-600">
              <p>以下の環境変数が設定されていることを確認してください：</p>
              <ul className="mt-2 list-disc list-inside space-y-1">
                <li>NEXT_PUBLIC_FIREBASE_API_KEY</li>
                <li>NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN</li>
                <li>NEXT_PUBLIC_FIREBASE_PROJECT_ID</li>
                <li>その他のFirebase設定項目</li>
              </ul>
              <p className="mt-4">
                詳細は{" "}
                <a
                  href="/docs/Firebase設定.md"
                  className="text-blue-600 hover:underline"
                >
                  Firebase設定ガイド
                </a>{" "}
                を参照してください。
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccessMessage("");

    try {
      if (isSignUp) {
        if (!displayName.trim()) {
          setError("表示名を入力してください");
          return;
        }
        await register(email, password, displayName);
        setSuccessMessage(
          "アカウントが作成されました。確認メールをご確認ください。"
        );
      } else {
        await login(email, password);
      }
    } catch (error: unknown) {
      setError(getAuthErrorMessage(safeErrorString(error)));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError("");

    try {
      await loginWithGoogle();
    } catch (error: unknown) {
      setError(getAuthErrorMessage(safeErrorString(error)));
    } finally {
      setLoading(false);
    }
  };

  const handleGithubLogin = async () => {
    setLoading(true);
    setError("");

    try {
      await loginWithGithub();
    } catch (error: unknown) {
      setError(getAuthErrorMessage(safeErrorString(error)));
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordReset = async () => {
    if (!email) {
      setError("パスワードリセットのためにメールアドレスを入力してください");
      return;
    }

    setLoading(true);
    setError("");

    try {
      await resetPassword(email);
      setSuccessMessage("パスワードリセットメールを送信しました");
    } catch (error: unknown) {
      setError(getAuthErrorMessage(safeErrorString(error)));
    } finally {
      setLoading(false);
    }
  };

  const handleVRoidLogin = async () => {
    setLoading(true);
    setError("");

    try {
      // 方法1: 直接VRoidプロバイダーを指定
      const result = await signIn("vroid", {
        redirect: true, // VRoidはNextAuthで管理するのでリダイレクトを有効
        callbackUrl: "/dashboard",
      });

      if (result?.error) {
        setError("VRoidログインに失敗しました");
        setLoading(false);
      }
      // redirect: true なので成功時はページが移動する
    } catch (error: unknown) {
      setError("VRoidログインに失敗しました");
      console.error("VRoid login error:", error);
      setLoading(false);
    }
  };

  // 方法2: NextAuth統合サインインページを使用
  const handleNextAuthSignin = () => {
    window.location.href =
      "/api/auth/signin?callbackUrl=" + encodeURIComponent("/dashboard");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-r from-blue-50 to-indigo-100 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <div className="flex justify-center mb-4">
            <Image
              src="/v-chat_logo.png"
              alt="V-Chat Logo"
              width={200}
              height={60}
              priority
              className="h-12 w-auto"
            />
          </div>
          <CardDescription className="text-center">
            {isSignUp
              ? "アカウントを作成してチャットを始めよう"
              : "アカウントにログインしてチャットを始めよう"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-md text-sm">
              {error}
            </div>
          )}

          {successMessage && (
            <div className="bg-green-50 border border-green-200 text-green-600 px-4 py-3 rounded-md text-sm">
              {successMessage}
            </div>
          )}

          <form onSubmit={handleEmailAuth} className="space-y-4">
            {isSignUp && (
              <div className="space-y-2">
                <label htmlFor="displayName" className="text-sm font-medium">
                  表示名
                </label>
                <Input
                  id="displayName"
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  required
                  placeholder="表示名を入力"
                />
              </div>
            )}
            <div className="space-y-2">
              <label htmlFor="email" className="text-sm font-medium">
                メールアドレス
              </label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="your@email.com"
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="password" className="text-sm font-medium">
                パスワード
              </label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="password"
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "処理中..." : isSignUp ? "アカウント作成" : "ログイン"}
            </Button>
          </form>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-white px-2 text-gray-500">または</span>
            </div>
          </div>

          <Button
            onClick={handleGoogleLogin}
            variant="outline"
            className="w-full"
            disabled={loading}
          >
            <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            Googleでログイン
          </Button>

          <Button
            onClick={handleGithubLogin}
            variant="outline"
            className="w-full"
            disabled={loading}
          >
            <svg
              className="mr-2 h-4 w-4"
              fill="currentColor"
              viewBox="0 0 24 24"
            >
              <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
            </svg>
            GitHubでログイン
          </Button>

          <Button
            onClick={handleVRoidLogin}
            variant="outline"
            className="w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white border-none hover:from-purple-600 hover:to-pink-600"
            disabled={loading}
          >
            <svg
              className="mr-2 h-4 w-4"
              fill="currentColor"
              viewBox="0 0 24 24"
            >
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
            </svg>
            VRoid Hubでログイン
          </Button>

          <Button
            onClick={handleNextAuthSignin}
            variant="outline"
            className="w-full"
            disabled={loading}
          >
            NextAuth統合ページでログイン
          </Button>

          <div className="text-center space-y-2">
            <button
              type="button"
              onClick={() => setIsSignUp(!isSignUp)}
              className="text-sm text-blue-600 hover:underline"
            >
              {isSignUp
                ? "すでにアカウントをお持ちですか？ログイン"
                : "アカウントをお持ちでない方は新規登録"}
            </button>

            {!isSignUp && (
              <div>
                <button
                  type="button"
                  onClick={handlePasswordReset}
                  className="text-sm text-gray-600 hover:underline"
                  disabled={loading}
                >
                  パスワードを忘れた方はこちら
                </button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
