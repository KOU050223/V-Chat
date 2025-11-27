/**
 * 掲示板API - ルーム作成
 * POST /api/bulletin/[postId]/create-room - 投稿からルームを作成
 */

import { NextRequest, NextResponse } from 'next/server';
import { bulletinStore } from '@/lib/bulletinStore';
import { BulletinApiResponse, BulletinPost } from '@/types/bulletin';

interface RouteContext {
  params: Promise<{
    postId: string;
  }>;
}

interface CreateRoomResponse {
  roomId: string;
  post: BulletinPost;
}

// POST: ルーム作成
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { postId } = await context.params;

    // 投稿の存在確認
    const post = bulletinStore.getPostById(postId);
    if (!post) {
      const response: BulletinApiResponse = {
        success: false,
        error: '投稿が見つかりません',
      };
      return NextResponse.json(response, { status: 404 });
    }

    // 認証情報の取得
    const userId = request.headers.get('x-user-id') || 'anonymous';

    // 投稿者確認
    if (post.authorId !== userId) {
      const response: BulletinApiResponse = {
        success: false,
        error: 'ルームを作成する権限がありません',
      };
      return NextResponse.json(response, { status: 403 });
    }

    // すでにルームが作成されている場合
    if (post.roomId) {
      const response: BulletinApiResponse<CreateRoomResponse> = {
        success: true,
        data: {
          roomId: post.roomId,
          post,
        },
        message: 'すでにルームが作成されています',
      };
      return NextResponse.json(response);
    }

    // ルームID生成（実際のマッチングシステムと連携する）
    const roomId = `room_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    // 投稿にルームIDを設定
    const updatedPost = bulletinStore.setPostRoom(postId, roomId);

    if (!updatedPost) {
      const response: BulletinApiResponse = {
        success: false,
        error: '投稿が見つかりません',
      };
      return NextResponse.json(response, { status: 404 });
    }

    const response: BulletinApiResponse<CreateRoomResponse> = {
      success: true,
      data: {
        roomId,
        post: updatedPost,
      },
      message: 'ルームを作成しました',
    };

    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    console.error('ルーム作成エラー:', error);
    const response: BulletinApiResponse = {
      success: false,
      error: 'ルームの作成に失敗しました',
    };
    return NextResponse.json(response, { status: 500 });
  }
}
