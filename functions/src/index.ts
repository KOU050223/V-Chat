/**
 * V-Chat Firebase Cloud Functions
 * マッチング機能とLiveKit統合
 */

import {setGlobalOptions} from "firebase-functions/v2";
import {onDocumentCreated} from "firebase-functions/v2/firestore";
import {onCall, HttpsError} from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import {AccessToken} from "livekit-server-sdk";
import * as logger from "firebase-functions/logger";

// Firebase Admin SDKの初期化
admin.initializeApp();

const db = admin.firestore();

// グローバル設定: コスト管理のため最大インスタンス数を制限
setGlobalOptions({maxInstances: 10});

/**
 * マッチングキューの監視と自動マッチング処理
 * 新しいドキュメントが作成されたときにトリガーされる
 */
export const processMatchingQueue = onDocumentCreated(
  "matching_queue/{queueId}",
  async (event) => {
    const queueId = event.params.queueId;
    const queueData = event.data?.data();

    if (!queueData || queueData.status !== "waiting") {
      return;
    }

    try {
      // 他の待機中のキューを検索（自分以外）
      const waitingQueues = await db
        .collection("matching_queue")
        .where("status", "==", "waiting")
        .orderBy("enqueuedAt", "asc")
        .limit(2)
        .get();

      // 自分以外の待機者がいるかチェック
      const otherQueues = waitingQueues.docs.filter(
        (doc) => doc.id !== queueId
      );

      if (otherQueues.length === 0) {
        // マッチング相手がいない場合は待機
        logger.info(`No match found for queue ${queueId}, waiting...`);
        return;
      }

      // マッチング相手を見つけた
      const matchedQueue = otherQueues[0];
      const matchedQueueData = matchedQueue.data();

      // LiveKitのルームIDを生成
      const roomId = `room_${Date.now()}_${Math.random()
        .toString(36)
        .substring(7)}`;
      const livekitRoomId = `livekit_${roomId}`;

      // トランザクションでマッチング処理を実行
      await db.runTransaction(async (transaction) => {
        const currentQueueRef = db.collection("matching_queue").doc(queueId);

        // 両方のキューのステータスを更新
        transaction.update(currentQueueRef, {
          status: "matched",
          matchedAt: admin.firestore.FieldValue.serverTimestamp(),
          matchedUserId: matchedQueueData.userId,
          roomId,
        });

        transaction.update(matchedQueue.ref, {
          status: "matched",
          matchedAt: admin.firestore.FieldValue.serverTimestamp(),
          matchedUserId: queueData.userId,
          roomId,
        });

        // マッチングルームを作成
        const roomRef = db.collection("matching_rooms").doc(roomId);
        transaction.set(roomRef, {
          roomId,
          participants: [queueData.userId, matchedQueueData.userId],
          status: "active",
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          endedAt: null,
          livekitRoomId,
        });
      });

      logger.info(
        `Match created: ${queueData.userId} <-> ${matchedQueueData.userId}`,
        {roomId}
      );
    } catch (error) {
      logger.error("Error processing matching queue:", error);
    }
  }
);

/**
 * タイムアウト処理
 * キューが作成されたときにチェックし、既にタイムアウトしている場合は処理
 *
 * 注意: Cloud Scheduler（定期実行）は課金が必要なため、
 * 開発環境ではこのトリガーベースの方法を使用します。
 * 本番環境では、より正確なタイムアウト処理のため、
 * Cloud Schedulerを有効化することを推奨します。
 */
export const checkMatchingTimeoutOnCreate = onDocumentCreated(
  "matching_queue/{queueId}",
  async (event) => {
    // 60秒後にタイムアウトチェックを実行
    await new Promise((resolve) => setTimeout(resolve, 60000));

    try {
      const queueId = event.params.queueId;
      const queueRef = db.collection("matching_queue").doc(queueId);
      const queueDoc = await queueRef.get();

      if (!queueDoc.exists) {
        return;
      }

      const queueData = queueDoc.data();

      // まだwaitingステータスの場合はタイムアウト
      if (queueData?.status === "waiting") {
        await queueRef.update({
          status: "timeout",
        });
        logger.info(`Queue ${queueId} timed out`);
      }
    } catch (error) {
      logger.error("Error checking timeout:", error);
    }
  }
);

/**
 * LiveKitアクセストークンの生成
 * HTTP Callable関数として公開
 */
export const generateLivekitToken = onCall(async (request) => {
  // 認証チェック
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "認証が必要です");
  }

  const {roomId} = request.data;
  const userId = request.auth.uid;

  // roomIdのバリデーション
  if (!roomId || typeof roomId !== "string") {
    throw new HttpsError("invalid-argument", "roomIdが必要です");
  }

  try {
    // ルームの存在確認と参加権限のチェック
    const roomDoc = await db.collection("matching_rooms").doc(roomId).get();

    if (!roomDoc.exists) {
      throw new HttpsError("not-found", "ルームが見つかりません");
    }

    const roomData = roomDoc.data();
    if (!roomData?.participants.includes(userId)) {
      throw new HttpsError(
        "permission-denied",
        "このルームへの参加権限がありません"
      );
    }

    // LiveKitのアクセストークンを生成
    const livekitApiKey = process.env.LIVEKIT_API_KEY;
    const livekitApiSecret = process.env.LIVEKIT_API_SECRET;

    if (!livekitApiKey || !livekitApiSecret) {
      throw new HttpsError(
        "failed-precondition",
        "LiveKitの設定が不完全です"
      );
    }

    const at = new AccessToken(livekitApiKey, livekitApiSecret, {
      identity: userId,
    });

    at.addGrant({
      roomJoin: true,
      room: roomData.livekitRoomId,
      canPublish: true,
      canSubscribe: true,
    });

    const token = await at.toJwt();

    return {
      token,
      livekitRoomId: roomData.livekitRoomId,
    };
  } catch (error) {
    logger.error("Error generating LiveKit token:", error);
    if (error instanceof HttpsError) {
      throw error;
    }
    throw new HttpsError("internal", "トークンの生成に失敗しました");
  }
});

/**
 * ルーム終了処理
 */
export const endRoom = onCall(async (request) => {
  // 認証チェック
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "認証が必要です");
  }

  const {roomId} = request.data;
  const userId = request.auth.uid;

  try {
    // ルームの存在確認と参加権限のチェック
    const roomDoc = await db.collection("matching_rooms").doc(roomId).get();

    if (!roomDoc.exists) {
      throw new HttpsError("not-found", "ルームが見つかりません");
    }

    const roomData = roomDoc.data();
    if (!roomData?.participants.includes(userId)) {
      throw new HttpsError(
        "permission-denied",
        "このルームへの権限がありません"
      );
    }

    // ルームを終了状態に更新
    await roomDoc.ref.update({
      status: "ended",
      endedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return {success: true};
  } catch (error) {
    logger.error("Error ending room:", error);
    if (error instanceof HttpsError) {
      throw error;
    }
    throw new HttpsError("internal", "ルームの終了に失敗しました");
  }
});
