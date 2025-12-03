/**
 * Firebase Authentication エラーメッセージを日本語のユーザーフレンドリーなメッセージに変換
 * @param error - Firebaseから返されたエラーメッセージ
 * @returns ユーザー向けの日本語エラーメッセージ
 */
export function getAuthErrorMessage(error: string): string {
  const errorMap: Record<string, string> = {
    "auth/invalid-credential":
      "メールアドレスまたはパスワードが正しくありません",
    "auth/user-not-found": "ユーザーが見つかりません",
    "auth/wrong-password": "パスワードが間違っています",
    "auth/email-already-in-use": "このメールアドレスは既に使用されています",
    "auth/weak-password": "パスワードは6文字以上で入力してください",
    "auth/invalid-email": "メールアドレスの形式が正しくありません",
    "auth/popup-closed-by-user": "ログインがキャンセルされました",
    "auth/network-request-failed": "ネットワークエラーが発生しました",
    "auth/too-many-requests":
      "リクエストが多すぎます。しばらくしてから再度お試しください",
    "auth/user-disabled": "このアカウントは無効化されています",
    "auth/operation-not-allowed": "この操作は許可されていません",
  };

  for (const [code, message] of Object.entries(errorMap)) {
    if (error.includes(code)) {
      return message;
    }
  }

  // 開発環境のみ元のエラーを表示、本番環境では汎用メッセージ
  if (process.env.NODE_ENV === "development") {
    console.error("Unhandled auth error:", error);
  }

  return "認証エラーが発生しました。しばらくしてから再度お試しください。";
}
