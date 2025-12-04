"use client";

import React, { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useAuth } from "@/contexts/AuthContext";
import { useVModel } from "@/contexts/VModelContext";
import { useVRoidModels } from "@/hooks/useVRoidModels";
import { VRoidCharacterModel } from "@/lib/vroid";
import {
  RecommendedVRMDisplay,
  LegacyVRMDisplay,
  BlobVRMDisplay,
  InteractiveVRMDisplay,
} from "@/components/vmodel/VRMDisplayExamples";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui";

const VrmModelPage = () => {
  // 認証状態を取得
  const { data: session, status: sessionStatus } = useSession();
  const { user, nextAuthSession, isVRoidLinked } = useAuth();
  const { settings, updateSelectedModel } = useVModel();

  // ダッシュボードと同じようにVRoidモデルフックを使用
  const vroidModels = useVRoidModels({
    enableMyModels: false, // マイモデルは無効（権限制限のため）
    autoFetch: false, // 手動で取得するように設定
  });

  const {
    likedModels: vroidLikedModels,
    loading: vroidLoading,
    error: vroidError,
    fetchLikedModels: fetchLikedModelsFromHook,
    searchModels,
    isConnected,
  } = vroidModels;
  // テスト用のモデルデータ（必須プロパティのみ）
  const [testModel, setTestModel] = useState<VRoidCharacterModel>({
    id: "6689695945343414173", // 実際に動作確認済みのモデルID
    name: "Test VRM Model",
    is_private: false,
    is_downloadable: true,
    is_comment_off: false,
    is_other_users_available: true,
    is_other_users_allow_viewer_preview: true,
    is_hearted: true, // いいね済みに変更（テスト用）
    portrait_image: {
      is_default_image: true,
      original: { url: "", width: 300, height: 300 },
      w600: { url: "", width: 600, height: 600 },
      w300: { url: "", width: 300, height: 300 },
      sq600: { url: "", width: 600, height: 600 },
      sq300: { url: "", width: 300, height: 300 },
      sq150: { url: "", width: 150, height: 150 },
    },
    full_body_image: {
      is_default_image: true,
      original: { url: "", width: 300, height: 300 },
      w600: { url: "", width: 600, height: 600 },
      w300: { url: "", width: 300, height: 300 },
    },
    character: {
      id: "test-character",
      name: "Test Character",
      is_private: false,
      created_at: new Date().toISOString(),
      published_at: new Date().toISOString(),
      user: {
        id: "test-user",
        pixiv_user_id: "test-pixiv-user",
        name: "Test User",
        icon: {
          is_default_image: true,
          sq170: { url: "", width: 170, height: 170 },
          sq50: { url: "", width: 50, height: 50 },
        },
      },
    },
    created_at: new Date().toISOString(),
    published_at: new Date().toISOString(),
    heart_count: 0,
    download_count: 0,
    usage_count: 0,
    view_count: 0,
    tags: [{ name: "test", locale: "en", en_name: "test", ja_name: "テスト" }],
    age_limit: {
      is_r18: false,
      is_r15: false,
      is_adult: false,
    },
  });

  // カスタムテスト用の値
  const [customModelId, setCustomModelId] = useState("");
  const [customVrmUrl, setCustomVrmUrl] = useState("");
  const [testBlob, setTestBlob] = useState<Blob | null>(null);
  const [likedModels, setLikedModels] = useState<any[]>([]);
  const [isLoadingLikedModels, setIsLoadingLikedModels] = useState(false);

  // 認証完了後にVRoidデータを取得
  useEffect(() => {
    if (session && isConnected) {
      fetchLikedModelsFromHook();
    }
  }, [session, isConnected, fetchLikedModelsFromHook]);

  // ファイルアップロード処理
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.name.endsWith(".vrm")) {
      setTestBlob(file);
    }
  };

  // いいねしたモデル一覧を取得
  const fetchLikedModels = async () => {
    setIsLoadingLikedModels(true);
    try {
      // ダッシュボードと同じ方法でいいねしたモデルを取得
      const response = await fetch("/api/vroid/liked-models?count=20");
      const data = await response.json();

      if (response.ok && data.data) {
        setLikedModels(data.data);
        console.log("📋 いいねしたモデル:", data.data);
      } else {
        console.error("いいねしたモデル取得エラー:", data);
        alert(
          `エラー: ${data.error?.message || "いいねしたモデルの取得に失敗しました"}`
        );
      }
    } catch (error) {
      console.error("いいねしたモデル取得エラー:", error);
      alert(`エラー: ${error}`);
    } finally {
      setIsLoadingLikedModels(false);
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">🎭 VRM Model Debugging & Testing</h1>
        <Badge variant="outline">開発環境</Badge>
      </div>

      {/* 認証状態デバッグ情報 */}
      <Card className="border-blue-200 bg-blue-50">
        <CardHeader>
          <CardTitle className="text-blue-900">🔐 認証状態デバッグ</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <strong>NextAuth Session:</strong>
              <Badge
                className={
                  session
                    ? "bg-green-100 text-green-800"
                    : "bg-red-100 text-red-800"
                }
              >
                {session ? "✅ 有効" : "❌ 無効"}
              </Badge>
              {session && (
                <div className="mt-1 text-xs text-gray-600">
                  Provider: {session.provider || "unknown"} | Token:{" "}
                  {session.accessToken ? "✅" : "❌"}
                </div>
              )}
            </div>
            <div>
              <strong>VRoid連携:</strong>
              <Badge
                className={
                  isVRoidLinked
                    ? "bg-green-100 text-green-800"
                    : "bg-red-100 text-red-800"
                }
              >
                {isVRoidLinked ? "✅ 連携済み" : "❌ 未連携"}
              </Badge>
            </div>
            <div>
              <strong>Firebase User:</strong>
              <Badge
                className={
                  user
                    ? "bg-green-100 text-green-800"
                    : "bg-red-100 text-red-800"
                }
              >
                {user ? "✅ ログイン中" : "❌ 未ログイン"}
              </Badge>
            </div>
            <div>
              <strong>Session Status:</strong>
              <Badge variant="outline">{sessionStatus}</Badge>
            </div>
          </div>
          {/* VRoidモデルフック状態 */}
          <div className="mt-3 p-3 bg-white rounded border">
            <h4 className="font-semibold text-sm mb-2">
              🎭 VRoidモデルフック状態:
            </h4>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <strong>VRoidクライント接続:</strong>
                <Badge
                  className={
                    isConnected
                      ? "bg-green-100 text-green-800"
                      : "bg-red-100 text-red-800"
                  }
                >
                  {isConnected ? "✅ 接続済み" : "❌ 未接続"}
                </Badge>
              </div>
              <div>
                <strong>いいねモデル数:</strong>
                <Badge variant="outline">{vroidLikedModels.length}件</Badge>
              </div>
              <div>
                <strong>読み込み状態:</strong>
                <Badge
                  className={
                    vroidLoading
                      ? "bg-yellow-100 text-yellow-800"
                      : "bg-gray-100 text-gray-800"
                  }
                >
                  {vroidLoading ? "🔄 読み込み中" : "⏹️ 停止中"}
                </Badge>
              </div>
              <div>
                <strong>エラー状態:</strong>
                <Badge
                  className={
                    vroidError
                      ? "bg-red-100 text-red-800"
                      : "bg-green-100 text-green-800"
                  }
                >
                  {vroidError ? "❌ エラーあり" : "✅ 正常"}
                </Badge>
              </div>
            </div>
            {settings.selectedModel && (
              <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded text-xs">
                <strong>選択中モデル:</strong> {settings.selectedModel.name}{" "}
                (ID: {settings.selectedModel.id})
              </div>
            )}
            {vroidError && (
              <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700">
                <strong>エラー詳細:</strong> {vroidError}
              </div>
            )}
          </div>{" "}
          {!session && (
            <div className="mt-3 p-2 bg-yellow-100 border border-yellow-300 rounded text-sm text-yellow-800">
              💡 VRoidモデルのダウンロードテストには認証が必要です。
              <a href="/login" className="ml-2 text-blue-600 underline">
                ログインページ
              </a>
              または
              <a href="/dashboard" className="ml-2 text-blue-600 underline">
                ダッシュボード
              </a>
              からVRoid連携を行ってください。
            </div>
          )}
        </CardContent>
      </Card>

      <Tabs defaultValue="legacy" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="recommended">💡 推奨方式</TabsTrigger>
          <TabsTrigger value="legacy">🔄 URL直接 (推奨)</TabsTrigger>
          <TabsTrigger value="blob">💾 ファイル</TabsTrigger>
          <TabsTrigger value="interactive">🎮 インタラクティブ</TabsTrigger>
        </TabsList>

        {/* 注意書き */}
        <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded">
          <div className="text-sm text-amber-800">
            ⚠️ <strong>API制限のお知らせ:</strong> 現在、VRoid Hub
            APIの個人開発者権限制限により、モデルID方式は制限されています。
            <strong>「🔄 URL直接」方式</strong>でのテストを推奨します。
          </div>
        </div>

        {/* 推奨方式: モデルIDを使用 */}
        <TabsContent value="recommended" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>💡 推奨方式: モデルID指定</CardTitle>
              <CardDescription>
                VRoidモデルIDを指定してURL直接読み込み +
                スマートキャッシュを使用
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="model-id">モデルID</Label>
                  <Input
                    id="model-id"
                    value={customModelId}
                    onChange={(e) => setCustomModelId(e.target.value)}
                    placeholder="例: 6689695945343414173"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    💡 ヒント:
                    デバッグセクションの「いいねしたモデル一覧」から利用可能なモデルIDを確認できます
                  </p>
                </div>
                <div className="flex items-end">
                  <Button
                    onClick={() =>
                      setTestModel({ ...testModel, id: customModelId })
                    }
                    disabled={!customModelId}
                  >
                    モデル更新
                  </Button>
                </div>
              </div>

              <div className="border rounded-lg p-4">
                <p className="text-sm text-muted-foreground mb-2">
                  現在のモデル: <code>{testModel.id}</code>
                </p>
                <RecommendedVRMDisplay model={testModel} />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* レガシー方式: URL直接指定 */}
        <TabsContent value="legacy" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>🔄 レガシー方式: URL直接指定</CardTitle>
              <CardDescription>
                VRMファイルのURLを直接指定して読み込み（キャッシュなし）
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="vrm-url">VRM URL</Label>
                <Input
                  id="vrm-url"
                  value={customVrmUrl}
                  onChange={(e) => setCustomVrmUrl(e.target.value)}
                  placeholder="https://example.com/model.vrm"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  テスト用:{" "}
                  <button
                    className="text-blue-500 underline"
                    onClick={() =>
                      setCustomVrmUrl(
                        "https://3d.nicovideo.jp/alicia/alicia.vrm"
                      )
                    }
                  >
                    サンプルVRM1
                  </button>
                  {" | "}
                  <button
                    className="text-blue-500 underline"
                    onClick={() =>
                      setCustomVrmUrl(
                        "https://raw.githubusercontent.com/vrm-c/vrm-samples/master/three-vrm-girl/three-vrm-girl.vrm"
                      )
                    }
                  >
                    サンプルVRM2
                  </button>
                </p>
              </div>

              <div className="border rounded-lg p-4">
                {customVrmUrl ? (
                  <LegacyVRMDisplay vrmUrl={customVrmUrl} />
                ) : (
                  <p className="text-muted-foreground text-center py-8">
                    VRM URLを入力してください
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Blob方式: ファイルアップロード */}
        <TabsContent value="blob" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>💾 ファイル方式: ローカルファイル読み込み</CardTitle>
              <CardDescription>
                ローカルのVRMファイルをアップロードして表示
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="vrm-file">VRMファイル (.vrm)</Label>
                <Input
                  id="vrm-file"
                  type="file"
                  accept=".vrm"
                  onChange={handleFileUpload}
                />
              </div>

              <div className="border rounded-lg p-4">
                {testBlob ? (
                  <div>
                    <p className="text-sm text-muted-foreground mb-2">
                      ファイルサイズ: {(testBlob.size / 1024 / 1024).toFixed(2)}{" "}
                      MB
                    </p>
                    <BlobVRMDisplay vrmBlob={testBlob} />
                  </div>
                ) : (
                  <p className="text-muted-foreground text-center py-8">
                    VRMファイルをアップロードしてください
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* インタラクティブ方式: ダウンロード機能付き */}
        <TabsContent value="interactive" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>🎮 インタラクティブ方式: フル機能</CardTitle>
              <CardDescription>
                VRM表示 + ダウンロード + キャッシュ管理機能
              </CardDescription>
            </CardHeader>
            <CardContent>
              <InteractiveVRMDisplay model={testModel} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* デバッグ情報 */}
      <Card>
        <CardHeader>
          <CardTitle>🔧 デバッグ情報</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <h4 className="font-semibold mb-2">現在のテストモデル:</h4>
              <pre className="bg-muted p-2 rounded text-xs overflow-auto max-h-40">
                {JSON.stringify(testModel, null, 2)}
              </pre>
            </div>
            <div>
              <h4 className="font-semibold mb-2">ブラウザ情報:</h4>
              <ul className="space-y-1">
                <li>
                  WebGL:{" "}
                  {typeof WebGLRenderingContext !== "undefined"
                    ? "✅ 対応"
                    : "❌ 非対応"}
                </li>
                <li>
                  IndexedDB:{" "}
                  {typeof indexedDB !== "undefined" ? "✅ 対応" : "❌ 非対応"}
                </li>
                <li>
                  User Agent:{" "}
                  <code className="text-xs">
                    {typeof navigator !== "undefined"
                      ? navigator.userAgent.slice(0, 50) + "..."
                      : "N/A"}
                  </code>
                </li>
              </ul>
            </div>
          </div>

          {/* API テスト用ボタン */}
          <div className="mt-4 pt-4 border-t">
            <h4 className="font-semibold mb-2">🧪 API直接テスト:</h4>
            <div className="flex gap-2 flex-wrap">
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  try {
                    const response = await fetch(
                      "/api/vroid/download-license",
                      {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ model_id: testModel.id }),
                      }
                    );
                    const data = await response.json();
                    console.log("📋 Download License API Test:", {
                      status: response.status,
                      ok: response.ok,
                      data,
                    });
                    alert(
                      `API Response: ${response.status} - ${JSON.stringify(data, null, 2)}`
                    );
                  } catch (error) {
                    console.error("API Test Error:", error);
                    alert(`Error: ${error}`);
                  }
                }}
              >
                Download License APIテスト
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  try {
                    const response = await fetch("/api/debug/session");
                    const data = await response.json();
                    console.log("📋 Session Debug:", data);
                    alert(`Session Status: ${JSON.stringify(data, null, 2)}`);
                  } catch (error) {
                    console.error("Session Test Error:", error);
                    alert(`Error: ${error}`);
                  }
                }}
              >
                セッション確認
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={fetchLikedModelsFromHook}
                disabled={vroidLoading || !isConnected}
              >
                {vroidLoading
                  ? "🔄 取得中..."
                  : "❤️ いいねモデル取得 (フック版)"}
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={fetchLikedModels}
                disabled={isLoadingLikedModels}
              >
                {isLoadingLikedModels
                  ? "🔄 取得中..."
                  : "❤️ いいねモデル取得 (API版)"}
              </Button>
            </div>

            <div className="text-xs text-muted-foreground mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded">
              ⚠️ <strong>API制限について:</strong>{" "}
              個人開発者アカウントでは一部のエンドポイントにアクセスできません。
              手動でモデルIDを設定するか、レガシー方式でパブリックVRMファイルをテストしてください。
            </div>
          </div>

          {/* 手動モデルID設定ヘルパー */}
          <div className="mt-4 pt-4 border-t">
            <h4 className="font-semibold mb-2">🔗 手動でモデルIDを設定:</h4>
            <div className="space-y-2 text-xs">
              <div className="p-3 bg-blue-50 border border-blue-200 rounded">
                <div className="font-semibold mb-2">
                  📋 VRoid HubからモデルIDを取得する方法:
                </div>
                <ol className="list-decimal list-inside space-y-1 text-gray-700">
                  <li>
                    <a
                      href="https://hub.vroid.com"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 underline"
                    >
                      VRoid Hub
                    </a>{" "}
                    にアクセス
                  </li>
                  <li>いいねしたモデルまたは使用したいモデルのページを開く</li>
                  <li>
                    URLから数字のモデルIDをコピー（例:{" "}
                    <code className="bg-gray-200 px-1 rounded">
                      hub.vroid.com/characters/xxx/models/
                      <strong>1234567890123456789</strong>
                    </code>
                    ）
                  </li>
                  <li>
                    上記の「モデルID」フィールドに貼り付けて「モデル更新」をクリック
                  </li>
                </ol>
              </div>

              <div className="p-3 bg-green-50 border border-green-200 rounded">
                <div className="font-semibold mb-2">
                  💡 テスト用おすすめモデルID:
                </div>
                <div className="space-y-1">
                  <button
                    className="block w-full text-left p-2 bg-white border rounded hover:bg-gray-50"
                    onClick={() => {
                      const testId = "1070567262857269786";
                      setCustomModelId(testId);
                      setTestModel({
                        ...testModel,
                        id: testId,
                        name: "Test Model",
                      });
                      alert(`テスト用モデルID ${testId} を設定しました！`);
                    }}
                  >
                    <code className="bg-blue-100 px-1 rounded">
                      1070567262857269786
                    </code>{" "}
                    - 一般的なテストモデル
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* いいねしたモデル一覧 (フック版) */}
          {vroidLikedModels.length > 0 && (
            <div className="mt-4 pt-4 border-t">
              <h4 className="font-semibold mb-2">
                ❤️ いいねモデル一覧 (フック版) ({vroidLikedModels.length}件):
              </h4>
              <div className="max-h-60 overflow-y-auto space-y-2">
                {vroidLikedModels.map(
                  (model: VRoidCharacterModel, index: number) => (
                    <div
                      key={model.id || index}
                      className="p-3 bg-green-50 rounded border border-green-200 text-xs"
                    >
                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <div className="font-semibold">
                            モデル名: {model.name || "名前なし"}
                          </div>
                          <div>
                            モデルID:{" "}
                            <code className="bg-blue-100 px-1 rounded text-blue-800">
                              {model.id}
                            </code>
                          </div>
                          <div>
                            ダウンロード可:{" "}
                            {model.is_downloadable ? "✅" : "❌"}
                          </div>
                          <div>ハート数: {model.heart_count || 0}</div>
                        </div>
                        <div>
                          <div className="font-semibold">キャラクター情報:</div>
                          <div>
                            キャラクター名: {model.character?.name || "不明"}
                          </div>
                          <div>
                            作成者: {model.character?.user?.name || "不明"}
                          </div>
                          <div>
                            プライベート:{" "}
                            {model.character?.is_private ? "🔒" : "🌐"}
                          </div>
                        </div>
                        <div className="flex flex-col gap-1">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-6 px-2 text-xs"
                            onClick={() => {
                              setCustomModelId(model.id);
                              setTestModel({
                                ...testModel,
                                id: model.id,
                                name: model.name || "Liked Model",
                              });
                              updateSelectedModel(model); // VModelContextも更新
                              alert(
                                `モデルID ${model.id} をテスト用に設定しました！`
                              );
                            }}
                          >
                            🔧 テストに使用
                          </Button>
                          {model.portrait_image?.sq150?.url && (
                            <img
                              src={model.portrait_image.sq150.url}
                              alt={model.name || "Model thumbnail"}
                              className="w-12 h-12 object-cover rounded border"
                            />
                          )}
                        </div>
                      </div>
                    </div>
                  )
                )}
              </div>
            </div>
          )}

          {/* いいねしたモデル一覧 (API版) */}
          {likedModels.length > 0 && (
            <div className="mt-4 pt-4 border-t">
              <h4 className="font-semibold mb-2">
                ❤️ いいねモデル一覧 (API版) ({likedModels.length}件):
              </h4>
              <div className="max-h-60 overflow-y-auto space-y-2">
                {likedModels.map((model: any, index: number) => (
                  <div
                    key={model.id || index}
                    className="p-3 bg-gray-50 rounded border text-xs"
                  >
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <div className="font-semibold">
                          モデル名: {model.name || "名前なし"}
                        </div>
                        <div>
                          モデルID:{" "}
                          <code className="bg-blue-100 px-1 rounded text-blue-800">
                            {model.id}
                          </code>
                        </div>
                        <div>
                          ダウンロード可: {model.is_downloadable ? "✅" : "❌"}
                        </div>
                        <div>ハート数: {model.heart_count || 0}</div>
                      </div>
                      <div>
                        <div className="font-semibold">キャラクター情報:</div>
                        <div>
                          キャラクター名: {model.character?.name || "不明"}
                        </div>
                        <div>
                          作成者: {model.character?.user?.name || "不明"}
                        </div>
                        <div>
                          プライベート:{" "}
                          {model.character?.is_private ? "🔒" : "🌐"}
                        </div>
                      </div>
                      <div className="flex flex-col gap-1">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-6 px-2 text-xs"
                          onClick={() => {
                            setCustomModelId(model.id);
                            setTestModel({
                              ...testModel,
                              id: model.id,
                              name: model.name || "Liked Model",
                            });
                            alert(
                              `モデルID ${model.id} をテスト用に設定しました！`
                            );
                          }}
                        >
                          🔧 テストに使用
                        </Button>
                        {model.portrait_image?.sq150?.url && (
                          <img
                            src={model.portrait_image.sq150.url}
                            alt={model.name || "Model thumbnail"}
                            className="w-12 h-12 object-cover rounded border"
                          />
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default VrmModelPage;
