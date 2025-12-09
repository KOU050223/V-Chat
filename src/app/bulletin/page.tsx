/**
 * 掲示板一覧ページ
 */

"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { PostCard } from "@/components/bulletin/PostCard";
import { Badge, Button, Card, Input } from "@/components/ui";
import {
  Plus,
  Search,
  Filter,
  Loader2,
  ArrowLeft,
  Bookmark,
} from "lucide-react";
import { BulletinPost, SortOrder, PostCategory } from "@/types/bulletin";
import { useAuth } from "@/contexts/AuthContext";
import { handleError } from "@/lib/utils";

const sortOrders: { value: SortOrder; label: string }[] = [
  { value: "newest", label: "新着順" },
  { value: "popular", label: "人気順" },
  { value: "participants", label: "募集中" },
];

const categories: PostCategory[] = [
  "雑談",
  "ゲーム",
  "趣味",
  "技術",
  "イベント",
  "その他",
];

export default function BulletinPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [posts, setPosts] = useState<BulletinPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // フィルター状態
  const [searchQuery, setSearchQuery] = useState("");
  const [sortOrder, setSortOrder] = useState<SortOrder>("newest");
  const [selectedCategories, setSelectedCategories] = useState<PostCategory[]>(
    []
  );
  const [showFilters, setShowFilters] = useState(false);

  // 投稿取得
  const fetchPosts = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (searchQuery) params.append("search", searchQuery);
      params.append("sortOrder", sortOrder);
      if (selectedCategories.length > 0) {
        params.append("categories", selectedCategories.join(","));
      }

      const response = await fetch(`/api/bulletin?${params.toString()}`);
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || "投稿の取得に失敗しました");
      }

      // Date型に変換
      const postsWithDates = data.data.map((post: Record<string, unknown>) => ({
        ...post,
        createdAt: new Date(post.createdAt as string),
        updatedAt: new Date(post.updatedAt as string),
      }));

      setPosts(postsWithDates);
    } catch (err) {
      setError(handleError("投稿取得エラー", err));
    } finally {
      setLoading(false);
    }
  }, [searchQuery, sortOrder, selectedCategories]);

  // いいね処理
  const handleLike = async (postId: string) => {
    if (!user) return;

    try {
      // Firebase ID トークンを取得
      const idToken = await user.getIdToken();

      const response = await fetch(`/api/bulletin/${postId}/like`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || "いいねに失敗しました");
      }

      // 投稿を更新
      setPosts((prev) =>
        prev.map((post) =>
          post.id === postId
            ? {
                ...post,
                likes: data.data.likes,
                updatedAt: new Date(data.data.updatedAt),
              }
            : post
        )
      );
    } catch (err) {
      console.error(handleError("いいねエラー", err));
    }
  };

  // カテゴリフィルターのトグル
  const toggleCategory = (category: PostCategory) => {
    setSelectedCategories((prev) =>
      prev.includes(category)
        ? prev.filter((c) => c !== category)
        : [...prev, category]
    );
  };

  // ブックマーク追加
  const handleBookmark = async (postId: string) => {
    if (!user) return;

    try {
      const idToken = await user.getIdToken();

      const response = await fetch("/api/bookmark", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ postId }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || "ブックマークに失敗しました");
      }

      // 投稿のブックマーク状態を更新
      setPosts((prev) =>
        prev.map((post) =>
          post.id === postId ? { ...post, isBookmarked: true } : post
        )
      );
    } catch (err) {
      console.error(handleError("ブックマークエラー", err));
    }
  };

  // ブックマーク削除
  const handleUnbookmark = async (postId: string) => {
    if (!user) return;

    try {
      const idToken = await user.getIdToken();

      const response = await fetch(`/api/bookmark?postId=${postId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${idToken}`,
        },
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || "ブックマーク削除に失敗しました");
      }

      // 投稿のブックマーク状態を更新
      setPosts((prev) =>
        prev.map((post) =>
          post.id === postId ? { ...post, isBookmarked: false } : post
        )
      );
    } catch (err) {
      console.error(handleError("ブックマーク削除エラー", err));
    }
  };

  // 初回読み込みとフィルター変更時の再読み込み（300msデバウンス）
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchPosts();
    }, 300);

    return () => clearTimeout(timer);
  }, [fetchPosts]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted/20">
      <div className="max-w-6xl mx-auto p-4 py-8">
        {/* ヘッダー */}
        <div className="mb-8">
          <Button
            variant="ghost"
            onClick={() => router.push("/dashboard")}
            className="mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            ダッシュボードに戻る
          </Button>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
                掲示板
              </h1>
              <p className="text-muted-foreground mt-2">
                話題を共有して、仲間を見つけよう
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => router.push("/bulletin/bookmarks")}
                className="gap-2"
              >
                <Bookmark className="w-4 h-4" />
                ブックマーク
              </Button>
              <Button
                onClick={() => router.push("/bulletin/create")}
                className="gap-2 shadow-lg"
              >
                <Plus className="w-5 h-5" />
                新規投稿
              </Button>
            </div>
          </div>
        </div>

        {/* 検索とフィルター */}
        <Card className="p-4 mb-6">
          <div className="space-y-4">
            {/* 検索バー */}
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="投稿を検索..."
                  className="pl-10"
                />
              </div>
              <Button
                variant="outline"
                onClick={() => setShowFilters(!showFilters)}
                className="gap-2"
              >
                <Filter className="w-4 h-4" />
                フィルター
              </Button>
            </div>

            {/* フィルター */}
            {showFilters && (
              <div className="space-y-4 pt-4 border-t">
                {/* カテゴリフィルター */}
                <div>
                  <p className="text-sm font-medium mb-2">カテゴリ</p>
                  <div className="flex flex-wrap gap-2">
                    {categories.map((category) => (
                      <Badge
                        key={category}
                        variant={
                          selectedCategories.includes(category)
                            ? "default"
                            : "outline"
                        }
                        className="cursor-pointer"
                        onClick={() => toggleCategory(category)}
                      >
                        {category}
                      </Badge>
                    ))}
                  </div>
                  {selectedCategories.length > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedCategories([])}
                      className="mt-2 text-xs"
                    >
                      カテゴリをクリア
                    </Button>
                  )}
                </div>

                {/* ソート順 */}
                <div>
                  <p className="text-sm font-medium mb-2">並び替え</p>
                  <div className="flex flex-wrap gap-2">
                    {sortOrders.map((order) => (
                      <Badge
                        key={order.value}
                        variant={
                          sortOrder === order.value ? "default" : "outline"
                        }
                        className="cursor-pointer"
                        onClick={() => setSortOrder(order.value)}
                      >
                        {order.label}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </Card>

        {/* 投稿一覧 */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : error ? (
          <Card className="p-8 text-center">
            <p className="text-destructive mb-4">{error}</p>
            <Button onClick={fetchPosts}>再試行</Button>
          </Card>
        ) : posts.length === 0 ? (
          <Card className="p-8 text-center">
            <p className="text-muted-foreground mb-4">
              {searchQuery
                ? "条件に一致する投稿が見つかりません"
                : "まだ投稿がありません"}
            </p>
            <Button onClick={() => router.push("/bulletin/create")}>
              最初の投稿を作成
            </Button>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-2">
            {posts.map((post) => (
              <PostCard
                key={post.id}
                post={post}
                onLike={handleLike}
                onUnlike={handleLike}
                onBookmark={handleBookmark}
                onUnbookmark={handleUnbookmark}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
