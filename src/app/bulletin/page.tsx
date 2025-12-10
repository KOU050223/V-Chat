/**
 * 掲示板一覧ページ
 */

"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { PostCard } from "@/components/bulletin/PostCard";
import { PostCardSkeleton } from "@/components/bulletin/PostCardSkeleton";
import { Badge, Button, Card, Input } from "@/components/ui";
import {
  Plus,
  Search,
  Filter,
  Loader2,
  ArrowLeft,
  Bookmark,
  Users,
} from "lucide-react";
import { BulletinPost, PostCategory } from "@/types/bulletin";
import { useAuth } from "@/contexts/AuthContext";
import { handleError } from "@/lib/utils";

const baseCategories: PostCategory[] = [
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
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // フィルター状態
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [showFilters, setShowFilters] = useState(false);

  // 無限スクロール用の状態
  const [hasMore, setHasMore] = useState(true);
  const [lastDocId, setLastDocId] = useState<string | null>(null);
  const observerTarget = useRef<HTMLDivElement>(null);

  // 投稿取得（初回読み込み）
  const fetchPosts = useCallback(
    async (reset: boolean = true) => {
      if (reset) {
        setLoading(true);
        setPosts([]);
        setLastDocId(null);
      } else {
        setLoadingMore(true);
      }
      setError(null);

      try {
        const params = new URLSearchParams();
        if (searchQuery) params.append("search", searchQuery);
        params.append("sortOrder", "newest");
        params.append("limit", "20");
        if (selectedCategories.length > 0) {
          params.append("categories", selectedCategories.join(","));
        }
        if (!reset && lastDocId) {
          params.append("lastDocId", lastDocId);
        }

        const response = await fetch(`/api/bulletin?${params.toString()}`);
        const data = await response.json();

        if (!data.success) {
          throw new Error(data.error || "投稿の取得に失敗しました");
        }

        // Date型に変換
        const postsWithDates = data.data.map(
          (post: Record<string, unknown>) => ({
            ...post,
            createdAt: new Date(post.createdAt as string),
            updatedAt: new Date(post.updatedAt as string),
          })
        );

        // 投稿を追加または置き換え
        setPosts((prev) =>
          reset ? postsWithDates : [...prev, ...postsWithDates]
        );

        // 次のページがあるかチェック
        const hasMoreData = response.headers.get("X-Has-More") === "true";
        const nextLastDocId = response.headers.get("X-Last-Doc-Id");
        setHasMore(hasMoreData);
        setLastDocId(nextLastDocId);
      } catch (err) {
        setError(handleError("投稿取得エラー", err));
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [searchQuery, selectedCategories, lastDocId]
  );

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
  const toggleCategory = (category: string) => {
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
      fetchPosts(true);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery, selectedCategories]);

  // 無限スクロール用のIntersectionObserver
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loading && !loadingMore) {
          fetchPosts(false);
        }
      },
      { threshold: 0.1 }
    );

    const currentTarget = observerTarget.current;
    if (currentTarget) {
      observer.observe(currentTarget);
    }

    return () => {
      if (currentTarget) {
        observer.unobserve(currentTarget);
      }
    };
  }, [hasMore, loading, loadingMore, fetchPosts]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted/20">
      <div className="max-w-6xl mx-auto p-4 py-8">
        {/* ヘッダー */}
        <div className="mb-6">
          <Button
            variant="ghost"
            onClick={() => router.push("/dashboard")}
            className="mb-4 font-medium"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            ダッシュボードに戻る
          </Button>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-4xl font-extrabold text-foreground mb-2">
                掲示板
              </h1>
              <p className="text-base text-muted-foreground font-medium">
                話題を共有して、仲間を見つけよう
              </p>
            </div>
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => router.push("/matching")}
                className="gap-2 font-medium border-2"
              >
                <Users className="w-4 h-4" />
                マッチング
              </Button>
              <Button
                variant="outline"
                onClick={() => router.push("/bulletin/bookmarks")}
                className="gap-2 font-medium border-2"
              >
                <Bookmark className="w-4 h-4" />
                ブックマーク
              </Button>
              <Button
                onClick={() => router.push("/bulletin/create")}
                className="gap-2 shadow-lg font-semibold"
              >
                <Plus className="w-5 h-5" />
                新規投稿
              </Button>
            </div>
          </div>
        </div>

        {/* 検索とフィルター */}
        <Card className="p-5 mb-6 shadow-md border-2">
          <div className="space-y-4">
            {/* 検索バー */}
            <div className="flex gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="投稿を検索..."
                  className="pl-10 h-11 text-base border-2 focus:border-primary"
                />
              </div>
              <Button
                variant="outline"
                onClick={() => setShowFilters(!showFilters)}
                className="gap-2 h-11 px-4 font-medium border-2"
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
                  <p className="text-sm font-semibold mb-3 text-foreground">
                    カテゴリ
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {baseCategories.map((category) => (
                      <Badge
                        key={category}
                        variant={
                          selectedCategories.includes(category)
                            ? "default"
                            : "outline"
                        }
                        className="cursor-pointer hover:scale-105 transition-transform text-sm py-1.5 px-3"
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
                      className="mt-3 text-sm font-medium"
                    >
                      フィルターをクリア
                    </Button>
                  )}
                </div>
              </div>
            )}
          </div>
        </Card>

        {/* 投稿一覧 */}
        {loading ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[...Array(6)].map((_, i) => (
              <PostCardSkeleton key={i} />
            ))}
          </div>
        ) : error ? (
          <Card className="p-10 text-center border-2 shadow-md">
            <p className="text-destructive mb-6 text-lg font-semibold">
              {error}
            </p>
            <Button onClick={() => fetchPosts(true)} className="font-medium">
              再試行
            </Button>
          </Card>
        ) : posts.length === 0 ? (
          <Card className="p-10 text-center border-2 shadow-md">
            <p className="text-muted-foreground mb-6 text-lg font-medium">
              {searchQuery || selectedCategories.length > 0
                ? "条件に一致する投稿が見つかりません"
                : "まだ投稿がありません"}
            </p>
            <Button
              onClick={() => router.push("/bulletin/create")}
              className="font-semibold shadow-lg"
            >
              最初の投稿を作成
            </Button>
          </Card>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
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

            {/* 無限スクロール用の監視対象要素 */}
            {hasMore && (
              <div ref={observerTarget} className="py-10 text-center">
                {loadingMore && (
                  <div className="flex items-center justify-center gap-3">
                    <Loader2 className="w-6 h-6 animate-spin text-primary" />
                    <span className="text-base font-medium text-muted-foreground">
                      読み込み中...
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* すべて読み込み完了 */}
            {!hasMore && posts.length > 0 && (
              <div className="py-10 text-center">
                <p className="text-base font-medium text-muted-foreground">
                  すべての投稿を表示しました
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
