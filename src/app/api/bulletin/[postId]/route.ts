/**
 * 掲示板API - 投稿詳細取得・更新・削除
 * GET /api/bulletin/[postId] - 投稿詳細取得
 * PATCH /api/bulletin/[postId] - 投稿更新
 * DELETE /api/bulletin/[postId] - 投稿削除
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase-admin';
import { Timestamp } from 'firebase-admin/firestore';
import {
  BulletinApiResponse,
  BulletinPost,
  UpdatePostRequest,
} from '@/types/bulletin';

interface RouteContext {
  params: Promise<{
    postId: string;
  }>;
}

// GET: 投稿詳細取得
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const db = getAdminFirestore();
    const { postId } = await context.params;
    const docRef = db.collection('bulletin_posts').doc(postId);
    const docSnap = await docRef.get();

    if (!docSnap.exists) {
      const response: BulletinApiResponse = {
        success: false,
        error: '投稿が見つかりません',
      };
      return NextResponse.json(response, { status: 404 });
    }

    const data = docSnap.data()!;
    const post: BulletinPost = {
      id: docSnap.id,
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

    const response: BulletinApiResponse<BulletinPost> = {
      success: true,
      data: post,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('投稿詳細取得エラー:', error);
    const response: BulletinApiResponse = {
      success: false,
      error: '投稿の取得に失敗しました',
    };
    return NextResponse.json(response, { status: 500 });
  }
}

// PATCH: 投稿更新
export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const db = getAdminFirestore();
    const { postId } = await context.params;
    const body: UpdatePostRequest = await request.json();

    // バリデーション
    if (
      body.maxParticipants !== undefined &&
      (body.maxParticipants < 2 || body.maxParticipants > 10)
    ) {
      const response: BulletinApiResponse = {
        success: false,
        error: '募集人数は2〜10人の範囲で指定してください',
      };
      return NextResponse.json(response, { status: 400 });
    }

    // 認証情報の取得
    const userId = request.headers.get('x-user-id') || 'anonymous';
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

    // 投稿者確認
    if (postData.authorId !== userId) {
      const response: BulletinApiResponse = {
        success: false,
        error: '投稿を更新する権限がありません',
      };
      return NextResponse.json(response, { status: 403 });
    }

    // 更新データ
    const updateData: {
      updatedAt: Timestamp;
      title?: string;
      content?: string;
      category?: string;
      maxParticipants?: number;
      tags?: string[];
    } = {
      updatedAt: Timestamp.now(),
    };

    if (body.title) updateData.title = body.title;
    if (body.content) updateData.content = body.content;
    if (body.category) updateData.category = body.category;
    if (body.maxParticipants) updateData.maxParticipants = body.maxParticipants;
    if (body.tags) updateData.tags = body.tags;

    // Firestoreを更新
    await docRef.update(updateData);

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
      message: '投稿を更新しました',
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('投稿更新エラー:', error);
    const response: BulletinApiResponse = {
      success: false,
      error: '投稿の更新に失敗しました',
    };
    return NextResponse.json(response, { status: 500 });
  }
}

// DELETE: 投稿削除
export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const db = getAdminFirestore();
    const { postId } = await context.params;

    // 認証情報の取得
    const userId = request.headers.get('x-user-id') || 'anonymous';
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

    // 投稿者確認
    if (postData.authorId !== userId) {
      const response: BulletinApiResponse = {
        success: false,
        error: '投稿を削除する権限がありません',
      };
      return NextResponse.json(response, { status: 403 });
    }

    // Firestoreから削除
    await docRef.delete();

    const response: BulletinApiResponse = {
      success: true,
      message: '投稿を削除しました',
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('投稿削除エラー:', error);
    const response: BulletinApiResponse = {
      success: false,
      error: '投稿の削除に失敗しました',
    };
    return NextResponse.json(response, { status: 500 });
  }
}
