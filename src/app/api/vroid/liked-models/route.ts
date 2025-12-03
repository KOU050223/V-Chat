import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createVRoidClient } from '@/lib/vroid';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || !session.accessToken) {
      return NextResponse.json(
        { error: { message: 'VRoid Hub認証が必要です' } },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const count = searchParams.get('count') || '20';

    // VRoidクライアントを作成
    const vroidClient = createVRoidClient(session);
    if (!vroidClient) {
      return NextResponse.json(
        { error: { message: 'VRoidクライアントの作成に失敗しました' } },
        { status: 500 }
      );
    }

    // ダッシュボードと同じ方法でいいねしたモデルを取得
    const clientId = process.env.NEXT_PUBLIC_VROID_CLIENT_ID;
    if (!clientId) {
      return NextResponse.json(
        { error: { message: '環境変数 NEXT_PUBLIC_VROID_CLIENT_ID が設定されていません' } },
        { status: 500 }
      );
    }

    const data = await vroidClient.getLikedCharacterModels({
      application_id: clientId,
      count: parseInt(count),
      is_downloadable: true
    });

    return NextResponse.json({
      data: data.data,
      _links: data._links,
      error: data.error
    });

  } catch (error: any) {
    console.error('VRoid いいねしたモデル取得エラー:', error);
    
    // エラーの詳細をレスポンスに含める
    const errorMessage = error.message || 'いいねしたモデルの取得に失敗しました';
    const statusCode = 500;
    
    return NextResponse.json(
      { 
        error: { 
          message: errorMessage,
          details: error.message
        } 
      },
      { status: statusCode }
    );
  }
}
