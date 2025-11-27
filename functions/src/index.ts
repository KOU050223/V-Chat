/**
 * V-Chat Firebase Cloud Functions
 * マッチング機能とLiveKit統合
 */

import { setGlobalOptions } from "firebase-functions/v2";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import { AccessToken } from "livekit-server-sdk";
import * as logger from "firebase-functions/logger";
import * as crypto from "crypto";

// Firebase Admin SDKの初期化
admin.initializeApp();

const db = admin.firestore();

// グローバル設定: コスト管理のため最大インスタンス数を制限
setGlobalOptions({ region: "us-central1", maxInstances: 10 });

/**
 * ルーム作成
 * HTTP Callable関数として公開
 */
export const createRoom = onCall(async (request) => {
  // 認証チェック
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "認証が必要です");
  }

  try {
    // request.dataのバリデーション
    if (!request.data || typeof request.data !== "object") {
      throw new HttpsError("invalid-argument", "無効なリクエストデータです");
    }

    const { name, description, isPrivate } = request.data as {
      name?: unknown;
      description?: unknown;
      isPrivate?: unknown;
    };
    const userId = request.auth.uid;

    // バリデーション
    if (!name || typeof name !== "string" || name.trim().length === 0) {
      throw new HttpsError("invalid-argument", "ルーム名が必要です");
    }
    // 短いルームIDを生成（8文字の英数字）
    // 暗号学的に安全なランダムバイトを使用
    // エントロピー: 36^8 ≈ 2^41 (約2.8兆通り) → コリジョン確率を大幅に削減
    const generateShortId = () => {
      // 6バイトのランダムデータを生成（エントロピー向上）
      const randomBytes = crypto.randomBytes(6);
      // バイト列を整数に変換してbase36変換、最初の8文字を取得
      const randomValue = randomBytes.readUIntBE(0, 6);
      return randomValue.toString(36).substring(0, 8).toUpperCase();
    };

    let attempts = 0;
    const maxAttempts = 5;
    let roomId = "";
    let livekitRoomId = "";
    let createdSuccessfully = false;

    // アトミックな作成処理（競合を回避）
    while (attempts < maxAttempts && !createdSuccessfully) {
      roomId = generateShortId();
      livekitRoomId = `livekit_${roomId}_${Date.now()}`;

      const roomDataToSave = {
        roomId,
        name: name.trim(),
        description: typeof description === "string" ? description.trim() : "",
        isPrivate: isPrivate || false,
        createdBy: userId,
        participants: [userId],
        status: "active",
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        livekitRoomId,
      };

      try {
        // create()は、ドキュメントが存在しない場合のみ成功する
        await db.collection("rooms").doc(roomId).create(roomDataToSave);
        createdSuccessfully = true;
      } catch (error: unknown) {
        // ALREADY_EXISTS (code 6 or 'already-exists')
        const isAlreadyExistsError =
          error &&
          typeof error === "object" &&
          "code" in error &&
          (error.code === "already-exists" || error.code === 6);

        if (isAlreadyExistsError) {
          attempts++;
          if (attempts < maxAttempts) {
            // 指数バックオフでリトライ
            await new Promise((resolve) => setTimeout(resolve, 100 * attempts));
          }
        } else {
          // その他のエラーは再スロー
          throw error;
        }
      }
    }

    if (!createdSuccessfully) {
      throw new HttpsError("internal", "ルームIDの生成に失敗しました");
    }

    // 保存されたドキュメントを再読み込みしてTimestampを取得
    const savedDoc = await db.collection("rooms").doc(roomId).get();
    const savedData = savedDoc.data();

    logger.info({
      message: "Room created",
      roomId,
      userId,
    });

    // JSON-serializableなレスポンスを返す
    return {
      roomId,
      name: name.trim(),
      description: typeof description === "string" ? description.trim() : "",
      isPrivate: isPrivate || false,
      createdBy: userId,
      participants: [userId],
      status: "active",
      createdAt: savedData?.createdAt?.toDate().toISOString() || null,
      livekitRoomId,
    };
  } catch (error) {
    logger.error("Error creating room:", error);
    if (error instanceof HttpsError) {
      throw error;
    }
    throw new HttpsError("internal", "ルームの作成に失敗しました");
  }
});

/**
 * ルーム参加
 * HTTP Callable関数として公開
 */
