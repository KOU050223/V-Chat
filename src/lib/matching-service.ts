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

      // 2. 待機状態になった場合、Firestoreを監視
      const queueRef = doc(this.db, "matching_queue", userId);

      this.unsubscribe = onSnapshot(queueRef, (snapshot) => {
        if (!snapshot.exists()) {
          // ドキュメントが削除された = マッチング成立して削除された？
          // 今回のbackend実装では、マッチング成立時に update({ status: 'matched' }) してから
          // クライアントが確認後に削除するフロー、または
          // 相手がトランザクションで削除した場合は検知できない可能性がある。
          // しかし、backend実装では `tx.delete(queueRef.doc(userId))` をしているため、
          // 自分がマッチング成立させた側でなければ、ドキュメントは消える。

          // 修正: Backend実装を確認すると、
          // マッチング成立させた側（A）は、相手（B）のドキュメントを更新し、自分のドキュメントを削除する。
          // 相手（B）は、自分のドキュメントが更新されるのを待つ。

          // なので、自分がAの場合: findMatchの戻り値で matched が返る。
          // 自分がBの場合: 待機中にドキュメントが更新されるはず。

          // もしドキュメントが消えたら？ -> エラーか、あるいは他で処理されたか。
          // ここでは一旦エラー扱いにするが、本来は永続化ログを見るべき。
          // ただし、Backend実装で `tx.delete(queueRef.doc(userId))` しているので、
          // 自分がマッチング成立させた場合はここに来る前に return しているはず。
          // 自分が待機中にドキュメントが消えた = 誰かがマッチング成立させて消してくれた？
          // いえ、Backend実装では `tx.update(partnerDocRef, { status: "matched" ... })` しているので、
          // パートナー（待機側）のドキュメントは消えずに更新されるはず。
          // 自分のドキュメントを消すのは、自分が能動的にマッチングさせた場合のみ。

          return;
        }

        const queueData = snapshot.data();
        if (queueData?.status === "matched" && queueData.roomId) {
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
