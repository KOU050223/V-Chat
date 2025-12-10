/**
 * 投稿作成ページ
 */

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, Input, Label } from "@/components/ui";
import { ArrowLeft } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { PostCategory, CreatePostRequest } from "@/types/bulletin";
import { handleError } from "@/lib/utils";

const categories: PostCategory[] = [
  "雑談",
  "ゲーム",
  "趣味",
  "技術",
  "イベント",
  "その他",
];

export default function CreatePostPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState<CreatePostRequest>({
    title: "",
    content: "",
    category: "雑談",
    maxParticipants: 4,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      setError("ログインが必要です");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      // Firebase ID トークンを取得
      const idToken = await user.getIdToken();

      const response = await fetch("/api/bulletin", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          ...formData,
          userName: user.displayName || "ユーザー",
          userPhoto: user.photoURL || "",
        }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || "投稿の作成に失敗しました");
      }

      router.push(`/bulletin/${data.data.id}`);
    } catch (err) {
      setError(handleError("投稿作成エラー", err));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background to-muted/20 p-4">
        <div className="max-w-2xl mx-auto pt-20">
          <Card className="p-8 text-center">
            <p className="text-muted-foreground mb-4">
              投稿を作成するにはログインが必要です
            </p>
            <Button onClick={() => router.push("/login")}>ログイン</Button>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted/20 p-4">
      <div className="max-w-2xl mx-auto pt-8">
        {/* ヘッダー */}
        <div className="mb-6">
          <Button
            variant="ghost"
            onClick={() => router.back()}
            className="gap-2 mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            戻る
          </Button>
          <h1 className="text-3xl font-bold">新しい投稿を作成</h1>
          <p className="text-muted-foreground mt-2">
            話題を共有して、仲間を募集しましょう
          </p>
        </div>

        {/* フォーム */}
        <Card className="p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* タイトル */}
            <div className="space-y-2">
              <Label htmlFor="title">タイトル *</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) =>
                  setFormData({ ...formData, title: e.target.value })
                }
                placeholder="例: マインクラフトで一緒に遊びませんか？"
                required
                maxLength={100}
                disabled={isSubmitting}
              />
              <p className="text-xs text-muted-foreground">
                {formData.title.length}/100
              </p>
            </div>

            {/* カテゴリと募集人数 */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="category">カテゴリ *</Label>
                <select
                  id="category"
                  value={formData.category}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      category: e.target.value as PostCategory,
                    })
                  }
                  className="w-full px-3 py-2 rounded-md border border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                  disabled={isSubmitting}
                >
                  {categories.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="maxParticipants">募集人数 *</Label>
                <Input
                  id="maxParticipants"
                  type="number"
                  min={2}
                  max={10}
                  value={formData.maxParticipants}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      maxParticipants: parseInt(e.target.value) || 2,
                    })
                  }
                  disabled={isSubmitting}
                />
              </div>
            </div>

            {/* 本文 */}
            <div className="space-y-2">
              <Label htmlFor="content">本文 *</Label>
              <textarea
                id="content"
                value={formData.content}
                onChange={(e) =>
                  setFormData({ ...formData, content: e.target.value })
                }
                placeholder="詳細な内容を入力してください..."
                className="w-full min-h-[200px] px-3 py-2 rounded-md border border-input bg-background resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                required
                maxLength={1000}
                disabled={isSubmitting}
              />
              <p className="text-xs text-muted-foreground">
                {formData.content.length}/1000
              </p>
            </div>

            {/* エラー表示 */}
            {error && (
              <div className="p-3 rounded-md bg-destructive/10 text-destructive text-sm">
                {error}
              </div>
            )}

            {/* 送信ボタン */}
            <div className="flex gap-3 justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.back()}
                disabled={isSubmitting}
              >
                キャンセル
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "作成中..." : "投稿を作成"}
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </div>
  );
}