export const joinRoom = onCall(async (request) => {
  // 認証チェック
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "認証が必要です");
  }

  try {
    // request.dataのバリデーション
    if (!request.data || typeof request.data !== "object") {
      throw new HttpsError("invalid-argument", "無効なリクエストデータです");
    }

    const { roomId } = request.data as { roomId?: unknown };
    const userId = request.auth.uid;

    // roomIdのバリデーション
    if (!roomId || typeof roomId !== "string" || roomId.trim() === "") {
      throw new HttpsError("invalid-argument", "roomIdが必要です");
    }
    // Transactionを使用してアトミックに参加処理を実行
    const roomRef = db.collection("rooms").doc(roomId);
    let livekitRoomIdResult: string | undefined;

    await db.runTransaction(async (tx) => {
      const roomDoc = await tx.get(roomRef);

      if (!roomDoc.exists) {
        throw new HttpsError("not-found", "ルームが見つかりません");
      }

      const roomData = roomDoc.data();

      // デバッグログ: ルームデータとステータスを確認
      logger.info("joinRoom - Room Data Check:", {
        roomId,
        userId,
        status: roomData?.status,
        statusType: typeof roomData?.status,
        participantCount: roomData?.participants?.length || 0,
      });

      if (roomData?.status !== "active") {
        logger.warn("joinRoom - Room not active:", {
          roomId,
          userId,
          currentStatus: roomData?.status,
          expectedStatus: "active",
        });
        throw new HttpsError(
          "failed-precondition",
          "このルームは利用できません"
        );
      }

      const currentParticipants = (roomData?.participants || []) as string[];

      // 既に参加している場合はスキップ
      if (!currentParticipants.includes(userId)) {
        // 参加者数のチェック（2人まで）
        if (currentParticipants.length >= 2) {
          throw new HttpsError("resource-exhausted", "ルームが満員です");
        }

        // 参加者リストに追加
        tx.update(roomRef, {
          participants: admin.firestore.FieldValue.arrayUnion(userId),
        });
      }

      // livekitRoomIdを保存
      livekitRoomIdResult = roomData.livekitRoomId;
    });

    // livekitRoomIdの存在確認
    if (!livekitRoomIdResult) {
      logger.error("livekitRoomId not found in room data", {
        roomId,
        userId,
      });
      throw new HttpsError("internal", "LiveKitルームIDが見つかりません");
    }

    logger.info({
      message: "User joined room",
      roomId,
      userId,
    });

    return {
      roomId,
      livekitRoomId: livekitRoomIdResult!, // 232-239行目で存在確認済み
    };
  } catch (error) {
    logger.error("Error joining room:", error);
    if (error instanceof HttpsError) {
      throw error;
    }
    throw new HttpsError("internal", "ルームへの参加に失敗しました");
  }
});

/**
 * LiveKitアクセストークンの生成
 * HTTP Callable関数として公開
 */
export const generateLivekitToken = onCall(async (request) => {
  // 認証チェック
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "認証が必要です");
  }

  try {
    // request.dataのバリデーション
    if (!request.data || typeof request.data !== "object") {
      throw new HttpsError("invalid-argument", "無効なリクエストデータです");
    }

    const { roomId } = request.data as { roomId?: unknown };
    const userId = request.auth.uid;

    // roomIdのバリデーション
    if (!roomId || typeof roomId !== "string" || roomId.trim() === "") {
      throw new HttpsError("invalid-argument", "roomIdが必要です");
    }
    // ルームの存在確認と参加権限のチェック
    const roomDoc = await db.collection("rooms").doc(roomId).get();

    if (!roomDoc.exists) {
      throw new HttpsError("not-found", "ルームが見つかりません");
    }

    const roomData = roomDoc.data();
    if (!roomData) {
      throw new HttpsError("internal", "ルームデータの取得に失敗しました");
    }

    // デバッグログ: ルームデータを確認
    logger.info("generateLivekitToken - Room Data:", {
      roomId,
      userId,
      status: roomData.status,
      participants: roomData.participants,
      livekitRoomId: roomData.livekitRoomId,
    });

    const participants = Array.isArray(roomData.participants)
      ? roomData.participants
      : [];

    if (!participants.includes(userId)) {
      logger.warn("generateLivekitToken - Permission denied:", {
        roomId,
        userId,
        participants,
      });
      throw new HttpsError(
        "permission-denied",
        "このルームへの参加権限がありません"
      );
    }

    // LiveKitのアクセストークンを生成
    // 注: 環境変数からAPIキーとシークレットを読み取り
    // 本番環境とステージング環境では異なるキーを使用すること
    const livekitApiKey = process.env.LIVEKIT_API_KEY;
    const livekitApiSecret = process.env.LIVEKIT_API_SECRET;

    if (!livekitApiKey || !livekitApiSecret) {
      throw new HttpsError("failed-precondition", "LiveKitの設定が不完全です");
    }

    // トークンの有効期限を1時間に設定
    const at = new AccessToken(livekitApiKey, livekitApiSecret, {
      identity: userId,
      ttl: 3600, // 1時間（秒単位）
    });

    // 最小限の権限を付与:
    // - roomJoin: 指定されたルームへの参加
    // - canPublish: 音声・映像の送信（カメラ・マイク）
    // - canSubscribe: 他のユーザーからの音声・映像の受信
    at.addGrant({
      roomJoin: true,
      room: roomData.livekitRoomId, // 特定のルームに限定
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

  try {
    // request.dataのバリデーション
    if (!request.data || typeof request.data !== "object") {
      throw new HttpsError("invalid-argument", "無効なリクエストデータです");
    }

    const { roomId } = request.data as { roomId?: unknown };
    const userId = request.auth.uid;

    // roomIdのバリデーション
    if (!roomId || typeof roomId !== "string" || roomId.trim() === "") {
      throw new HttpsError("invalid-argument", "roomIdが必要です");
    }
    // ルームの存在確認と参加権限のチェック
    const roomDoc = await db.collection("rooms").doc(roomId).get();

    if (!roomDoc.exists) {
      throw new HttpsError("not-found", "ルームが見つかりません");
    }

    const roomData = roomDoc.data();
    if (!roomData) {
      throw new HttpsError("internal", "ルームデータの取得に失敗しました");
    }

    const participants = Array.isArray(roomData.participants)
      ? roomData.participants
      : [];

    if (!participants.includes(userId)) {
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

    return { success: true };
  } catch (error) {
    logger.error("Error ending room:", error);
    if (error instanceof HttpsError) {
      throw error;
    }
    throw new HttpsError("internal", "ルームの終了に失敗しました");
  }
});
