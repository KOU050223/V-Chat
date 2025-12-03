import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';

const VROID_API_BASE = 'https://hub.vroid.com/api';

/**
 * VRoid Hub API権限テスト用エンドポイント
 * 各APIエンドポイントへのアクセス権限を順次テストする
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
    
    if (!session?.accessToken) {
      return NextResponse.json({
        error: 'No access token available',
        suggestion: 'VRoid認証が必要です',
      }, { status: 401 });
    }

    const results = {
      session: {
        hasAccessToken: !!session.accessToken,
        provider: session.provider,
        user: session.user,
        tokenLength: session.accessToken?.length,
      },
      apiTests: {} as any,
      summary: {
        totalTests: 0,
        successful: 0,
        failed: 0,
        permissions: [] as string[],
        recommendations: [] as string[],
      }
    };

    // テストするAPIエンドポイント一覧
    const apiEndpoints = [
      {
        name: 'Account Info',
        endpoint: '/account',
        description: '基本的なアカウント情報取得',
        required: true
      },
      {
        name: 'My Character Models',
        endpoint: '/character_models?count=1',
        description: 'マイモデル一覧取得',
        required: false
      },
      {
        name: 'Liked Models',
        endpoint: `/hearts?application_id=${process.env.VROID_CLIENT_ID}&count=1`,
        description: 'いいねしたモデル一覧',
        required: false
      },
      {
        name: 'Search Models',
        endpoint: '/search/character_models?keyword=test&count=1',
        description: 'モデル検索',
        required: false
      },
      {
        name: 'Download License Test',
        endpoint: '/character_models/test/download_license',
        description: 'ダウンロードライセンス取得テスト（存在しないモデルIDでの権限確認）',
        required: false,
        expectError: true // このテストはエラーが予想される
      }
    ];

    // 各APIエンドポイントを順次テスト
    for (const api of apiEndpoints) {
      try {
        console.log(`Testing VRoid API: ${api.name} (${api.endpoint})`);
        
        const response = await fetch(`${VROID_API_BASE}${api.endpoint}`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${session.accessToken}`,
            'Content-Type': 'application/json',
            'X-Api-Version': '11',
          },
        });

        const responseText = await response.text();
        let responseData;
        try {
          responseData = JSON.parse(responseText);
        } catch {
          responseData = { raw: responseText };
        }

        const testResult = {
          status: response.status,
          statusText: response.statusText,
          success: response.ok,
          data: response.ok ? responseData : null,
          error: !response.ok ? responseData : null,
          headers: Object.fromEntries(response.headers.entries()),
        };

        results.apiTests[api.name] = {
          ...api,
          result: testResult
        };

        results.summary.totalTests++;
        if (response.ok) {
          results.summary.successful++;
          results.summary.permissions.push(api.name);
        } else {
          results.summary.failed++;
        }

        // 少し待機（レート制限対策）
        await new Promise(resolve => setTimeout(resolve, 500));

      } catch (error) {
        console.error(`API test failed for ${api.name}:`, error);
        results.apiTests[api.name] = {
          ...api,
          result: {
            status: 0,
            statusText: 'Network Error',
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          }
        };
        results.summary.totalTests++;
        results.summary.failed++;
      }
    }

    // 開発者向け推奨事項を生成
    const recommendations = [];
    
    if (!results.apiTests['Account Info']?.result?.success) {
      recommendations.push('基本的なアカウント情報の取得に失敗しています。VRoid Hub Developer Consoleでアプリケーション設定を確認してください。');
    }
    
    if (!results.apiTests['My Character Models']?.result?.success) {
      recommendations.push('マイモデル一覧の取得権限がありません。VRoid Hub Developer Consoleでアプリケーションの審査を申請するか、権限タイプを変更してください。');
    }

    if (results.summary.successful === 0) {
      recommendations.push('すべてのAPIテストが失敗しました。VRoid Hub Developer Consoleでアプリケーション設定（Client ID、Client Secret、リダイレクトURI）を確認してください。');
    }

    results.summary.recommendations = recommendations;

    console.log('VRoid API Permission Test Results:', results);

    return NextResponse.json(results);

  } catch (error) {
    console.error('VRoid API permission test error:', error);
    return NextResponse.json(
      { 
        error: 'Permission test failed', 
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
