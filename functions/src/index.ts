/**
 * V-Chat Firebase Cloud Functions
 * マッチング機能とLiveKit統合
 */

import { setGlobalOptions } from "firebase-functions/v2";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { defineString } from "firebase-functions/params";
import * as admin from "firebase-admin";
import { AccessToken } from "livekit-server-sdk";
import * as logger from "firebase-functions/logger";
import * as crypto from "crypto";

// Firebase Admin SDKの初期化
admin.initializeApp();

const db = admin.firestore();

// グローバル設定: コスト管理のため最大インスタンス数を制限
setGlobalOptions({ region: "us-central1", maxInstances: 10 });

// LiveKit環境変数の定義
const livekitApiKey = defineString("LIVEKIT_API_KEY");
const livekitApiSecret = defineString("LIVEKIT_API_SECRET");

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

      logger.info("createRoom - Saving room data:", {
        roomId,
        userId,
        participants: roomDataToSave.participants,
        userIdType: typeof userId,
      });

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

    logger.info("createRoom - Saved data verification:", {
      roomId,
      userId,
      savedParticipants: savedData?.participants,
      savedCreatedBy: savedData?.createdBy,
      participantsMatch: savedData?.participants?.includes(userId),
    });

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

    logger.info("joinRoom - Request received:", {
      roomId,
      userId,
      roomIdType: typeof roomId,
    });

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

    logger.info("generateLivekitToken - Request received:", {
      roomId,
      userId,
      roomIdType: typeof roomId,
    });

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
    const apiKey = livekitApiKey.value();
    const apiSecret = livekitApiSecret.value();

    if (!apiKey || !apiSecret) {
      throw new HttpsError("failed-precondition", "LiveKitの設定が不完全です");
    }

    // トークンの有効期限を1時間に設定
    const at = new AccessToken(apiKey, apiSecret, {
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
 * ルーム退出処理
 * 参加者リストから削除し、誰もいなくなったら終了する
 */
export const leaveRoom = onCall(async (request) => {
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

    const roomRef = db.collection("rooms").doc(roomId);

    await db.runTransaction(async (tx) => {
      const roomDoc = await tx.get(roomRef);

      if (!roomDoc.exists) {
        throw new HttpsError("not-found", "ルームが見つかりません");
      }

      const roomData = roomDoc.data();
      if (!roomData) {
        throw new HttpsError("internal", "ルームデータの取得に失敗しました");
      }

      const participants = Array.isArray(roomData.participants)
        ? (roomData.participants as string[])
        : [];

      // 参加していない場合は何もしない（成功扱い）
      if (!participants.includes(userId)) {
        return;
      }

      // 参加者リストから削除
      const newParticipants = participants.filter((p) => p !== userId);

      if (newParticipants.length === 0) {
        // 誰もいなくなったら終了
        tx.update(roomRef, {
          participants: newParticipants,
          status: "ended",
          endedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      } else {
        // まだ人がいる場合はリスト更新のみ
        tx.update(roomRef, {
          participants: newParticipants,
        });
      }
    });

    return { success: true };
  } catch (error) {
    logger.error("Error leaving room:", error);
    if (error instanceof HttpsError) {
      throw error;
    }
    throw new HttpsError("internal", "ルームからの退出に失敗しました");
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

/**
 * マッチング待機列のアイテム定義
 */
interface MatchingQueueItem {
  id: string;
  userId: string;
  [key: string]: unknown;
}

/**
 * マッチング待機列への参加・検索
 * HTTP Callable関数として公開
 */
export const findMatch = onCall(async (request) => {
  // 認証チェック
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "認証が必要です");
  }

  const userId = request.auth.uid;
  const db = admin.firestore();
  const queueRef = db.collection("matching_queue");

  try {
    // 1. 既に待機中のユーザーを探す（自分以外）
    // 古い待機ユーザー（例: 5分以上経過）は除外するクエリなどが望ましいが、
    // ここではシンプルに created_at でソートして古い順に取得
    const snapshot = await queueRef
      .where("userId", "!=", userId)
      .orderBy("userId") // whereとorderByのフィールドが異なると複合インデックスが必要になるため、一旦userIdでソート（実際はランダム性が欲しい）
      // Firestoreの制約: 不等号フィルタを使用したフィールドで最初の並べ替えを行う必要がある
      // そのため、単純なクエリでは「自分以外」かつ「古い順」は難しい。
      // ここでは「自分以外」を優先し、クライアント側またはメモリ上でフィルタリングするか、
      // 別のステータス管理を行う。
      // 簡易実装として、limit(10)で取得してメモリ上で選ぶ。
      .limit(10)
      .get();

    let matchPartner: MatchingQueueItem | null = null;

    // 有効なパートナーを探す（トランザクション外で検索）
    for (const doc of snapshot.docs) {
      const data = doc.data();
      // 自身のIDと異なることはクエリで保証されているが念のため
      // また、既にマッチング成立済みのものが残っている可能性も考慮（本来は削除されるべき）
      if (data.userId !== userId) {
        matchPartner = { id: doc.id, ...data } as MatchingQueueItem;
        break;
      }
    }

    if (matchPartner) {
      // 2. マッチング成立処理（トランザクション）
      return await db.runTransaction(async (tx) => {
        // パートナーがまだ待機中か確認
        const partnerDocRef = queueRef.doc(matchPartner.id);
        const partnerDoc = await tx.get(partnerDocRef);

        if (!partnerDoc.exists) {
          // パートナーが居なくなっていた場合（タッチの差でマッチング済み or キャンセル）
          // 今回は諦めて待機列に追加するフローへ（リトライさせても良い）
          throw new Error("Partner unavailable");
        }

        // ルームを作成
        const roomId = crypto.randomBytes(6).readUIntBE(0, 6).toString(36).substring(0, 8).toUpperCase();
        const livekitRoomId = `livekit_${roomId}_${Date.now()}`;

        const roomData = {
          roomId,
          name: "Matching Room",
          description: "Random matching",
          isPrivate: true,
          createdBy: "system",
          participants: [userId, matchPartner.userId],
          status: "active",
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          livekitRoomId,
        };

        // ルーム保存
        tx.set(db.collection("rooms").doc(roomId), roomData);

        // 待機列からパートナーを削除
        tx.delete(partnerDocRef);

        // 自分も待機列に居たら削除（念のため）
        tx.delete(queueRef.doc(userId));

        // パートナーへの通知（FirestoreのUserドキュメントなどを更新して通知する仕組みが必要だが、
        // ここでは待機列ドキュメントに結果を書き込む方式を採用する手もある。
        // しかし、待機列ドキュメントを削除してしまうと通知できない。
        // 解決策: 待機列ドキュメントを削除せず、status="matched" に更新し、roomIdを含める。
        // クライアントはそれを監視してルームに遷移する。）

        // 訂正: パートナーのドキュメントを更新して通知
        // deleteではなくupdate
        tx.update(partnerDocRef, {
          status: "matched",
          roomId,
          matchedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        return {
          status: "matched",
          roomId,
          partnerId: matchPartner.userId
        };
      });

    } else {
      // 3. 待機列に追加（マッチ相手が見つからなかった場合）
      // 自分の待機ドキュメントを作成/更新
      await queueRef.doc(userId).set({
        userId,
        status: "waiting",
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      return {
        status: "waiting",
        message: "待機列に追加しました"
      };
    }

  } catch (error) {
    // トランザクション失敗（パートナーが取られたなど）の場合も、
    // 基本的には待機列に追加して待つようにする
    logger.warn("Matching transaction failed or partner unavailable, adding to queue:", error);

    await queueRef.doc(userId).set({
      userId,
      status: "waiting",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return {
      status: "waiting",
      message: "待機列に追加しました"
    };
  }
});

/**
 * マッチングキャンセル
 */
export const cancelMatch = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "認証が必要です");
  }
  const userId = request.auth.uid;
  const db = admin.firestore();

  await db.collection("matching_queue").doc(userId).delete();

  return { success: true };
});
