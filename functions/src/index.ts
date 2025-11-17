/**
 * V-Chat Firebase Cloud Functions
 * マッチング機能とLiveKit統合
 */

import { setGlobalOptions } from 'firebase-functions/v2';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { AccessToken } from 'livekit-server-sdk';
import * as logger from 'firebase-functions/logger';

// Firebase Admin SDKの初期化
admin.initializeApp();

const db = admin.firestore();

// グローバル設定: コスト管理のため最大インスタンス数を制限
setGlobalOptions({ maxInstances: 10 });

/**
 * ルーム作成
 * HTTP Callable関数として公開
 */
export const createRoom = onCall(async (request) => {
    // 認証チェック
    if (!request.auth) {
        throw new HttpsError('unauthenticated', '認証が必要です');
    }

    const { name, description, isPrivate } = request.data;
    const userId = request.auth.uid;

    // バリデーション
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
        throw new HttpsError('invalid-argument', 'ルーム名が必要です');
    }

    try {
        // 短いルームIDを生成（6文字の英数字）
        const generateShortId = () => {
            return Math.random().toString(36).substring(2, 8).toUpperCase();
        };

        let roomId = generateShortId();
        let attempts = 0;
        const maxAttempts = 5;

        // IDの重複を確認
        while (attempts < maxAttempts) {
            const existingRoom = await db.collection('rooms').doc(roomId).get();
            if (!existingRoom.exists) {
                break;
            }
            roomId = generateShortId();
            attempts++;
        }

        if (attempts >= maxAttempts) {
            throw new HttpsError('internal', 'ルームIDの生成に失敗しました');
        }

        // LiveKitのルームIDを生成
        const livekitRoomId = `livekit_${roomId}_${Date.now()}`;

        // ルームを作成
        const roomData = {
            roomId,
            name: name.trim(),
            description: description?.trim() || '',
            isPrivate: isPrivate || false,
            createdBy: userId,
            participants: [userId],
            status: 'active',
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            livekitRoomId,
        };

        await db.collection('rooms').doc(roomId).set(roomData);

        logger.info({
            message: 'Room created',
            roomId,
            userId,
        });

        return roomData;
    } catch (error) {
        logger.error('Error creating room:', error);
        if (error instanceof HttpsError) {
            throw error;
        }
        throw new HttpsError('internal', 'ルームの作成に失敗しました');
    }
});

/**
 * ルーム参加
 * HTTP Callable関数として公開
 */
export const joinRoom = onCall(async (request) => {
    // 認証チェック
    if (!request.auth) {
        throw new HttpsError('unauthenticated', '認証が必要です');
    }

    const { roomId } = request.data;
    const userId = request.auth.uid;

    // roomIdのバリデーション
    if (!roomId || typeof roomId !== 'string') {
        throw new HttpsError('invalid-argument', 'roomIdが必要です');
    }

    try {
        // ルームの存在確認
        const roomRef = db.collection('rooms').doc(roomId);
        const roomDoc = await roomRef.get();

        if (!roomDoc.exists) {
            throw new HttpsError('not-found', 'ルームが見つかりません');
        }

        const roomData = roomDoc.data();

        if (roomData?.status !== 'active') {
            throw new HttpsError(
                'failed-precondition',
                'このルームは利用できません'
            );
        }

        // 参加者数のチェック（2人まで）
        const currentParticipants = roomData?.participants || [];
        if (
            currentParticipants.length >= 2 &&
            !currentParticipants.includes(userId)
        ) {
            throw new HttpsError('resource-exhausted', 'ルームが満員です');
        }

        // 参加者リストに追加（まだ追加されていない場合）
        if (!currentParticipants.includes(userId)) {
            await roomRef.update({
                participants: admin.firestore.FieldValue.arrayUnion(userId),
            });
        }

        logger.info({
            message: 'User joined room',
            roomId,
            userId,
        });

        return {
            roomId,
            livekitRoomId: roomData.livekitRoomId,
        };
    } catch (error) {
        logger.error('Error joining room:', error);
        if (error instanceof HttpsError) {
            throw error;
        }
        throw new HttpsError('internal', 'ルームへの参加に失敗しました');
    }
});

/**
 * LiveKitアクセストークンの生成
 * HTTP Callable関数として公開
 */
export const generateLivekitToken = onCall(async (request) => {
    // 認証チェック
    if (!request.auth) {
        throw new HttpsError('unauthenticated', '認証が必要です');
    }

    const { roomId } = request.data;
    const userId = request.auth.uid;

    // roomIdのバリデーション
    if (!roomId || typeof roomId !== 'string') {
        throw new HttpsError('invalid-argument', 'roomIdが必要です');
    }

    try {
        // ルームの存在確認と参加権限のチェック
        const roomDoc = await db.collection('rooms').doc(roomId).get();

        if (!roomDoc.exists) {
            throw new HttpsError('not-found', 'ルームが見つかりません');
        }

        const roomData = roomDoc.data();
        if (!roomData?.participants.includes(userId)) {
            throw new HttpsError(
                'permission-denied',
                'このルームへの参加権限がありません'
            );
        }

        // LiveKitのアクセストークンを生成
        const livekitApiKey = process.env.LIVEKIT_API_KEY;
        const livekitApiSecret = process.env.LIVEKIT_API_SECRET;

        if (!livekitApiKey || !livekitApiSecret) {
            throw new HttpsError(
                'failed-precondition',
                'LiveKitの設定が不完全です'
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
        logger.error('Error generating LiveKit token:', error);
        if (error instanceof HttpsError) {
            throw error;
        }
        throw new HttpsError('internal', 'トークンの生成に失敗しました');
    }
});

/**
 * ルーム終了処理
 */
export const endRoom = onCall(async (request) => {
    // 認証チェック
    if (!request.auth) {
        throw new HttpsError('unauthenticated', '認証が必要です');
    }

    const { roomId } = request.data;
    const userId = request.auth.uid;

    try {
        // ルームの存在確認と参加権限のチェック
        const roomDoc = await db.collection('rooms').doc(roomId).get();

        if (!roomDoc.exists) {
            throw new HttpsError('not-found', 'ルームが見つかりません');
        }

        const roomData = roomDoc.data();
        if (!roomData?.participants.includes(userId)) {
            throw new HttpsError(
                'permission-denied',
                'このルームへの権限がありません'
            );
        }

        // ルームを終了状態に更新
        await roomDoc.ref.update({
            status: 'ended',
            endedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        return { success: true };
    } catch (error) {
        logger.error('Error ending room:', error);
        if (error instanceof HttpsError) {
            throw error;
        }
        throw new HttpsError('internal', 'ルームの終了に失敗しました');
    }
});
