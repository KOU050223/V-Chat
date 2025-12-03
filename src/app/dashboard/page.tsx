"use client";

import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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
import DebugPanel from "@/components/debug/DebugPanel";
import Image from "next/image";
import Link from "next/link";
import { handleError } from "@/lib/utils";

// VRoidプロフィールの型定義
interface VRoidUser {
  id?: string;
  pixiv_user_id?: string;
}

interface VRoidProfile {
  id?: string;
  actualUser?: VRoidUser;
  userDetail?: {
    user?: VRoidUser;
  };
}

// VRoid プロフィールからユーザーIDを安全に抽出するユーティリティ
function getVroidUserId(vroidProfile?: VRoidProfile): string | undefined {
  if (!vroidProfile) return undefined;

  const candidates: Array<string | undefined> = [
    vroidProfile.actualUser?.id,
    vroidProfile.userDetail?.user?.id,
    vroidProfile.actualUser?.pixiv_user_id,
    vroidProfile.userDetail?.user?.pixiv_user_id,
    vroidProfile.id,
  ];

  for (const c of candidates) {
    if (c && c !== "unknown") return c;
  }

  return undefined;
}

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
                      {currentUser?.name?.charAt(0) ||
                        currentUser?.email?.charAt(0) ||
                        "U"}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-sm font-medium text-gray-700">
                    {currentUser?.name || currentUser?.email}
                  </span>
                  {nextAuthSession && (
                    <span className="text-xs bg-purple-100 text-purple-600 px-2 py-1 rounded">
                      VRoid
                    </span>
                  )}
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
                  <Button className="w-full">プロフィール設定</Button>
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
                  {isVRoidLinked ? (
                    <VModelSelector
                      onModelSelect={(model) => {
                        console.log("選択されたモデル:", model);
                      }}
                    />
                  ) : (
                    <>
                      <Button
                        className="w-full"
                        variant="outline"
                        disabled={true}
                      >
                        V体を選択
                      </Button>
                      <p className="text-xs text-gray-500 mt-2">
                        VRoidアカウント連携が必要です
                      </p>
                    </>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>VRoidアカウント連携</CardTitle>
                  <CardDescription>
                    VRoidモデルを使用するためにアカウントを連携します
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {isVRoidLinked ? (
                    <div className="space-y-2">
                      <div className="flex items-center space-x-2">
                        <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                        <span className="text-sm text-green-600">
                          VRoidアカウント連携済み
                        </span>
                      </div>
                      <Button
                        onClick={handleUnlinkVRoid}
                        variant="outline"
                        className="w-full"
                      >
                        連携を解除
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="flex items-center space-x-2">
                        <div className="w-3 h-3 bg-gray-300 rounded-full"></div>
                        <span className="text-sm text-gray-600">
                          VRoidアカウント未連携
                        </span>
                      </div>
                      <Button
                        onClick={handleLinkVRoid}
                        className="w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white hover:from-purple-600 hover:to-pink-600"
                      >
                        VRoidアカウントを連携
                      </Button>
                    </div>
                  )}
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
                    {/* <Link href="/matching">
                     <Button className="w-full">
                      ランダムマッチング
                     </Button>
                    </Link> */}
                    <Link href="/matching">
                      <Button className="w-full" variant="outline">
                        ルームを探す
                      </Button>
                    </Link>
                    <Link href="/matching">
                      <Button className="w-full" variant="outline">
                        ルームを作成
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>掲示板</CardTitle>
                  <CardDescription>
                    話題を共有して仲間を募集しましょう
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <Link href="/bulletin">
                      <Button className="w-full">掲示板を見る</Button>
                    </Link>
                    <Link href="/bulletin/create">
                      <Button className="w-full" variant="outline">
                        新規投稿を作成
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>

              {/* V体設定カード */}
              {isVRoidLinked && (
                <Card>
                  <CardHeader>
                    <CardTitle>V体設定</CardTitle>
                    <CardDescription>
                      V体の表示や動作設定を管理します
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button className="w-full" variant="outline">
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
                  </CardContent>
                </Card>
              )}

              {/* デバッグパネル（開発環境のみ） */}
              <DebugPanel />
            </div>

            {/* V体情報セクション */}
            {isVRoidLinked && (
              <div className="mt-8">
                <SelectedVModelCard />
              </div>
            )}

            {/* アカウント情報セクション */}
            <div className="mt-8">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle>アカウント情報</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div>
                        <p className="text-sm font-medium text-gray-700">
                          メールアドレス
                        </p>
                        <p className="text-sm text-gray-900">{user?.email}</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-700">
                          表示名
                        </p>
                        <p className="text-sm text-gray-900">
                          {user?.displayName || "未設定"}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-700">
                          メール確認状態
                        </p>
                        <p className="text-sm text-gray-900">
                          {user?.emailVerified ? "確認済み" : "未確認"}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-700">
                          登録日
                        </p>
                        <p className="text-sm text-gray-900">
                          {user?.metadata?.creationTime
                            ? new Date(
                                user.metadata.creationTime
                              ).toLocaleDateString("ja-JP")
                            : "不明"}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* VRoidアカウント情報 */}
                {isVRoidLinked && nextAuthSession && (
                  <Card>
                    <CardHeader>
                      <CardTitle>VRoidアカウント情報</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        <div>
                          <p className="text-sm font-medium text-gray-700">
                            VRoidユーザー名
                          </p>
                          <p className="text-sm text-gray-900">
                            {nextAuthSession.user?.name || "未設定"}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-700">
                            VRoidユーザーID
                          </p>
                          <p className="text-sm text-gray-900">
                            {getVroidUserId(nextAuthSession?.vroidProfile) ??
                              "取得中..."}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-700">
                            連携状態
                          </p>
                          <p className="text-sm text-green-600">連携済み</p>
                        </div>
                        {nextAuthSession.vroidProfile && (
                          <div>
                            <p className="text-sm font-medium text-gray-700">
                              VRoidプロフィール
                            </p>
                            <div className="mt-1 space-x-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                disabled={
                                  !nextAuthSession?.vroidProfile?.actualUser?.id
                                }
                                onClick={() => {
                                  const vroidProfile =
                                    nextAuthSession?.vroidProfile as VRoidProfile;
                                  const vroidId = getVroidUserId(vroidProfile);

                                  console.log("VRoid ID検索:", {
                                    actualUserId: vroidProfile?.actualUser?.id,
                                    actualUserPixivId:
                                      vroidProfile?.actualUser?.pixiv_user_id,
                                    userDetailId:
                                      vroidProfile?.userDetail?.user?.id,
                                    userDetailPixivId:
                                      vroidProfile?.userDetail?.user
                                        ?.pixiv_user_id,
                                    profileId: vroidProfile?.id,
                                    selectedId: vroidId,
                                  });

                                  if (vroidId) {
                                    const url = `https://hub.vroid.com/users/${vroidId}`;
                                    console.log("VRoidマイページを開く:", url);
                                    window.open(url, "_blank");
                                  } else {
                                    alert(
                                      "VRoidユーザーIDが見つかりません。セッション情報を確認してください。"
                                    );
                                    console.error(
                                      "VRoidプロフィール情報:",
                                      vroidProfile
                                    );
                                  }
                                }}
                              >
                                マイページ
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  window.open(
                                    "https://hub.vroid.com",
                                    "_blank"
                                  );
                                }}
                              >
                                VRoid Hub
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
          </div>
        </main>
      </div>
    </ProtectedRoute>
  );
}
