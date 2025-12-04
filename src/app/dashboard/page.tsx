"use client";

import { useAuth } from "@/contexts/AuthContext";
import {
  Avatar,
  AvatarFallback,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import VModelSelector from "@/components/vmodel/VModelSelector";
import SelectedVModelCard from "@/components/vmodel/SelectedVModelCard";
import VModelSettings from "@/components/vmodel/VModelSettings";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import Image from "next/image";
import Link from "next/link";
import { handleError } from "@/lib/utils";
import { MessageSquare, Users, Settings, UserCircle } from "lucide-react";

export default function Dashboard() {
  const {
    user,
    nextAuthSession,
    logout,
    linkVRoidAccount,
    unlinkVRoidAccount,
    isVRoidLinked,
  } = useAuth();

  // 現在のユーザー情報を取得（Firebase または NextAuth）
  const currentUser = user || nextAuthSession?.user;

  const handleLogout = async () => {
    try {
      await logout();
      // ログアウト後にリダイレクトを確実にする
      setTimeout(() => {
        window.location.href = "/login";
      }, 100);
    } catch (error) {
      console.error("ログアウトエラー:", error);
      // エラーでもログイン画面に戻す
      window.location.href = "/login";
    }
  };

  const handleLinkVRoid = async () => {
    try {
      await linkVRoidAccount();
    } catch (error: unknown) {
      const message = handleError("VRoid連携エラー", error);
      alert(message);
    }
  };

  const handleUnlinkVRoid = async () => {
    try {
      await unlinkVRoidAccount();
    } catch (error: unknown) {
      const message = handleError("VRoid連携解除エラー", error);
      alert(message);
    }
  };

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
        {/* シンプルなヘッダー */}
        <header className="bg-white/80 backdrop-blur-sm border-b sticky top-0 z-10">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-14">
              <Image
                src="/v-chat_logo.png"
                alt="V-Chat"
                width={100}
                height={30}
                className="h-7 w-auto"
              />
              <div className="flex items-center gap-3">
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="text-xs">
                    {currentUser?.name?.charAt(0) ||
                      currentUser?.email?.charAt(0) ||
                      "U"}
                  </AvatarFallback>
                </Avatar>
                <Button variant="ghost" size="sm" onClick={handleLogout}>
                  ログアウト
                </Button>
              </div>
            </div>
          </div>
        </header>

        <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* VRoid連携ステータス */}
          {!isVRoidLinked && (
            <Card className="mb-6 border-purple-200 bg-gradient-to-r from-purple-50 to-pink-50">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <h3 className="font-semibold text-purple-900 mb-1">
                      VRoidアカウントを連携しよう
                    </h3>
                    <p className="text-sm text-purple-700">
                      3Dアバターを使ってチャットを楽しめます
                    </p>
                  </div>
                  <Button
                    onClick={handleLinkVRoid}
                    className="bg-gradient-to-r from-purple-500 to-pink-500 text-white hover:from-purple-600 hover:to-pink-600"
                  >
                    連携する
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* V体情報 */}
          {isVRoidLinked && (
            <div className="mb-6">
              <SelectedVModelCard />
            </div>
          )}

          {/* メインアクション */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            {/* チャットルーム */}
            <Card className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <Users className="h-6 w-6 text-blue-600" />
                  </div>
                  <CardTitle className="text-xl">チャットルーム</CardTitle>
                </div>
                <CardDescription>
                  アバターでビデオチャットを始めよう
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <Link href="/matching" className="block">
                  <Button className="w-full" size="lg">
                    ルームを探す
                  </Button>
                </Link>
                <Link href="/matching" className="block">
                  <Button variant="outline" className="w-full">
                    ルームを作成
                  </Button>
                </Link>
              </CardContent>
            </Card>

            {/* 掲示板 */}
            <Card className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 bg-green-100 rounded-lg">
                    <MessageSquare className="h-6 w-6 text-green-600" />
                  </div>
                  <CardTitle className="text-xl">掲示板</CardTitle>
                </div>
                <CardDescription>
                  話題を共有して仲間を募集しよう
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <Link href="/bulletin" className="block">
                  <Button className="w-full" size="lg">
                    掲示板を見る
                  </Button>
                </Link>
                <Link href="/bulletin/create" className="block">
                  <Button variant="outline" className="w-full">
                    新規投稿
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </div>

          {/* 設定 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* V体選択 */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <UserCircle className="h-5 w-5" />
                  V体選択
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isVRoidLinked ? (
                  <VModelSelector
                    onModelSelect={(model) => {
                      console.log("選択されたモデル:", model);
                    }}
                  />
                ) : (
                  <div className="text-center py-4">
                    <p className="text-sm text-gray-500 mb-3">
                      VRoidアカウント連携が必要です
                    </p>
                    <Button
                      onClick={handleLinkVRoid}
                      variant="outline"
                      className="w-full"
                    >
                      VRoid連携
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* V体設定 */}
            {isVRoidLinked && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Settings className="h-5 w-5" />
                    V体設定
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button variant="outline" className="w-full">
                        設定を開く
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                      <DialogHeader>
                        <DialogTitle>V体設定</DialogTitle>
                        <DialogDescription>
                          V体の表示や動作に関する設定を管理します
                        </DialogDescription>
                      </DialogHeader>
                      <VModelSettings />
                    </DialogContent>
                  </Dialog>
                  {isVRoidLinked && (
                    <Button
                      onClick={handleUnlinkVRoid}
                      variant="ghost"
                      size="sm"
                      className="w-full mt-2 text-xs text-gray-500"
                    >
                      VRoid連携を解除
                    </Button>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </main>
      </div>
    </ProtectedRoute>
  );
}
