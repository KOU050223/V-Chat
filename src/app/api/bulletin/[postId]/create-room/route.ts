/**
 * 掲示板API - ルーム作成
 * POST /api/bulletin/[postId]/create-room - 投稿からルームを作成
 */

import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth-helpers";
import { BulletinApiResponse, BulletinPost } from "@/types/bulletin";
import { getAdminFirestore } from "@/lib/firebase-admin";
import { Timestamp } from "firebase-admin/firestore";

interface BulletinCreateRoomData {
  roomId: string;
  post: BulletinPost;
}

// BulletinPost構築ヘルパー（重複を避ける）
function buildBulletinPost(
  docId: string,
  data: FirebaseFirestore.DocumentData
): BulletinPost {
  return {
    id: docId,
    title: data.title,
    content: data.content,
    category: data.category,
    maxParticipants: data.maxParticipants,
    currentParticipants: data.currentParticipants,
    authorId: data.authorId,
    authorName: data.authorName,
    authorPhoto: data.authorPhoto,
    likes: data.likes || [],
    tags: data.tags || [],
    roomId: data.roomId,
    createdAt: data.createdAt?.toDate() || new Date(),
    updatedAt: data.updatedAt?.toDate() || new Date(),
  };
}

// POST: ルーム作成
export async function POST(
  request: NextRequest,
  props: { params: Promise<{ postId: string }> }
) {
  try {
    const params = await props.params;
    const { postId } = params;

    // 認証確認（NextAuth または Firebase ID トークン）
    const authResult = await authenticateRequest(request);
    if (!authResult.authenticated || !authResult.userId) {
      const response: BulletinApiResponse = {
        success: false,
        error: authResult.error || "認証が必要です",
      };
      return NextResponse.json(response, { status: 401 });
    }
    const userId = authResult.userId;
    const db = getAdminFirestore();

    // Firestoreトランザクションで原子的にroomIdを設定
    const result = await db.runTransaction(async (transaction) => {
      const postRef = db.collection("bulletin_posts").doc(postId);
      const postDoc = await transaction.get(postRef);

      // 投稿の存在確認
      if (!postDoc.exists) {
        throw new Error("投稿が見つかりません");
      }

      const postData = postDoc.data();
      if (!postData) {
        throw new Error("投稿データの取得に失敗しました");
      }

      // 投稿者確認
      if (postData.authorId !== userId) {
        throw new Error("ルームを作成する権限がありません");
      }

      // すでにルームが作成されている場合
      if (postData.roomId) {
        return {
          roomId: postData.roomId,
          post: buildBulletinPost(postDoc.id, postData),
          isNew: false,
        };
      }

      // ルームID生成
      const roomId = `room_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

      // トランザクション内で更新
      transaction.update(postRef, {
        roomId,
        updatedAt: Timestamp.now(),
      });

      // 更新後のデータを構築
      const updatedData = {
        ...postData,
        roomId,
        updatedAt: Timestamp.now(),
      };

      return {
        roomId,
        post: buildBulletinPost(postDoc.id, updatedData),
        isNew: true,
      };
    });

    const response: BulletinApiResponse<BulletinCreateRoomData> = {
      success: true,
      data: {
        roomId: result.roomId,
        post: result.post,
      },
      message: result.isNew
        ? "ルームを作成しました"
        : "すでにルームが作成されています",
    };

    return NextResponse.json(
      response,
      result.isNew ? { status: 201 } : undefined
    );
  } catch (error) {
    console.error("ルーム作成エラー:", error);

    // エラーメッセージに応じてステータスコードを設定
    const errorMessage =
      error instanceof Error ? error.message : "ルームの作成に失敗しました";
    let statusCode = 500;

    if (errorMessage === "投稿が見つかりません") {
      statusCode = 404;
    } else if (errorMessage === "ルームを作成する権限がありません") {
      statusCode = 403;
    }

    const response: BulletinApiResponse = {
      success: false,
      error: errorMessage,
    };
    return NextResponse.json(response, { status: statusCode });
  }
}
