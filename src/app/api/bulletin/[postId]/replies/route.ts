/**
 * 掲示板API - 返信取得・作成
 * GET /api/bulletin/[postId]/replies - 返信一覧取得
 * POST /api/bulletin/[postId]/replies - 返信作成
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebaseConfig';
import {
  collection,
  addDoc,
  getDocs,
  query,
  where,
  orderBy,
  doc,
  getDoc,
  Timestamp,
} from 'firebase/firestore';
import {
  BulletinApiResponse,
  BulletinReply,
  CreateReplyRequest,
} from '@/types/bulletin';

interface RouteContext {
  params: Promise<{
    postId: string;
  }>;
}

// GET: 返信一覧取得
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    console.log('返信一覧取得API開始');

    if (!db) {
      throw new Error('Firestore is not initialized');
    }

    const { postId } = await context.params;
    console.log('取得対象のpostId:', postId);

    // 投稿の存在確認
    const postDocRef = doc(db, 'bulletin_posts', postId);
    const postDocSnap = await getDoc(postDocRef);

    if (!postDocSnap.exists()) {
      console.error('投稿が見つかりません:', postId);
      const response: BulletinApiResponse = {
        success: false,
        error: '投稿が見つかりません',
      };
      return NextResponse.json(response, { status: 404 });
    }

    console.log('投稿が見つかりました');

    // 返信を取得
    const repliesRef = collection(db, 'bulletin_replies');
    console.log('返信コレクションを取得');

    // Firestoreのインデックスエラーを回避するため、orderByなしで取得
    const q = query(repliesRef, where('postId', '==', postId));
    console.log('クエリを実行します');

    const querySnapshot = await getDocs(q);
    console.log('取得された返信数:', querySnapshot.size);

    let replies: BulletinReply[] = querySnapshot.docs.map((doc) => {
      const data = doc.data();
      console.log('返信ドキュメント:', doc.id, data);
      return {
        id: doc.id,
        postId: data.postId,
        content: data.content,
        authorId: data.authorId,
        authorName: data.authorName,
        authorPhoto: data.authorPhoto,
        createdAt: data.createdAt?.toDate() || new Date(),
        updatedAt: data.updatedAt?.toDate() || new Date(),
      };
    });

    // クライアント側でソート
    replies = replies.sort(
      (a, b) => a.createdAt.getTime() - b.createdAt.getTime()
    );

    console.log('変換後の返信データ:', replies);

    const response: BulletinApiResponse<BulletinReply[]> = {
      success: true,
      data: replies,
    };

    console.log('レスポンスを返します');

    return NextResponse.json(response);
  } catch (error: any) {
    console.error('返信一覧取得エラー:', error);

    // コレクションが存在しない場合は空の配列を返す
    if (
      error.code === 'failed-precondition' ||
      error.message?.includes('index')
    ) {
      const response: BulletinApiResponse<BulletinReply[]> = {
        success: true,
        data: [],
      };
      return NextResponse.json(response);
    }

    const response: BulletinApiResponse = {
      success: false,
      error: '返信の取得に失敗しました',
    };
    return NextResponse.json(response, { status: 500 });
  }
}

// POST: 返信作成
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    if (!db) {
      throw new Error('Firestore is not initialized');
    }

    const { postId } = await context.params;
    const body: CreateReplyRequest = await request.json();

    // 投稿の存在確認
    const postDocRef = doc(db, 'bulletin_posts', postId);
    const postDocSnap = await getDoc(postDocRef);

    if (!postDocSnap.exists()) {
      const response: BulletinApiResponse = {
        success: false,
        error: '投稿が見つかりません',
      };
      return NextResponse.json(response, { status: 404 });
    }

    // バリデーション
    if (!body.content || body.content.trim().length === 0) {
      const response: BulletinApiResponse = {
        success: false,
        error: '返信内容は必須です',
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

    // Firestoreに保存するデータ（undefinedフィールドを除外）
    const replyData: any = {
      postId,
      content: body.content.trim(),
      authorId: userId,
      authorName: userName,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    };

    // authorPhotoが存在する場合のみ追加
    if (userPhoto) {
      replyData.authorPhoto = userPhoto;
    }

    // Firestoreに保存
    const docRef = await addDoc(collection(db, 'bulletin_replies'), replyData);
    console.log('返信をFirestoreに保存しました:', docRef.id);

    const createdReply: BulletinReply = {
      id: docRef.id,
      ...replyData,
      createdAt: replyData.createdAt.toDate(),
      updatedAt: replyData.updatedAt.toDate(),
    };

    const response: BulletinApiResponse<BulletinReply> = {
      success: true,
      data: createdReply,
      message: '返信を投稿しました',
    };

    return NextResponse.json(response, { status: 201 });
  } catch (error: any) {
    console.error('返信作成エラー:', error);
    console.error('エラー詳細:', error.message, error.stack);
    const response: BulletinApiResponse = {
      success: false,
      error: '返信の投稿に失敗しました',
    };
    return NextResponse.json(response, { status: 500 });
  }
}
