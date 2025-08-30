import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';

/**
 * セッション情報をデバッグするためのAPIエンドポイント
 * 開発環境でのみ利用可能
 */
export async function GET(request: NextRequest) {
  // 本番環境では無効化
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json(
      { error: 'Debug endpoint is not available in production' },
      { status: 404 }
    );
  }

  try {
    const session = await getServerSession(authOptions);
    
    console.log('=== Session Debug Info ===');
    console.log('Session exists:', !!session);
    if (session) {
      console.log('User:', {
        id: session.user?.id,
        name: session.user?.name,
        email: session.user?.email,
        image: session.user?.image,
      });
      console.log('Access Token:', session.accessToken ? 'Present' : 'Missing');
      console.log('Access Token Length:', session.accessToken?.length || 0);
      console.log('Refresh Token:', session.refreshToken ? 'Present' : 'Missing');
      console.log('Provider:', session.provider);
      console.log('VRoid Profile:', session.vroidProfile ? 'Present' : 'Missing');
    }
    console.log('========================');

    // セッション情報を返す（機密情報は除外）
    const debugInfo = {
      hasSession: !!session,
      user: session?.user ? {
        id: session.user.id,
        name: session.user.name,
        email: session.user.email,
        image: session.user.image,
      } : null,
      hasAccessToken: !!session?.accessToken,
      accessTokenLength: session?.accessToken?.length || 0,
      hasRefreshToken: !!session?.refreshToken,
      provider: session?.provider,
      hasVRoidProfile: !!session?.vroidProfile,
      vroidProfile: session?.vroidProfile ? {
        id: session.vroidProfile.id,
        name: session.vroidProfile.name,
        // 機密情報は除外して基本情報のみ
      } : null,
    };

    return NextResponse.json(debugInfo);

  } catch (error) {
    console.error('Session debug error:', error);
    return NextResponse.json(
      { error: 'Failed to get session info', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}