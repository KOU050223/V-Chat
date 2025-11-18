import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * エラーから安全にメッセージを取得
 * @param error - 任意の型のエラー
 * @returns エラーメッセージ文字列
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

/**
 * エラーをコンソールに記録
 * @param context - エラーのコンテキスト（例: "VRoid連携エラー"）
 * @param error - 任意の型のエラー
 */
export function logError(context: string, error: unknown): void {
  console.error(`${context}:`, error);
}

/**
 * エラーをログに記録して、メッセージを取得
 * @param context - エラーのコンテキスト（例: "VRoid連携エラー"）
 * @param error - 任意の型のエラー
 * @returns エラーメッセージ文字列
 *
 * @example
 * ```typescript
 * try {
 *   await someAsyncOperation();
 * } catch (error: unknown) {
 *   const message = handleError('操作エラー', error);
 *   alert(message);
 * }
 * ```
 */
export function handleError(context: string, error: unknown): string {
  logError(context, error);
  return getErrorMessage(error);
}

/**
 * Firebase Functions エラーを処理して適切なメッセージを返す
 * @param context - エラーのコンテキスト（例: "ルーム参加エラー"）
 * @param error - 任意の型のエラー
 * @param defaultMessage - デフォルトのエラーメッセージ（オプション）
 * @returns 適切なエラーメッセージ文字列
 *
 * @example
 * ```typescript
 * try {
 *   await joinRoom({ roomId: 'ABC123' });
 * } catch (error: unknown) {
 *   const message = handleFirebaseFunctionError('ルーム参加エラー', error);
 *   setError(message);
 * }
 * ```
 */
export function handleFirebaseFunctionError(
  context: string,
  error: unknown,
  defaultMessage: string = 'エラーが発生しました'
): string {
  logError(context, error);

  // Firebase Functions のエラーコードマッピング
  const errorMessages: Record<string, string> = {
    'functions/not-found': 'ルームが見つかりません',
    'functions/resource-exhausted': 'ルームが満員です',
    'functions/failed-precondition': 'このルームは利用できません',
    'functions/unauthenticated': '認証が必要です',
    'functions/permission-denied': 'このルームへの参加権限がありません',
    'functions/invalid-argument': '無効なリクエストです',
    'functions/internal': 'サーバーエラーが発生しました',
  };

  // error が code プロパティを持つオブジェクトかチェック
  if (
    error &&
    typeof error === 'object' &&
    'code' in error &&
    typeof error.code === 'string'
  ) {
    return errorMessages[error.code] || defaultMessage;
  }

  // Firebase Functions エラーでない場合は通常のエラーメッセージを取得
  return getErrorMessage(error) || defaultMessage;
}
