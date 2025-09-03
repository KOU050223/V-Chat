import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';

const VROID_API_BASE = 'https://hub.vroid.com/api';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    // デバッグ情報をログ出力
    console.log('VRoid API Proxy - Session check:', {
      hasSession: !!session,
      hasAccessToken: !!session?.accessToken,
      provider: session?.provider,
      accessTokenLength: session?.accessToken?.length,
    });
    
    if (!session?.accessToken) {
      console.log('VRoid API Proxy - No access token available');
      return NextResponse.json(
        { error: 'VRoidアカウントが連携されていません' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const endpoint = searchParams.get('endpoint');
    const method = searchParams.get('method') || 'GET';

    if (!endpoint) {
      return NextResponse.json(
        { error: 'endpointパラメータが必要です' },
        { status: 400 }
      );
    }


    console.log('VRoid API Proxy - Making request:', {
      url: `${VROID_API_BASE}${endpoint}`,
      method,
      hasAuth: !!session.accessToken,
    });

    const vroidResponse = await fetch(`${VROID_API_BASE}${endpoint}`, {
      method,
      headers: {
        'Authorization': `Bearer ${session.accessToken}`,
        'Content-Type': 'application/json',
        'X-Api-Version': '11',
      },
    });

    console.log('VRoid API Proxy - Response:', {
      status: vroidResponse.status,
      statusText: vroidResponse.statusText,
      headers: Object.fromEntries(vroidResponse.headers.entries()),
    });

    if (!vroidResponse.ok) {
      const errorText = await vroidResponse.text();
      console.log('VRoid API Proxy - Error response:', errorText);
      
      if (vroidResponse.status === 401) {
        return NextResponse.json(
          { error: 'VRoidアクセストークンが無効です' },
          { status: 401 }
        );
      }
      
      if (vroidResponse.status === 403) {
        return NextResponse.json(
          { error: 'VRoid API アクセス権限がありません。OAuth設定を確認してください。' },
          { status: 403 }
        );
      }
      
      return NextResponse.json(
        { error: `VRoid API エラー: ${vroidResponse.status} - ${errorText}` },
        { status: vroidResponse.status }
      );
    }

    const data = await vroidResponse.json();
    return NextResponse.json(data);

  } catch (error) {
    console.error('VRoid API Proxy Error:', error);
    return NextResponse.json(
      { error: 'VRoid API呼び出しに失敗しました' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.accessToken) {
      return NextResponse.json(
        { error: 'VRoidアカウントが連携されていません' },
        { status: 401 }
      );
    }

    const { endpoint, data } = await request.json();

    if (!endpoint) {
      return NextResponse.json(
        { error: 'endpointが必要です' },
        { status: 400 }
      );
    }

    const vroidResponse = await fetch(`${VROID_API_BASE}${endpoint}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.accessToken}`,
        'Content-Type': 'application/json',
        'X-Api-Version': '11',
      },
      body: data ? JSON.stringify(data) : undefined,
    });

    if (!vroidResponse.ok) {
      if (vroidResponse.status === 401) {
        return NextResponse.json(
          { error: 'VRoidアクセストークンが無効です' },
          { status: 401 }
        );
      }
      
      const errorText = await vroidResponse.text();
      return NextResponse.json(
        { error: `VRoid API エラー: ${vroidResponse.status} - ${errorText}` },
        { status: vroidResponse.status }
      );
    }

    const responseData = await vroidResponse.json();
    return NextResponse.json(responseData);

  } catch (error) {
    console.error('VRoid API Proxy POST Error:', error);
    return NextResponse.json(
      { error: 'VRoid API呼び出しに失敗しました' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.accessToken) {
      return NextResponse.json(
        { error: 'VRoidアカウントが連携されていません' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const endpoint = searchParams.get('endpoint');

    if (!endpoint) {
      return NextResponse.json(
        { error: 'endpointパラメータが必要です' },
        { status: 400 }
      );
    }

    const vroidResponse = await fetch(`${VROID_API_BASE}${endpoint}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${session.accessToken}`,
        'Content-Type': 'application/json',
        'X-Api-Version': '11',
      },
    });

    if (!vroidResponse.ok) {
      if (vroidResponse.status === 401) {
        return NextResponse.json(
          { error: 'VRoidアクセストークンが無効です' },
          { status: 401 }
        );
      }
      
      const errorText = await vroidResponse.text();
      return NextResponse.json(
        { error: `VRoid API エラー: ${vroidResponse.status} - ${errorText}` },
        { status: vroidResponse.status }
      );
    }

    // DELETEは通常空のレスポンスを返す
    const contentLength = vroidResponse.headers.get('content-length');
    if (contentLength && parseInt(contentLength) > 0) {
      const data = await vroidResponse.json();
      return NextResponse.json(data);
    }

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('VRoid API Proxy DELETE Error:', error);
    return NextResponse.json(
      { error: 'VRoid API呼び出しに失敗しました' },
      { status: 500 }
    );
  }
}