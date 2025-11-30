/**
 * 掲示板API - いいね機能
 * POST /api/bulletin/[postId]/like - いいねをつける/外す
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase-admin';
import { Timestamp, FieldValue } from 'firebase-admin/firestore';
import { BulletinApiResponse, BulletinPost } from '@/types/bulletin';

interface RouteContext {
  params: Promise<{
    postId: string;
  }>;
}

// POST: いいねをつける/外す
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const db = getAdminFirestore();
    const { postId } = await context.params;
    const body = await request.json();

    // 認証確認
    if (!body.userId) {
      const response: BulletinApiResponse = {
        success: false,
        error: 'ユーザー認証が必要です',
      };
      return NextResponse.json(response, { status: 401 });
    }

    const userId = body.userId;
    const docRef = db.collection('bulletin_posts').doc(postId);
    const docSnap = await docRef.get();

    if (!docSnap.exists) {
      const response: BulletinApiResponse = {
        success: false,
        error: '投稿が見つかりません',
      };
      return NextResponse.json(response, { status: 404 });
    }

    const postData = docSnap.data()!;
    const likes: string[] = postData.likes || [];
    const isLiked = likes.includes(userId);

    // いいねの追加/削除
    if (isLiked) {
      // いいね解除
      await docRef.update({
        likes: FieldValue.arrayRemove(userId),
        likesCount: FieldValue.increment(-1),
        updatedAt: Timestamp.now(),
      });
    } else {
      // いいね追加
      await docRef.update({
        likes: FieldValue.arrayUnion(userId),
        likesCount: FieldValue.increment(1),
        updatedAt: Timestamp.now(),
      });
    }

    // 更新後のデータを取得
    const updatedDocSnap = await docRef.get();
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
      message: isLiked ? 'いいねを解除しました' : 'いいねしました',
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('いいね処理エラー:', error);
    const response: BulletinApiResponse = {
      success: false,
      error: 'いいね処理に失敗しました',
    };
    return NextResponse.json(response, { status: 500 });
  }
}
