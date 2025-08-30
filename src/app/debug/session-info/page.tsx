'use client';

import { useSession } from 'next-auth/react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { RefreshCw } from 'lucide-react';
import Image from 'next/image';

export default function SessionInfoPage() {
  const { data: session, status, update } = useSession();

  const handleRefresh = () => {
    update();
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
