/**
 * 投稿編集ページ
 */

"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, X, Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import {
  BulletinPost,
  PostCategory,
  UpdatePostRequest,
  BulletinApiResponse,
} from "@/types/bulletin";

interface PageProps {
  params: Promise<{
    postId: string;
  }>;
}

const categories: PostCategory[] = [
  "雑談",
  "ゲーム",
  "趣味",
  "技術",
  "イベント",
  "その他",
];

export default function EditPostPage({ params }: PageProps) {
  const resolvedParams = use(params);
  return <EditPostContent postId={resolvedParams.postId} />;
}

function EditPostContent({ postId }: { postId: string }) {
  const router = useRouter();
  const { user } = useAuth();
  const [post, setPost] = useState<BulletinPost | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    title: "",
    content: "",
    category: "雑談" as PostCategory,
    maxParticipants: 2,
    tags: [] as string[],
  });
  const [tagInput, setTagInput] = useState("");

  // 投稿データ取得
  useEffect(() => {
    const fetchPost = async () => {
      setIsLoading(true);
      try {
        const response = await fetch(`/api/bulletin/${postId}`);
        const data: BulletinApiResponse<BulletinPost> = await response.json();

        if (!data.success || !data.data) {
          throw new Error(data.error || "投稿の取得に失敗しました");
        }

        const postData = data.data;
        setPost(postData);
        setFormData({
          title: postData.title,
          content: postData.content,
          category: postData.category,
          maxParticipants: postData.maxParticipants,
          tags: postData.tags || [],
        });
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "投稿の取得に失敗しました"
        );
      } finally {
        setIsLoading(false);
      }
    };

    fetchPost();
  }, [postId]);

  const handleAddTag = () => {
    const tag = tagInput.trim();
    if (tag && !formData.tags.includes(tag) && formData.tags.length < 5) {
      setFormData((prev) => ({
        ...prev,
        tags: [...prev.tags, tag],
      }));
      setTagInput("");
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setFormData((prev) => ({
      ...prev,
      tags: prev.tags.filter((tag) => tag !== tagToRemove),
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !post || isSubmitting) return;

    // 権限チェック
    if (post.authorId !== user.uid) {
      setError("この投稿を編集する権限がありません");
      return;
    }

    // バリデーション
    if (!formData.title.trim()) {
      setError("タイトルを入力してください");
      return;
    }
    if (!formData.content.trim()) {
      setError("内容を入力してください");
      return;
    }
    if (formData.maxParticipants < 2 || formData.maxParticipants > 10) {
      setError("最大参加人数は2〜10人で入力してください");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const updateData: UpdatePostRequest = {
        title: formData.title,
        content: formData.content,
        category: formData.category,
        maxParticipants: formData.maxParticipants,
        tags: formData.tags,
      };

      const response = await fetch(`/api/bulletin/${postId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(updateData),
      });

      const data: BulletinApiResponse<BulletinPost> = await response.json();

      if (!data.success) {
        throw new Error(data.error || "投稿の更新に失敗しました");
      }

      alert("投稿を更新しました");
      router.push(`/bulletin/${postId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "投稿の更新に失敗しました");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background to-muted/20 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background to-muted/20 p-4">
        <div className="max-w-2xl mx-auto pt-20">
          <Card className="p-8 text-center">
            <p className="text-muted-foreground mb-4">
              投稿を編集するにはログインが必要です
            </p>
            <Button onClick={() => router.push("/login")}>ログイン</Button>
          </Card>
        </div>
      </div>
    );
  }

  if (error && !post) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background to-muted/20 p-4">
        <div className="max-w-2xl mx-auto pt-20">
          <Card className="p-8 text-center">
            <p className="text-destructive mb-4">{error}</p>
            <Button onClick={() => router.push("/bulletin")}>
              掲示板に戻る
            </Button>
          </Card>
        </div>
      </div>
    );
  }

  if (post && post.authorId !== user.uid) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background to-muted/20 p-4">
        <div className="max-w-2xl mx-auto pt-20">
          <Card className="p-8 text-center">
            <p className="text-destructive mb-4">
              この投稿を編集する権限がありません
            </p>
            <Button onClick={() => router.push(`/bulletin/${postId}`)}>
              投稿詳細に戻る
            </Button>
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
            onClick={() => router.push(`/bulletin/${postId}`)}
            className="gap-2 mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            投稿詳細に戻る
          </Button>
          <h1 className="text-3xl font-bold">投稿編集</h1>
          <p className="text-muted-foreground mt-2">投稿の内容を更新します</p>
        </div>

        {/* フォーム */}
        <Card className="p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* エラー表示 */}
            {error && (
              <div className="p-3 rounded-md bg-destructive/10 text-destructive text-sm">
                {error}
              </div>
            )}

            {/* タイトル */}
            <div className="space-y-2">
              <Label htmlFor="title">タイトル *</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) =>
                  setFormData({ ...formData, title: e.target.value })
                }
                placeholder="タイトルを入力..."
                required
                maxLength={100}
                disabled={isSubmitting}
              />
              <p className="text-xs text-muted-foreground text-right">
                {formData.title.length}/100
              </p>
            </div>

            {/* カテゴリと参加人数 */}
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
                <Label htmlFor="maxParticipants">最大参加人数 *</Label>
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

            {/* 内容 */}
            <div className="space-y-2">
              <Label htmlFor="content">内容 *</Label>
              <textarea
                id="content"
                value={formData.content}
                onChange={(e) =>
                  setFormData({ ...formData, content: e.target.value })
                }
                placeholder="内容を入力..."
                className="w-full min-h-[200px] px-3 py-2 rounded-md border border-input bg-background resize-y focus:outline-none focus:ring-2 focus:ring-ring"
                required
                maxLength={1000}
                disabled={isSubmitting}
              />
              <p className="text-xs text-muted-foreground text-right">
                {formData.content.length}/1000
              </p>
            </div>

            {/* タグ */}
            <div className="space-y-2">
              <Label htmlFor="tags">タグ（最大5個）</Label>
              <div className="flex gap-2">
                <Input
                  id="tags"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAddTag();
                    }
                  }}
                  placeholder="タグを入力してEnter"
                  maxLength={20}
                  disabled={isSubmitting || formData.tags.length >= 5}
                />
                <Button
                  type="button"
                  onClick={handleAddTag}
                  disabled={
                    !tagInput.trim() ||
                    formData.tags.length >= 5 ||
                    isSubmitting
                  }
                  variant="secondary"
                >
                  追加
                </Button>
              </div>
              {formData.tags.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {formData.tags.map((tag, index) => (
                    <Badge key={index} variant="secondary" className="gap-2">
                      #{tag}
                      <button
                        type="button"
                        onClick={() => handleRemoveTag(tag)}
                        className="hover:text-destructive"
                        disabled={isSubmitting}
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            {/* ボタン */}
            <div className="flex gap-3 justify-end pt-4 border-t">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push(`/bulletin/${postId}`)}
                disabled={isSubmitting}
              >
                キャンセル
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    更新中...
                  </>
                ) : (
                  "更新する"
                )}
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </div>
  );
}
