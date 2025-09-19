import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';

const VROID_API_BASE = 'https://hub.vroid.com/api';

/**
 * VRMファイルをダウンロードし、ブラウザに返すAPIエンドポイント
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.accessToken) {
      return NextResponse.json(
        { error: 'VRoidアカウントが連携されていません' },
        { status: 401 }
      );
    }

    const { modelId } = await request.json();

    if (!modelId) {
      return NextResponse.json(
        { error: 'modelIdが必要です' },
        { status: 400 }
      );
    }

    // Step 1: ダウンロードライセンスを取得（正しいエンドポイント）
    const licenseResponse = await fetch(
      `${VROID_API_BASE}/download_licenses`, 
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.accessToken}`,
          'Content-Type': 'application/json',
          'X-Api-Version': '11',
        },
        body: JSON.stringify({
          character_model_id: modelId
        }),
      }
    );

    if (!licenseResponse.ok) {
      const errorText = await licenseResponse.text();
      return NextResponse.json(
        { error: `ライセンス取得エラー: ${licenseResponse.status} - ${errorText}` },
        { status: licenseResponse.status }
      );
    }

    const licenseData = await licenseResponse.json();
    
    if (!licenseData.data?.id) {
      return NextResponse.json(
        { error: 'ダウンロードライセンスIDが取得できませんでした' },
        { status: 500 }
      );
    }

    // Step 2: ライセンスIDを使用してVRMファイルをダウンロード
    const vrmResponse = await fetch(
      `${VROID_API_BASE}/download_licenses/${licenseData.data.id}/download`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${session.accessToken}`,
          'X-Api-Version': '11',
        },
        redirect: 'follow'
      }
    );

    if (!vrmResponse.ok) {
      return NextResponse.json(
        { error: `VRMダウンロードエラー: ${vrmResponse.status}` },
        { status: vrmResponse.status }
      );
    }

    // Step 3: VRMファイルをBlobとして取得
    const vrmBlob = await vrmResponse.arrayBuffer();
    
    // Step 4: レスポンスヘッダーを設定してファイルを返す
    const response = new NextResponse(vrmBlob);
    response.headers.set('Content-Type', 'application/octet-stream');
    response.headers.set('Content-Disposition', `attachment; filename="${modelId}.vrm"`);
    response.headers.set('Content-Length', vrmBlob.byteLength.toString());
    
    // CORS対応
    response.headers.set('Access-Control-Allow-Origin', '*');
    response.headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type');

    return response;

  } catch (error) {
    console.error('VRM Download Error:', error);
    return NextResponse.json(
      { error: 'VRMダウンロードに失敗しました' },
      { status: 500 }
    );
  }
}

/**
 * ライセンスIDを使用してVRMファイルをダウンロード（新しいAPI仕様）
 */
export async function GET(request: NextRequest) {
  try {
    console.log('VRM ダウンロードプロキシ API呼び出し (GET)');

    // セッション確認
    const session = await getServerSession(authOptions);
    if (!session?.accessToken) {
      console.error('VRM ダウンロードプロキシ: 認証エラー');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // URLパラメータ取得
    const { searchParams } = new URL(request.url);
    const licenseId = searchParams.get('license_id');
    const modelId = searchParams.get('model_id');

    if (!licenseId) {
      return NextResponse.json({ error: 'license_id is required' }, { status: 400 });
    }

    console.log('VRM ダウンロードプロキシ:', { licenseId, modelId });

    // VRoid Hub APIエンドポイント（正確なAPI仕様に基づく）
    const vroidApiUrl = `${VROID_API_BASE}/download_licenses/${licenseId}/download`;
    
    console.log('VRoid Hub API呼び出し:', vroidApiUrl);

    // VRoid Hub APIへのリクエスト
    const response = await fetch(vroidApiUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${session.accessToken}`,
        'X-Api-Version': '11',
        'Accept': 'application/octet-stream',
        'User-Agent': 'V-Chat/1.0.0',
      },
      redirect: 'follow' // 302リダイレクトを自動的に追跡
    });

    console.log('VRoid Hub API レスポンス:', {
      status: response.status,
      statusText: response.statusText,
      headers: Object.fromEntries(response.headers.entries()),
      url: response.url
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('VRoid Hub API エラー:', {
        status: response.status,
        statusText: response.statusText,
        errorText
      });
      
      return NextResponse.json(
        { error: `VRoid Hub API error: ${response.status} ${response.statusText}` },
        { status: response.status }
      );
    }

    // Content-Typeを確認
    const contentType = response.headers.get('content-type') || 'application/octet-stream';
    
    console.log('VRM ファイル情報:', {
      contentType,
      contentLength: response.headers.get('content-length'),
      finalUrl: response.url
    });

    // ファイルデータを取得
    const fileData = await response.arrayBuffer();
    
    console.log('VRM ダウンロード成功:', {
      fileSize: fileData.byteLength,
      licenseId
    });

    // ファイル名を生成
    const fileName = `vroid_model_${modelId || licenseId.split('-')[0]}.vrm`;

    // レスポンスヘッダーを設定
    const headers = new Headers();
    headers.set('Content-Type', 'application/octet-stream');
    headers.set('Content-Disposition', `attachment; filename="${fileName}"`);
    headers.set('Content-Length', fileData.byteLength.toString());
    headers.set('Access-Control-Allow-Origin', '*');
    headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    headers.set('Access-Control-Allow-Headers', 'Content-Type');

    return new NextResponse(fileData, {
      status: 200,
      headers
    });

  } catch (error: any) {
    console.error('VRM ダウンロードプロキシ エラー:', {
      message: error.message,
      stack: error.stack
    });

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * CORS preflight リクエストに対応
 */
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}