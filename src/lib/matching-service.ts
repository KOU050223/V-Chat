import { getFunctions, httpsCallable } from "firebase/functions";
import { getFirestore, doc, onSnapshot, Unsubscribe } from "firebase/firestore";
import { app } from "./firebaseConfig";

/**
 * マッチングの状態を表すインターフェース
 */
export interface MatchingState {
  status: "idle" | "waiting" | "matched" | "error";
  roomId?: string;
  partnerId?: string;
  error?: string;
}

interface FindMatchResponse {
  status: "matched" | "waiting";
  roomId?: string;
  partnerId?: string;
  message?: string;
}

/**
 * findMatch関数のレスポンスを検証するタイプガード
 */
function isValidFindMatchResponse(data: unknown): data is FindMatchResponse {
  if (typeof data !== "object" || data === null) {
    return false;
  }

  const obj = data as Record<string, unknown>;

  // statusフィールドの検証
  if (obj.status !== "matched" && obj.status !== "waiting") {
    return false;
  }

  // オプショナルフィールドの検証
  if (obj.roomId !== undefined && typeof obj.roomId !== "string") {
    return false;
  }

  if (obj.partnerId !== undefined && typeof obj.partnerId !== "string") {
    return false;
  }

  if (obj.message !== undefined && typeof obj.message !== "string") {
    return false;
  }

  return true;
}

export class MatchingService {
  private functions = getFunctions(app, "us-central1");
  private db = getFirestore(app);
  private unsubscribe: Unsubscribe | null = null;

  /**
   * マッチングを開始する
   * - 待機列に参加 (findMatch)
   * - 自身の待機ドキュメントを監視
   */
  async startMatching(
    userId: string,
    onStateChange: (state: MatchingState) => void
  ): Promise<void> {
    try {
      onStateChange({ status: "waiting" });

      // 1. findMatch関数を呼び出す
      const findMatch = httpsCallable(this.functions, "findMatch");
      const result = await findMatch();

      // レスポンスのランタイムバリデーション
      if (!isValidFindMatchResponse(result.data)) {
        throw new Error(
          "findMatch関数から予期しないレスポンス形式が返されました"
        );
      }

      const data = result.data;

      if (data.status === "matched") {
        // 即座にマッチングした場合
        onStateChange({
          status: "matched",
          roomId: data.roomId,
          partnerId: data.partnerId,
        });
        return;
      }

      const startTime = Date.now();

      // 2. 待機状態になった場合、Firestoreを監視
      const queueRef = doc(this.db, "matching_queue", userId);

      this.unsubscribe = onSnapshot(queueRef, (snapshot) => {
        if (!snapshot.exists()) {
          return;
        }

        const queueData = snapshot.data();
        if (queueData?.status === "matched" && queueData.roomId) {
          // マッチング成立日時をチェック（古いマッチング情報の残骸を無視する）
          if (queueData.matchedAt) {
            const matchedAtMillis = queueData.matchedAt.toMillis();
            // startMatching呼び出しより前のマッチング情報は無視
            // (タイムスタンプのズレを考慮して少し余裕を持たせても良いが、基本的には等号で十分なはず)
            if (matchedAtMillis < startTime) {
              console.log("Ignored stale match data:", queueData);
              return;
            }
          }

          onStateChange({
            status: "matched",
            roomId: queueData.roomId,
            partnerId: queueData.partnerId, // backendで保存していれば
          });

          // マッチング完了を確認したら、クリーンアップとしてドキュメントを削除しても良いが、
          // 他のクライアントとの競合を避けるため、一旦放置するか、
          // ルーム入室後に削除するなどの処理が必要。
          // ここでは監視を終了するのみ。
          this.cleanup();
        }
      });
    } catch (error: unknown) {
      console.error("Matching error:", error);
      let errorMessage = "マッチング中にエラーが発生しました";
      if (error instanceof Error) {
        errorMessage = error.message;
      }
      onStateChange({
        status: "error",
        error: errorMessage,
      });
    }
  }

  /**
   * Firestoreの監視を停止する
   */
  private cleanup(): void {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
  }

  /**
   * マッチングをキャンセルする
   */
  async cancelMatching(): Promise<void> {
    this.cleanup(); // 監視を停止

    try {
      const cancelMatch = httpsCallable(this.functions, "cancelMatch");
      await cancelMatch();
    } catch (error) {
      console.error("Cancel matching error:", error);
      throw new Error(
        error instanceof Error
          ? `マッチングのキャンセルに失敗しました: ${error.message}`
          : "マッチングのキャンセルに失敗しました"
      );
    }
  }
}

export const matchingService = new MatchingService();
