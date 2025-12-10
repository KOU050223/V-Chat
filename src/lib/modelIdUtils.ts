/**
 * modelIdをサニタイズ・バリデーション
 * パストラバーサル攻撃を防ぐため、安全な文字のみを許可
 */
export function sanitizeModelId(modelId: string): string | null {
  // 英数字、ハイフン、アンダースコアのみを許可（1-64文字）
  const safePattern = /^[A-Za-z0-9_-]{1,64}$/;
  if (!safePattern.test(modelId)) {
    return null;
  }
  return modelId;
}
