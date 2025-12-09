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

    // 投稿の存在確認
    const postDoc = await db.collection("bulletin_posts").doc(postId).get();
    if (!postDoc.exists) {
      const response: BulletinApiResponse = {
        success: false,
        error: "投稿が見つかりません",
      };
      return NextResponse.json(response, { status: 404 });
    }

    const postData = postDoc.data();
    if (!postData) {
      const response: BulletinApiResponse = {
        success: false,
        error: "投稿データの取得に失敗しました",
      };
      return NextResponse.json(response, { status: 500 });
    }

    // 投稿者確認
    if (postData.authorId !== userId) {
      const response: BulletinApiResponse = {
        success: false,
        error: "ルームを作成する権限がありません",
      };
      return NextResponse.json(response, { status: 403 });
    }

    // すでにルームが作成されている場合
    if (postData.roomId) {
      const post: BulletinPost = {
        id: postDoc.id,
        title: postData.title,
        content: postData.content,
        category: postData.category,
        maxParticipants: postData.maxParticipants,
        currentParticipants: postData.currentParticipants,
        authorId: postData.authorId,
        authorName: postData.authorName,
        authorPhoto: postData.authorPhoto,
        likes: postData.likes || [],
        tags: postData.tags || [],
        roomId: postData.roomId,
        createdAt: postData.createdAt?.toDate() || new Date(),
        updatedAt: postData.updatedAt?.toDate() || new Date(),
      };

      const response: BulletinApiResponse<BulletinCreateRoomData> = {
        success: true,
        data: {
          roomId: postData.roomId,
          post,
        },
        message: "すでにルームが作成されています",
      };
      return NextResponse.json(response);
    }

    // ルームID生成（実際のマッチングシステムと連携する）
    const roomId = `room_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    // Firestoreに永続化
    await db.collection("bulletin_posts").doc(postId).update({
      roomId,
      updatedAt: Timestamp.now(),
    });

    // 更新後の投稿データを取得
    const updatedPostDoc = await db
      .collection("bulletin_posts")
      .doc(postId)
      .get();
    const updatedPostData = updatedPostDoc.data();

    const updatedPost: BulletinPost = {
      id: postDoc.id,
      title: updatedPostData?.title || postData.title,
      content: updatedPostData?.content || postData.content,
      category: updatedPostData?.category || postData.category,
      maxParticipants:
        updatedPostData?.maxParticipants || postData.maxParticipants,
      currentParticipants:
        updatedPostData?.currentParticipants || postData.currentParticipants,
      authorId: updatedPostData?.authorId || postData.authorId,
      authorName: updatedPostData?.authorName || postData.authorName,
      authorPhoto: updatedPostData?.authorPhoto || postData.authorPhoto,
      likes: updatedPostData?.likes || postData.likes || [],
      tags: updatedPostData?.tags || postData.tags || [],
      roomId,
      createdAt:
        updatedPostData?.createdAt?.toDate() ||
        postData.createdAt?.toDate() ||
        new Date(),
      updatedAt: new Date(),
    };

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
