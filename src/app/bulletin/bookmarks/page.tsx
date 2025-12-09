/**
 * ブックマーク一覧ページ
 */

"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { PostCard } from "@/components/bulletin/PostCard";
import { Button, Card } from "@/components/ui";
import { ArrowLeft, Loader2, Bookmark } from "lucide-react";
import { BulletinPost } from "@/types/bulletin";
import { useAuth } from "@/contexts/AuthContext";
import { handleError } from "@/lib/utils";

export default function BookmarksPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [posts, setPosts] = useState<BulletinPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ブックマーク一覧取得
  const fetchBookmarks = async () => {
    if (!user) {
      router.push("/login");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const idToken = await user.getIdToken();

      const response = await fetch("/api/bookmark", {
        headers: {
          Authorization: `Bearer ${idToken}`,
        },
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || "ブックマークの取得に失敗しました");
      }

      // Date型に変換
      const postsWithDates = data.data.map((post: Record<string, unknown>) => ({
        ...post,
        createdAt: new Date(post.createdAt as string),
        updatedAt: new Date(post.updatedAt as string),
      }));

      setPosts(postsWithDates);
    } catch (err) {
      setError(handleError("ブックマーク取得エラー", err));
    } finally {
      setLoading(false);
    }
  };

  // いいね処理
  const handleLike = async (postId: string) => {
    if (!user) return;

    try {
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

      // 削除した投稿をリストから除外
      setPosts((prev) => prev.filter((post) => post.id !== postId));
    } catch (err) {
      console.error(handleError("ブックマーク削除エラー", err));
    }
  };

  useEffect(() => {
    fetchBookmarks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted/20">
      <div className="max-w-6xl mx-auto p-4 py-8">
        {/* ヘッダー */}
        <div className="mb-8">
          <Button
            variant="ghost"
            onClick={() => router.push("/bulletin")}
            className="mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            掲示板に戻る
          </Button>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-yellow-400 to-yellow-600 flex items-center justify-center">
              <Bookmark className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-yellow-500 to-yellow-600 bg-clip-text text-transparent">
                ブックマーク
              </h1>
              <p className="text-muted-foreground mt-2">
                保存した投稿を確認できます
              </p>
            </div>
          </div>
        </div>

        {/* ブックマーク一覧 */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : error ? (
          <Card className="p-8 text-center">
            <p className="text-destructive mb-4">{error}</p>
            <Button onClick={fetchBookmarks}>再試行</Button>
          </Card>
        ) : posts.length === 0 ? (
          <Card className="p-8 text-center">
            <Bookmark className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground mb-4">
              まだブックマークがありません
            </p>
            <Button onClick={() => router.push("/bulletin")}>
              掲示板を見る
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
                onUnbookmark={handleUnbookmark}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
