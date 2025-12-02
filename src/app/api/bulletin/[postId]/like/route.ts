/**
 * 掲示板API - いいね機能
 * POST /api/bulletin/[postId]/like - いいねをつける/外す
 */

import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth-helpers";
import { getAdminFirestore } from "@/lib/firebase-admin";
import { Timestamp, FieldValue } from "firebase-admin/firestore";
import { BulletinApiResponse, BulletinPost } from "@/types/bulletin";

interface RouteContext {
  params: {
    postId: string;
  };
}

// POST: いいねをつける/外す
export async function POST(request: NextRequest, { params }: RouteContext) {
  try {
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
    const { postId } = params;
    const docRef = db.collection("bulletin_posts").doc(postId);

    // Firestore トランザクションを使用して競合状態を回避
    const result = await db.runTransaction(async (transaction) => {
      const docSnap = await transaction.get(docRef);

      if (!docSnap.exists) {
        throw new Error("POST_NOT_FOUND");
      }

      const postData = docSnap.data()!;
      const likes: string[] = postData.likes || [];
      const isLiked = likes.includes(userId);

      // トランザクション内でいいねの追加/削除を実行
      if (isLiked) {
        // いいね解除
        transaction.update(docRef, {
          likes: FieldValue.arrayRemove(userId),
          likesCount: FieldValue.increment(-1),
          updatedAt: Timestamp.now(),
        });
        return { isLiked: false, message: "いいねを解除しました" };
      } else {
        // いいね追加
        transaction.update(docRef, {
          likes: FieldValue.arrayUnion(userId),
          likesCount: FieldValue.increment(1),
          updatedAt: Timestamp.now(),
        });
        return { isLiked: true, message: "いいねしました" };
      }
    });

    // トランザクション完了後にデータを取得
    const updatedDocSnap = await docRef.get();
    if (!updatedDocSnap.exists) {
      const response: BulletinApiResponse = {
        success: false,
        error: "投稿が見つかりません",
      };
      return NextResponse.json(response, { status: 404 });
    }
    const updatedData = updatedDocSnap.data()!;

    const updatedPost: BulletinPost = {
      id: updatedDocSnap.id,
      title: updatedData.title,
      content: updatedData.content,
      category: updatedData.category,
      maxParticipants: updatedData.maxParticipants,
      currentParticipants: updatedData.currentParticipants,
      authorId: updatedData.authorId,
      authorName: updatedData.authorName,
      authorPhoto: updatedData.authorPhoto,
      likes: updatedData.likes || [],
      tags: updatedData.tags || [],
      roomId: updatedData.roomId,
      createdAt: updatedData.createdAt?.toDate() || new Date(),
      updatedAt: updatedData.updatedAt?.toDate() || new Date(),
    };

    const response: BulletinApiResponse<BulletinPost> = {
      success: true,
      data: updatedPost,
      message: result.message,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("いいね処理エラー:", error);

    // 投稿が見つからない場合の特別なエラー処理
    if (error instanceof Error && error.message === "POST_NOT_FOUND") {
      const response: BulletinApiResponse = {
        success: false,
        error: "投稿が見つかりません",
      };
      return NextResponse.json(response, { status: 404 });
    }

    const response: BulletinApiResponse = {
      success: false,
      error: "いいね処理に失敗しました",
    };
    return NextResponse.json(response, { status: 500 });
  }
}
