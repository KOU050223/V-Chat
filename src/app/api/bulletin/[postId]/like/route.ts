/**
 * 掲示板API - いいね機能
 * POST /api/bulletin/[postId]/like - いいね追加/削除
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebaseConfig';
import {
  doc,
  getDoc,
  updateDoc,
  arrayUnion,
  arrayRemove,
  increment,
  Timestamp,
} from 'firebase/firestore';
import { BulletinApiResponse, BulletinPost } from '@/types/bulletin';

interface RouteContext {
  params: Promise<{
    postId: string;
  }>;
}

// POST: いいね追加/削除
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    if (!db) {
      throw new Error('Firestore is not initialized');
    }

    const { postId } = await context.params;

    // 認証情報の取得
    const userId = request.headers.get('x-user-id') || 'anonymous';

    const docRef = doc(db, 'bulletin_posts', postId);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      const response: BulletinApiResponse = {
        success: false,
        error: '投稿が見つかりません',
      };
      return NextResponse.json(response, { status: 404 });
    }

    const data = docSnap.data();
    const likes = data.likes || [];
    const isLiked = likes.includes(userId);

    // いいね切り替え
    if (isLiked) {
      // いいね解除
      await updateDoc(docRef, {
        likes: arrayRemove(userId),
        likesCount: increment(-1),
        updatedAt: Timestamp.now(),
      });
    } else {
      // いいね追加
      await updateDoc(docRef, {
        likes: arrayUnion(userId),
        likesCount: increment(1),
        updatedAt: Timestamp.now(),
      });
    }

    // 更新後のデータを取得
    const updatedDocSnap = await getDoc(docRef);
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

    const message = isLiked ? 'いいねを解除しました' : 'いいねしました';

    const response: BulletinApiResponse<BulletinPost> = {
      success: true,
      data: updatedPost,
      message,
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
