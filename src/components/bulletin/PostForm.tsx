/**
 * 掲示板投稿フォームコンポーネント
 */

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  BulletinPost,
  PostCategory,
  CreatePostRequest,
  UpdatePostRequest,
  BulletinApiResponse,
} from "@/types/bulletin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, X } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

interface PostFormProps {
  post?: BulletinPost; // 編集時に既存投稿データを渡す
  onSuccess?: () => void;
  className?: string;
}

const categories: PostCategory[] = [
  "雑談",
  "ゲーム",
  "趣味",
  "技術",
  "イベント",
  "その他",
];

export function PostForm({ post, onSuccess, className }: PostFormProps) {
  const router = useRouter();
  const { user } = useAuth();
  const isEdit = !!post;

  const [formData, setFormData] = useState({
    title: post?.title || "",
    content: post?.content || "",
    category: post?.category || ("雑談" as PostCategory),
    maxParticipants: post?.maxParticipants || 2,
    tags: post?.tags || [],
  });
  const [tagInput, setTagInput] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAddTag = () => {
    if (
      tagInput.trim() &&
      !formData.tags.includes(tagInput.trim()) &&
      formData.tags.length < 5
    ) {
      setFormData((prev) => ({
        ...prev,
        tags: [...prev.tags, tagInput.trim()],
      }));
      setTagInput("");
    }
  };

  const handleRemoveTag = (tag: string) => {
    setFormData((prev) => ({
      ...prev,
      tags: prev.tags.filter((t) => t !== tag),
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || isSubmitting) return;

    // バリデーション
    if (!formData.title.trim()) {
      setError("タイトルを入力してください。");
      return;
    }
    if (!formData.content.trim()) {
      setError("内容を入力してください。");
      return;
    }
    if (formData.maxParticipants < 2 || formData.maxParticipants > 10) {
      setError("募集人数は2〜10人の範囲で入力してください。");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      // Firebase ID トークンを取得
      const idToken = await user.getIdToken();

      if (isEdit && post) {
        // 編集
        const updateData: UpdatePostRequest = {
          title: formData.title,
          content: formData.content,
          category: formData.category,
          maxParticipants: formData.maxParticipants,
          tags: formData.tags,
        };

        const response = await fetch(`/api/bulletin/${post.id}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${idToken}`,
          },
          body: JSON.stringify(updateData),
        });

        const data: BulletinApiResponse<BulletinPost> = await response.json();

        if (!data.success) {
          throw new Error(data.error || "投稿の更新に失敗しました。");
        }

        alert("投稿を更新しました。");
        if (onSuccess) {
          onSuccess();
        } else {
          router.push(`/bulletin/${post.id}`);
        }
      } else {
        // 新規作成
        const createData: CreatePostRequest = {
          title: formData.title,
          content: formData.content,
          category: formData.category,
          maxParticipants: formData.maxParticipants,
          tags: formData.tags,
          userName: user.displayName || "ゲストユーザー",
          userPhoto: user.photoURL || undefined,
        };

        const response = await fetch("/api/bulletin", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${idToken}`,
          },
          body: JSON.stringify(createData),
        });

        const data: BulletinApiResponse<BulletinPost> = await response.json();

        if (!data.success || !data.data) {
          throw new Error(data.error || "投稿の作成に失敗しました。");
        }

        alert("投稿を作成しました。");
        if (onSuccess) {
          onSuccess();
        } else {
          router.push(`/bulletin/${data.data.id}`);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "処理に失敗しました。");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!user) {
    return (
      <Card className={className}>
        <div className="p-6 text-center">
          <p className="text-muted-foreground mb-4">
            投稿するにはログインが必要です。
          </p>
          <Button onClick={() => router.push("/login")}>ログイン</Button>
        </div>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <form onSubmit={handleSubmit} className="p-6 space-y-6">
        <div>
          <h2 className="text-2xl font-bold">
            {isEdit ? "投稿を編集" : "新しい投稿を作成"}
          </h2>
        </div>

        {error && (
          <div className="p-4 bg-destructive/10 border border-destructive rounded-lg">
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}

        {/* タイトル */}
        <div className="space-y-2">
          <Label htmlFor="title">タイトル *</Label>
          <Input
            id="title"
            value={formData.title}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, title: e.target.value }))
            }
            placeholder="タイトルを入力..."
            maxLength={100}
            disabled={isSubmitting}
          />
          <p className="text-xs text-muted-foreground text-right">
            {formData.title.length}/100
          </p>
        </div>

        {/* カテゴリ */}
        <div className="space-y-2">
          <Label htmlFor="category">カテゴリ *</Label>
          <Select
            value={formData.category}
            onValueChange={(value) =>
              setFormData((prev) => ({
                ...prev,
                category: value as PostCategory,
              }))
            }
            disabled={isSubmitting}
          >
            <SelectTrigger id="category">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {categories.map((cat) => (
                <SelectItem key={cat} value={cat}>
                  {cat}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* 内容 */}
        <div className="space-y-2">
          <Label htmlFor="content">内容 *</Label>
          <textarea
            id="content"
            value={formData.content}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, content: e.target.value }))
            }
            placeholder="内容を入力..."
            className="w-full min-h-[200px] px-3 py-2 text-sm border border-input rounded-md bg-background resize-y focus:outline-none focus:ring-2 focus:ring-ring"
            maxLength={1000}
            disabled={isSubmitting}
          />
          <p className="text-xs text-muted-foreground text-right">
            {formData.content.length}/1000
          </p>
        </div>

        {/* 募集人数 */}
        <div className="space-y-2">
          <Label htmlFor="maxParticipants">募集人数 *</Label>
          <div className="flex items-center gap-2">
            <Input
              id="maxParticipants"
              type="number"
              min={2}
              max={10}
              value={formData.maxParticipants}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  maxParticipants: parseInt(e.target.value) || 2,
                }))
              }
              className="w-24"
              disabled={isSubmitting}
            />
            <span className="text-sm text-muted-foreground">人 (2〜10人)</span>
          </div>
        </div>

        {/* タグ */}
        <div className="space-y-2">
          <Label htmlFor="tags">タグ（最大5個）</Label>
          <div className="flex gap-2">
            <Input
              id="tags"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => {
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
                !tagInput.trim() || formData.tags.length >= 5 || isSubmitting
              }
              variant="secondary"
            >
              追加
            </Button>
          </div>
          {formData.tags.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-2">
              {formData.tags.map((tag) => (
                <Badge key={tag} variant="secondary" className="gap-1">
                  #{tag}
                  <button
                    type="button"
                    onClick={() => handleRemoveTag(tag)}
                    className="ml-1 hover:text-destructive"
                    disabled={isSubmitting}
                  >
                    <X className="w-3 h-3" />
                  </button>
                </Badge>
              ))}
            </div>
          )}
        </div>

        {/* ボタン群 */}
        <div className="flex justify-end gap-3 pt-4 border-t">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.back()}
            disabled={isSubmitting}
          >
            キャンセル
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                {isEdit ? "更新中..." : "作成中..."}
              </>
            ) : isEdit ? (
              "更新する"
            ) : (
              "投稿する"
            )}
          </Button>
        </div>
      </form>
    </Card>
  );
}
