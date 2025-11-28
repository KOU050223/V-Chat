/**
 * 掲示板API - 投稿一覧取得・作成
 * GET /api/bulletin - 投稿一覧取得
 * POST /api/bulletin - 投稿作成
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase-admin';
import { Timestamp } from 'firebase-admin/firestore';
import {
  BulletinApiResponse,
  BulletinPost,
  CreatePostRequest,
  PostCategory,
  SortOrder,
} from '@/types/bulletin';

// GET: 投稿一覧取得
export async function GET(request: NextRequest) {
  try {
    const db = getAdminFirestore();

    const searchParams = request.nextUrl.searchParams;
    const category = searchParams.get('category') as PostCategory | null;
    const search = searchParams.get('search');
    const sortOrder = (searchParams.get('sortOrder') as SortOrder) || 'newest';

    const postsRef = db.collection('bulletin_posts');
    let q: FirebaseFirestore.Query = postsRef;

    // カテゴリフィルター
    if (category) {
      q = postsRef.where('category', '==', category);
    }

    // ソート（Firestoreクエリで実行）
    switch (sortOrder) {
      case 'popular':
        q = q.orderBy('likesCount', 'desc');
        break;
      case 'participants':
        q = q.orderBy('currentParticipants', 'asc');
        break;
      case 'newest':
      default:
        q = q.orderBy('createdAt', 'desc');
        break;
    }

    const querySnapshot = await q.get();
    let posts: BulletinPost[] = querySnapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
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
    });

    // 検索フィルター（クライアント側で実行）
    if (search) {
      const searchLower = search.toLowerCase();
      posts = posts.filter(
        (post) =>
          post.title.toLowerCase().includes(searchLower) ||
          post.content.toLowerCase().includes(searchLower) ||
          post.tags?.some((tag) => tag.toLowerCase().includes(searchLower))
      );
    }

    const response: BulletinApiResponse<BulletinPost[]> = {
      success: true,
      data: posts,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('投稿一覧取得エラー:', error);
    const response: BulletinApiResponse = {
      success: false,
      error: '投稿一覧の取得に失敗しました',
    };
    return NextResponse.json(response, { status: 500 });
  }
}

// POST: 投稿作成
export async function POST(request: NextRequest) {
  try {
    const db = getAdminFirestore();

    const body: CreatePostRequest = await request.json();

    // バリデーション
    if (!body.title || body.title.trim().length === 0) {
      const response: BulletinApiResponse = {
        success: false,
        error: 'タイトルは必須です',
      };
      return NextResponse.json(response, { status: 400 });
    }

    if (!body.content || body.content.trim().length === 0) {
      const response: BulletinApiResponse = {
        success: false,
        error: '本文は必須です',
      };
      return NextResponse.json(response, { status: 400 });
    }

    if (body.maxParticipants < 2 || body.maxParticipants > 10) {
      const response: BulletinApiResponse = {
        success: false,
        error: '募集人数は2〜10人の範囲で指定してください',
      };
      return NextResponse.json(response, { status: 400 });
    }

    if (!body.userId) {
      const response: BulletinApiResponse = {
        success: false,
        error: 'ユーザー認証が必要です',
      };
      return NextResponse.json(response, { status: 401 });
    }

    // 認証情報の取得（bodyから取得）
    const userId = body.userId;
    const userName = body.userName || 'ゲストユーザー';
    const userPhoto = body.userPhoto;

    // Firestoreに保存するデータ
    const postData: Record<string, unknown> = {
      title: body.title.trim(),
      content: body.content.trim(),
      category: body.category,
      maxParticipants: body.maxParticipants,
      currentParticipants: 0,
      authorId: userId,
      authorName: userName,
      likes: [],
      likesCount: 0,
      tags: body.tags || [],
      roomId: null,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    };

    // authorPhotoが存在する場合のみ追加
    if (userPhoto) {
      postData.authorPhoto = userPhoto;
    }

    // Firestoreに保存
    const docRef = await db.collection('bulletin_posts').add(postData);
    console.log('投稿をFirestoreに保存しました:', docRef.id);

    const createdPost: BulletinPost = {
      id: docRef.id,
      title: postData.title as string,
      content: postData.content as string,
      category: postData.category as PostCategory,
      maxParticipants: postData.maxParticipants as number,
      currentParticipants: postData.currentParticipants as number,
      authorId: postData.authorId as string,
      authorName: postData.authorName as string,
      authorPhoto: postData.authorPhoto as string | undefined,
      likes: postData.likes as string[],
      tags: postData.tags as string[],
      roomId: postData.roomId as string | undefined,
      createdAt:
        postData.createdAt instanceof Timestamp
          ? postData.createdAt.toDate()
          : new Date(),
      updatedAt:
        postData.updatedAt instanceof Timestamp
          ? postData.updatedAt.toDate()
          : new Date(),
    };

    const response: BulletinApiResponse<BulletinPost> = {
      success: true,
      data: createdPost,
      message: '投稿を作成しました',
    };

    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    console.error('投稿作成エラー:', error);
    console.error(
      'エラー詳細:',
      error instanceof Error ? error.message : String(error)
    );
    const response: BulletinApiResponse = {
      success: false,
      error:
        error instanceof Error ? error.message : '投稿の作成に失敗しました',
    };
    return NextResponse.json(response, { status: 500 });
  }
}
