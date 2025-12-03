'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { RefreshCw, Download, AlertCircle, CheckCircle, XCircle } from 'lucide-react';
import Image from 'next/image';

interface DownloadTestResult {
  modelId: string;
  status: 'testing' | 'success' | 'error';
  error?: string;
  data?: any;
  timestamp: Date;
}

export default function SessionInfoPage() {
  const { data: session, status, update } = useSession();
  const [testModelId, setTestModelId] = useState('6689695945343414173'); // いいねしたモデルのIDをデフォルトに
  const [downloadTests, setDownloadTests] = useState<DownloadTestResult[]>([]);
  const [isTestingDownload, setIsTestingDownload] = useState(false);

  const handleRefresh = () => {
    update();
  };

    const testDownloadLicense = async (modelId: string) => {
    if (!modelId.trim()) return;

    // テスト結果を初期化
    const newTest: DownloadTestResult = {
      modelId,
      status: 'testing',
      timestamp: new Date()
    };
    
    setDownloadTests(prev => [newTest, ...prev]);
    setIsTestingDownload(true);

    try {
      console.log(`Testing download license for model: ${modelId}`);
      
      // 新しいPOST /api/download_licenses エンドポイントを試行
      console.log('Trying POST /api/download_licenses...');
      const postResponse = await fetch('/api/vroid/proxy', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          endpoint: '/download_licenses',
          data: {
            character_model_id: modelId
          }
        })
      });
      const postData = await postResponse.json();
      
      console.log('POST download_licenses response:', { status: postResponse.status, data: postData });

      if (postResponse.ok) {
        // POST成功
        setDownloadTests(prev => prev.map(test => 
          test.modelId === modelId && test.status === 'testing'
            ? { ...test, status: 'success', data: postData.data }
            : test
        ));
        return;
      }

      // POSTが失敗した場合、従来のGET方式にフォールバック
      console.log('POST failed, trying GET fallback...');
      const getResponse = await fetch(`/api/vroid/proxy?endpoint=/character_models/${modelId}/download_license`);
      const getData = await getResponse.json();
      
      console.log('GET download license response:', { status: getResponse.status, data: getData });

      if (getResponse.ok) {
        // GET成功
        setDownloadTests(prev => prev.map(test => 
          test.modelId === modelId && test.status === 'testing'
            ? { ...test, status: 'success', data: getData.data }
            : test
        ));
      } else {
        // 両方失敗
        const errorMessage = getData.error?.message || postData.error?.message || `HTTP ${getResponse.status}: ${getResponse.statusText}`;
        setDownloadTests(prev => prev.map(test => 
          test.modelId === modelId && test.status === 'testing'
            ? { 
                ...test, 
                status: 'error', 
                error: `POST/GET両方失敗: ${errorMessage}`,
                data: { postError: postData, getError: getData }
              }
            : test
        ));
      }
    } catch (error) {
      console.error('Download license test error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setDownloadTests(prev => prev.map(test => 
        test.modelId === modelId && test.status === 'testing'
          ? { ...test, status: 'error', error: errorMessage }
          : test
      ));
    } finally {
      setIsTestingDownload(false);
    }
  };

  const checkMyModels = async () => {
    try {
      console.log('Checking my models...');
      const response = await fetch('/api/vroid/proxy?endpoint=/character_models?count=5');
      const data = await response.json();
      
      console.log('My models response:', { status: response.status, data });
      
      if (response.ok && data.data?.character_models) {
        const models = data.data.character_models;
        console.log(`Found ${models.length} models:`, models.map((m: any) => ({ id: m.id, title: m.title })));
        
        // 最初のモデルIDを入力フィールドに設定
        if (models.length > 0) {
          setTestModelId(models[0].id);
        }
        
        return models;
      } else {
        console.log('No models found or error:', data);
        return [];
      }
    } catch (error) {
      console.error('Check my models error:', error);
      return [];
    }
  };

  const testPermissions = async () => {
    try {
      const response = await fetch('/api/debug/vroid-permissions');
      const result = await response.json();
      console.log('VRoid権限テスト結果:', result);
      alert('VRoid権限テスト完了。コンソールで詳細を確認してください。');
    } catch (error) {
      console.error('権限テストエラー:', error);
      alert('権限テストに失敗しました');
    }
  };

  if (status === 'loading') {
    return (
      <div className="container mx-auto py-8">
        <Card>
          <CardHeader>
            <CardTitle>セッション情報</CardTitle>
            <CardDescription>読み込み中...</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">セッション情報 (デバッグ用)</h1>
        <Button onClick={handleRefresh} variant="outline" size="sm">
          <RefreshCw className="h-4 w-4 mr-2" />
          更新
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>認証状況</CardTitle>
          <CardDescription>現在のログイン状態</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="font-medium">ステータス:</span>
              <Badge variant={status === 'authenticated' ? 'default' : 'secondary'}>
                {status}
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-medium">セッション:</span>
              <Badge variant={session ? 'default' : 'destructive'}>
                {session ? '有効' : '無効'}
              </Badge>
            </div>
            {session?.provider && (
              <div className="flex items-center gap-2">
                <span className="font-medium">プロバイダー:</span>
                <Badge variant="outline">{session.provider}</Badge>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {session && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>ユーザー情報</CardTitle>
              <CardDescription>基本的なユーザー情報</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  {session.user?.image && (
                    <Image
                      src={session.user.image}
                      alt="プロフィール画像"
                      width={64}
                      height={64}
                      className="rounded-full"
                    />
                  )}
                  <div>
                    <p className="font-medium text-lg">
                      {session.user?.name || 'Unknown User'}
                    </p>
                    {session.user?.email && (
                      <p className="text-sm text-gray-600">{session.user.email}</p>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {(session as any)?.vroidProfile && (
            <Card>
              <CardHeader>
                <CardTitle>VRoid情報</CardTitle>
                <CardDescription>VRoid Hubから取得した詳細情報</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {(session as any).vroidProfile.actualUser && (
                    <div className="space-y-2">
                      <h4 className="font-medium">実際のユーザー情報</h4>
                      <div className="bg-gray-50 p-3 rounded-md space-y-1">
                        <p><strong>ID:</strong> {(session as any).vroidProfile.actualUser.id}</p>
                        <p><strong>Pixiv ID:</strong> {(session as any).vroidProfile.actualUser.pixiv_user_id}</p>
                        <p><strong>名前:</strong> {(session as any).vroidProfile.actualUser.name}</p>
                        {(session as any).vroidProfile.actualUser.icon && (
                          <p><strong>アイコン:</strong> 
                            <a 
                              href={(session as any).vroidProfile.actualUser.icon.sq170?.url} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="text-blue-500 hover:underline ml-1"
                            >
                              画像を表示
                            </a>
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                  {(session as any).vroidProfile.extractedInfo && (
                    <div className="space-y-2">
                      <h4 className="font-medium">抽出情報</h4>
                      <div className="bg-gray-50 p-3 rounded-md space-y-1">
                        <p><strong>利用可能な名前:</strong> {JSON.stringify((session as any).vroidProfile.extractedInfo.availableNames, null, 2)}</p>
                        <p><strong>利用可能なID:</strong> {JSON.stringify((session as any).vroidProfile.extractedInfo.availableIds, null, 2)}</p>
                        <p><strong>利用可能な画像:</strong> {(session as any).vroidProfile.extractedInfo.availableImages?.length || 0}個</p>
                        <p><strong>利用可能なメール:</strong> {(session as any).vroidProfile.extractedInfo.availableEmails?.length || 0}個</p>
                      </div>
                    </div>
                  )}

                  {(session as any).vroidData && (
                    <div className="space-y-2">
                      <h4 className="font-medium">VRoidデータ詳細</h4>
                      <div className="bg-gray-50 p-3 rounded-md">
                        <pre className="text-xs overflow-auto max-h-96">
                          {JSON.stringify((session as any).vroidData, null, 2)}
                        </pre>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>認証トークン</CardTitle>
              <CardDescription>API呼び出しに使用されるトークン</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="font-medium">アクセストークン:</span>
                  <Badge variant={(session as any)?.accessToken ? 'default' : 'destructive'}>
                    {(session as any)?.accessToken ? '有効' : '無効'}
                  </Badge>
                  {(session as any)?.accessToken && (
                    <span className="text-xs text-gray-500">
                      (長さ: {(session as any).accessToken.length})
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-medium">リフレッシュトークン:</span>
                  <Badge variant={(session as any)?.refreshToken ? 'default' : 'destructive'}>
                    {(session as any)?.refreshToken ? '有効' : '無効'}
                  </Badge>
                  {(session as any)?.refreshToken && (
                    <span className="text-xs text-gray-500">
                      (長さ: {(session as any).refreshToken.length})
                    </span>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* VRoidダウンロードライセンステスト */}
          <Card>
            <CardHeader>
              <CardTitle>VRoidダウンロードライセンステスト</CardTitle>
              <CardDescription>モデルのダウンロードライセンス取得をテスト</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex gap-2">
                  <Input
                    placeholder="モデルID (例: 6689695945343414173)"
                    value={testModelId}
                    onChange={(e) => setTestModelId(e.target.value)}
                    className="flex-1"
                  />
                  <Button 
                    onClick={() => testDownloadLicense(testModelId)}
                    disabled={isTestingDownload || !testModelId.trim()}
                  >
                    {isTestingDownload ? (
                      <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <Download className="h-4 w-4 mr-2" />
                    )}
                    テスト
                  </Button>
                  <Button 
                    onClick={testPermissions}
                    variant="outline"
                  >
                    権限テスト
                  </Button>
                  <Button 
                    onClick={checkMyModels}
                    variant="outline"
                    size="sm"
                  >
                    マイモデル確認
                  </Button>
                </div>

                <div className="text-sm text-gray-600 space-y-1">
                  <p><strong>テスト用モデルID:</strong></p>
                  <p>• 6689695945343414173 (社畜ちゃん - いいねしたモデル)</p>
                  <p>• test (存在しないID - エラーテスト用)</p>
                  <p>• my-model (マイモデルがある場合)</p>
                  <p className="text-orange-600">
                    <strong>注意:</strong> 非公認アプリでは「自分のモデル」または「ダウンロード許可されたモデル」のみテスト可能
                  </p>
                  <p className="text-blue-600">
                    <strong>新機能:</strong> POST /api/download_licenses エンドポイントもテスト
                  </p>
                </div>

                {downloadTests.length > 0 && (
                  <div className="space-y-3">
                    <h4 className="font-medium">テスト履歴</h4>
                    {downloadTests.map((test, index) => (
                      <div key={`${test.modelId}-${test.timestamp.getTime()}`} className="border rounded-md p-3">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">モデルID: {test.modelId}</span>
                            {test.status === 'testing' && (
                              <Badge variant="secondary">
                                <RefreshCw className="h-3 w-3 animate-spin mr-1" />
                                テスト中
                              </Badge>
                            )}
                            {test.status === 'success' && (
                              <Badge variant="default">
                                <CheckCircle className="h-3 w-3 mr-1" />
                                成功
                              </Badge>
                            )}
                            {test.status === 'error' && (
                              <Badge variant="destructive">
                                <XCircle className="h-3 w-3 mr-1" />
                                エラー
                              </Badge>
                            )}
                          </div>
                          <span className="text-xs text-gray-500">
                            {test.timestamp.toLocaleTimeString()}
                          </span>
                        </div>

                        {test.status === 'success' && test.data && (
                          <div className="bg-green-50 border border-green-200 rounded p-2 text-sm">
                            <p><strong>ダウンロードURL:</strong></p>
                            <p className="break-all text-xs font-mono bg-white p-1 rounded mt-1">
                              {test.data.downloadUrl}
                            </p>
                            {test.data.expiresAt && (
                              <p className="mt-1">
                                <strong>有効期限:</strong> {new Date(test.data.expiresAt).toLocaleString()}
                              </p>
                            )}
                          </div>
                        )}

                        {test.status === 'error' && (
                          <div className="bg-red-50 border border-red-200 rounded p-2 text-sm">
                            <p><strong>エラー:</strong> {test.error}</p>
                            {test.data && (
                              <details className="mt-2">
                                <summary className="cursor-pointer text-xs text-gray-600">
                                  詳細情報を表示
                                </summary>
                                <pre className="text-xs bg-white p-2 rounded mt-1 overflow-auto max-h-32">
                                  {JSON.stringify(test.data, null, 2)}
                                </pre>
                              </details>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>生セッションデータ</CardTitle>
              <CardDescription>デバッグ用の完全なセッション情報</CardDescription>
            </CardHeader>
            <CardContent>
              <pre className="text-xs bg-gray-50 p-4 rounded-md overflow-auto max-h-96">
                {JSON.stringify(session, null, 2)}
              </pre>
            </CardContent>
          </Card>
        </>
      )}

      {!session && (
        <Card>
          <CardHeader>
            <CardTitle>ログインが必要</CardTitle>
            <CardDescription>セッション情報を表示するにはログインしてください</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600">
              <a href="/login" className="text-blue-500 hover:underline">
                ログインページに移動
              </a>
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
