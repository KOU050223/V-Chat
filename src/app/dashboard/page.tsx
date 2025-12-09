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
    sessionError, // セッションエラーを取得
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
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-blue-100/30 to-purple-50 relative overflow-hidden">
        {/* 装飾的な背景要素 */}
        <div className="absolute top-20 left-10 w-20 h-20 bg-purple-200/30 rounded-full blur-2xl" />
        <div className="absolute top-40 right-20 w-16 h-16 bg-blue-200/30 rounded-full blur-xl" />
        <div className="absolute bottom-40 left-1/4 w-24 h-24 bg-pink-200/20 rounded-full blur-3xl" />
        <div className="absolute bottom-20 right-1/3 w-20 h-20 bg-cyan-200/20 rounded-full blur-2xl" />

        {/* ヘッダー */}
        <header className="bg-white/60 backdrop-blur-md border-b border-white/50 sticky top-0 z-10">
          <div className="max-w-6xl mx-auto px-6 py-4">
            <div className="flex justify-between items-center">
              <Image
                src="/v-chat_logo.png"
                alt="V-Chat"
                width={120}
                height={36}
                className="h-8 w-auto"
              />
              <div className="flex items-center gap-4">
                <Dialog>
                  <DialogTrigger asChild>
                    <Button variant="ghost" size="sm">
                      <Settings className="h-4 w-4 mr-2" />
                      設定
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
                    {isVRoidLinked && (
                      <div className="mt-4 pt-4 border-t">
                        <Button
                          onClick={handleUnlinkVRoid}
                          variant="outline"
                          className="w-full"
                        >
                          VRoid連携を解除
                        </Button>
                      </div>
                    )}
                  </DialogContent>
                </Dialog>
                <Avatar className="h-9 w-9">
                  <AvatarFallback className="text-sm font-medium">
                    {currentUser && "displayName" in currentUser
                      ? currentUser.displayName?.charAt(0)
                      : currentUser?.name?.charAt(0) ||
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

        {/* メインコンテンツ - 中央配置 */}
        <main className="relative z-10 flex items-center justify-center min-h-[calc(100vh-200px)] px-4 py-12">
          <div className="w-full max-w-3xl mx-auto space-y-8">
            {/* VRoid連携バナー（未連携時） */}
            {!isVRoidLinked && (
              <Card
                className={`border-2 ${
                  sessionError ? "border-red-300" : "border-purple-300"
                } bg-gradient-to-r ${
                  sessionError
                    ? "from-red-50 to-orange-50"
                    : "from-purple-100 to-pink-100"
                } shadow-lg animate-in fade-in slide-in-from-top-4 duration-500`}
              >
                <CardContent className="p-6">
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="text-center sm:text-left flex-1">
                      <h3
                        className={`font-bold ${
                          sessionError ? "text-red-900" : "text-purple-900"
                        } mb-1 text-lg`}
                      >
                        {sessionError
                          ? "VRoid連携の有効期限が切れました"
                          : "VRoidアカウント連携が必要です"}
                      </h3>
                      <p
                        className={`text-sm ${
                          sessionError ? "text-red-700" : "text-purple-700"
                        }`}
                      >
                        {sessionError
                          ? "セキュリティのため、もう一度連携を行ってください"
                          : "3Dアバターでチャットを楽しむには、VRoidアカウントを連携してください"}
                      </p>
                    </div>
                    <Button
                      onClick={handleLinkVRoid}
                      className={`${
                        sessionError
                          ? "bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-700 hover:to-orange-700"
                          : "bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
                      } text-white shadow-md`}
                      size="lg"
                    >
                      {sessionError ? "再連携する" : "今すぐ連携"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* メインアクション - チャットを始める */}
            <div className="text-center space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
              <div className="space-y-3">
                <h1 className="text-3xl md:text-4xl font-bold text-slate-800">
                  V-Chatへようこそ
                </h1>
                <p className="text-slate-600 text-lg">
                  3Dアバターでビデオチャットを楽しもう
                </p>
              </div>

              <Link href="/matching" className="inline-block">
                <Button
                  size="lg"
                  className="bg-gradient-to-r from-teal-500 to-cyan-600 hover:from-teal-600 hover:to-cyan-700 text-white px-12 py-7 text-xl font-semibold rounded-full shadow-xl hover:shadow-2xl transform hover:scale-105 transition-all duration-300"
                >
                  <Users className="mr-3 h-7 w-7" />
                  チャットを始める
                </Button>
              </Link>
            </div>

            {/* サブアクション */}
            <div className="flex flex-wrap justify-center gap-6 pt-4 animate-in fade-in slide-in-from-bottom-8 duration-1000">
              {/* アバター選択 */}
              <Dialog>
                <DialogTrigger asChild>
                  <button
                    type="button"
                    className="group flex flex-col items-center gap-3 p-6 rounded-2xl hover:bg-white/60 transition-all duration-300"
                  >
                    <div className="relative">
                      <div className="p-4 bg-gradient-to-br from-orange-100 to-orange-200 rounded-2xl group-hover:shadow-lg transition-all duration-300 group-hover:scale-110">
                        <UserCircle className="h-12 w-12 text-orange-600" />
                      </div>
                    </div>
                    <span className="text-sm font-medium text-slate-700 group-hover:text-slate-900">
                      アバター選択
                    </span>
                  </button>
                </DialogTrigger>
                <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>アバターを選択</DialogTitle>
                    <DialogDescription>
                      使用する3Dアバターを選択してください
                    </DialogDescription>
                  </DialogHeader>
                  {isVRoidLinked ? (
                    <div className="space-y-4">
                      <SelectedVModelCard />
                      <VModelSelector
                        onModelSelect={(model) => {
                          console.log("選択されたモデル:", model);
                        }}
                      />
                    </div>
                  ) : (
                    <div className="text-center py-8 space-y-4">
                      <UserCircle className="h-16 w-16 text-slate-300 mx-auto" />
                      <div>
                        <p className="text-slate-600 mb-1 font-medium">
                          VRoidアカウント連携が必要です
                        </p>
                        <p className="text-sm text-slate-500">
                          アバターを使用するには、VRoidアカウントを連携してください
                        </p>
                      </div>
                      <Button
                        onClick={handleLinkVRoid}
                        className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
                        size="lg"
                      >
                        VRoid連携
                      </Button>
                    </div>
                  )}
                </DialogContent>
              </Dialog>

              {/* 掲示板 */}
              <Link
                href="/bulletin"
                className="group flex flex-col items-center gap-3 p-6 rounded-2xl hover:bg-white/60 transition-all duration-300"
              >
                <div className="relative">
                  <div className="p-4 bg-gradient-to-br from-blue-100 to-blue-200 rounded-2xl group-hover:shadow-lg transition-all duration-300 group-hover:scale-110">
                    <MessageSquare className="h-12 w-12 text-blue-600" />
                  </div>
                </div>
                <span className="text-sm font-medium text-slate-700 group-hover:text-slate-900">
                  掲示板
                </span>
              </Link>
            </div>
          </div>
        </main>
      </div>
    </ProtectedRoute>
  );
}
