/**
 * 掲示板API - ルーム作成
 * POST /api/bulletin/[postId]/create-room - 投稿からルームを作成
 */

import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth-helpers";
import { bulletinStore } from "@/lib/bulletinStore";
import { BulletinApiResponse, BulletinPost } from "@/types/bulletin";
import { adminDb } from "@/lib/firebase-admin";

interface BulletinCreateRoomData {
  roomId: string;
  post: BulletinPost;
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

    // 投稿の存在確認
    const post = bulletinStore.getPostById(postId);
    if (!post) {
      const response: BulletinApiResponse = {
        success: false,
        error: "投稿が見つかりません",
      };
      return NextResponse.json(response, { status: 404 });
    }

    // 投稿者確認
    if (post.authorId !== userId) {
      const response: BulletinApiResponse = {
        success: false,
        error: "ルームを作成する権限がありません",
      };
      return NextResponse.json(response, { status: 403 });
    }

    // すでにルームが作成されている場合
    if (post.roomId) {
      const response: BulletinApiResponse<BulletinCreateRoomData> = {
        success: true,
        data: {
          roomId: post.roomId,
          post,
        },
        message: "すでにルームが作成されています",
      };
      return NextResponse.json(response);
    }

    // ルームID生成（実際のマッチングシステムと連携する）
    const roomId = `room_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    // 投稿にルームIDを設定（インメモリストア）
    const updatedPost = bulletinStore.setPostRoom(postId, roomId);

    if (!updatedPost) {
      const response: BulletinApiResponse = {
        success: false,
        error: "投稿が見つかりません",
      };
      return NextResponse.json(response, { status: 404 });
    }

    // Firestoreにも永続化
    try {
      await adminDb.collection("bulletin_posts").doc(postId).update({
        roomId,
        updatedAt: new Date(),
      });
    } catch (firestoreError) {
      console.error("Firestore更新エラー:", firestoreError);
      // Firestoreへの保存が失敗しても、インメモリストアは更新済みなので続行
      // 本番環境ではこのエラーを適切に処理する必要がある
    }

    const response: BulletinApiResponse<BulletinCreateRoomData> = {
      success: true,
      data: {
        roomId,
        post: updatedPost,
      },
      message: "ルームを作成しました",
    };

    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    console.error("ルーム作成エラー:", error);
    const response: BulletinApiResponse = {
      success: false,
      error: "ルームの作成に失敗しました",
    };
    return NextResponse.json(response, { status: 500 });
  }
}
