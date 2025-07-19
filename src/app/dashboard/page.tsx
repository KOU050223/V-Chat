'use client';

import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import Image from 'next/image';
import Link from 'next/link';

export default function Dashboard() {
  const { user, logout } = useAuth();

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('ログアウトエラー:', error);
    }
  };

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-gradient-to-r from-blue-50 to-indigo-100">
        <nav className="bg-white shadow-sm border-b">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-16">
              <div className="flex items-center">
                <Image
                  src="/v-chat_logo.png"
                  alt="V-Chat Logo"
                  width={120}
                  height={36}
                  className="h-8 w-auto"
                />
              </div>
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-2">
                  <Avatar>
                    <AvatarFallback>
                      {user?.displayName?.charAt(0) || user?.email?.charAt(0) || 'U'}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-sm font-medium text-gray-700">
                    {user?.displayName || user?.email}
                  </span>
                </div>
                <Button variant="outline" onClick={handleLogout}>
                  ログアウト
                </Button>
              </div>
            </div>
          </div>
        </nav>

        <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
          <div className="px-4 py-6 sm:px-0">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>プロフィール設定</CardTitle>
                  <CardDescription>
                    あなたのプロフィール情報を設定します
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button className="w-full">
                    プロフィール設定
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>V体選択</CardTitle>
                  <CardDescription>
                    使用するVRMアバターを選択します
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button className="w-full" variant="outline">
                    V体を選択
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>チャットルーム</CardTitle>
                  <CardDescription>
                    他のユーザーとチャットを始めます
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <Link href="/matching">
                     <Button className="w-full">
                      ランダムマッチング
                     </Button>
                    </Link>
                    <Button className="w-full" variant="outline">
                      ルームを作成
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="mt-8">
              <Card>
                <CardHeader>
                  <CardTitle>アカウント情報</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <label className="text-sm font-medium text-gray-700">
                        メールアドレス
                      </label>
                      <p className="text-sm text-gray-900">{user?.email}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-700">
                        表示名
                      </label>
                      <p className="text-sm text-gray-900">
                        {user?.displayName || '未設定'}
                      </p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-700">
                        メール確認状態
                      </label>
                      <p className="text-sm text-gray-900">
                        {user?.emailVerified ? '確認済み' : '未確認'}
                      </p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-700">
                        登録日
                      </label>
                      <p className="text-sm text-gray-900">
                        {user?.metadata?.creationTime 
                          ? new Date(user.metadata.creationTime).toLocaleDateString('ja-JP')
                          : '不明'
                        }
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </main>
      </div>
    </ProtectedRoute>
  );
}