/**
 * 投稿カードコンポーネント
 */

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BulletinPost } from "@/types/bulletin";
import { Avatar, Badge, Button, Card } from "@/components/ui";
import {
  Heart,
  MessageCircle,
  Users,
  Calendar,
  ExternalLink,
  Bookmark,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";

interface PostCardProps {
  post: BulletinPost;
  onLike?: (postId: string) => void;
  onUnlike?: (postId: string) => void;
  onBookmark?: (postId: string) => void;
  onUnbookmark?: (postId: string) => void;
  className?: string;
}

export function PostCard({
  post,
  onLike,
  onUnlike,
  onBookmark,
  onUnbookmark,
  className,
}: PostCardProps) {
  const router = useRouter();
  const { user } = useAuth();
  const [isLiking, setIsLiking] = useState(false);
  const [isBookmarking, setIsBookmarking] = useState(false);

  const isLiked = user ? post.likes.includes(user.uid) : false;
  const isBookmarked = post.isBookmarked || false;
  const remainingSlots = post.maxParticipants - post.currentParticipants;
  const isFull = remainingSlots <= 0;

  const handleLike = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user || isLiking) return;

    setIsLiking(true);
    try {
      if (isLiked && onUnlike) {
        await onUnlike(post.id);
      } else if (!isLiked && onLike) {
        await onLike(post.id);
      }
    } finally {
      setIsLiking(false);
    }
  };

  const handleBookmark = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user || isBookmarking) return;

    setIsBookmarking(true);
    try {
      if (isBookmarked && onUnbookmark) {
        await onUnbookmark(post.id);
      } else if (!isBookmarked && onBookmark) {
        await onBookmark(post.id);
      }
    } finally {
      setIsBookmarking(false);
    }
  };

  const handleCardClick = () => {
    router.push(`/bulletin/${post.id}`);
  };

  const getCategoryColor = (category: string) => {
    const colors = {
      雑談: "bg-blue-100 text-blue-800 border-blue-200",
      ゲーム: "bg-purple-100 text-purple-800 border-purple-200",
      趣味: "bg-green-100 text-green-800 border-green-200",
      技術: "bg-orange-100 text-orange-800 border-orange-200",
      イベント: "bg-pink-100 text-pink-800 border-pink-200",
      その他: "bg-gray-100 text-gray-800 border-gray-200",
    };
    return colors[category as keyof typeof colors] || colors["その他"];
  };

  const formatDate = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - new Date(date).getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return "たった今";
    if (minutes < 60) return `${minutes}分前`;
    if (hours < 24) return `${hours}時間前`;
    if (days < 7) return `${days}日前`;
    return new Date(date).toLocaleDateString("ja-JP");
  };

  return (
    <Card
      className={cn(
        "p-6 cursor-pointer transition-all duration-300 hover:shadow-lg hover:-translate-y-1",
        "border-2 hover:border-primary/50",
        className
      )}
      onClick={handleCardClick}
    >
      {/* ヘッダー */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3 flex-1">
          <Avatar className="w-10 h-10">
            {post.authorPhoto ? (
              <img
                src={post.authorPhoto}
                alt={post.authorName}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center text-white font-bold">
                {post.authorName[0]}
              </div>
            )}
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm truncate">{post.authorName}</p>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Calendar className="w-3 h-3" />
              <span>{formatDate(post.createdAt)}</span>
            </div>
          </div>
        </div>
        <Badge variant="outline" className={getCategoryColor(post.category)}>
          {post.category}
        </Badge>
      </div>

      {/* タイトルと内容 */}
      <div className="mb-4">
        <h3 className="text-lg font-bold mb-2 line-clamp-2 hover:text-primary transition-colors">
          {post.title}
        </h3>
        <p className="text-sm text-muted-foreground line-clamp-3">
          {post.content}
        </p>
      </div>

      {/* タグ */}
      {post.tags && post.tags.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {post.tags.map((tag, index) => (
            <Badge key={index} variant="secondary" className="text-xs">
              #{tag}
            </Badge>
          ))}
        </div>
      )}

      {/* フッター */}
      <div className="flex items-center justify-between pt-4 border-t">
        <div className="flex items-center gap-4">
          {/* いいねボタン */}
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              "gap-2 transition-colors",
              isLiked && "text-red-500 hover:text-red-600"
            )}
            onClick={handleLike}
            disabled={!user || isLiking}
          >
            <Heart className={cn("w-4 h-4", isLiked && "fill-current")} />
            <span className="text-sm">{post.likes.length}</span>
          </Button>

          {/* ブックマークボタン */}
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              "gap-2 transition-colors",
              isBookmarked && "text-yellow-500 hover:text-yellow-600"
            )}
            onClick={handleBookmark}
            disabled={!user || isBookmarking}
          >
            <Bookmark
              className={cn("w-4 h-4", isBookmarked && "fill-current")}
            />
          </Button>

          {/* 返信数 */}
          <div className="flex items-center gap-2 text-muted-foreground">
            <MessageCircle className="w-4 h-4" />
            <span className="text-sm">返信</span>
          </div>

          {/* ルームリンク */}
          {post.roomId && (
            <Button
              variant="ghost"
              size="sm"
              className="gap-2 text-primary"
              onClick={(e) => {
                e.stopPropagation();
                router.push(`/room/${post.roomId}`);
              }}
            >
              <ExternalLink className="w-4 h-4" />
              <span className="text-sm">ルームへ</span>
            </Button>
          )}
        </div>

        {/* 募集人数 */}
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-muted-foreground" />
          <span
            className={cn(
              "text-sm font-medium",
              isFull ? "text-red-500" : "text-primary"
            )}
          >
            {post.currentParticipants}/{post.maxParticipants}
          </span>
          {isFull && (
            <Badge variant="destructive" className="text-xs">
              満員
            </Badge>
          )}
          {!isFull && remainingSlots <= 2 && (
            <Badge
              variant="secondary"
              className="text-xs bg-yellow-100 text-yellow-800 border-yellow-200"
            >
              残り{remainingSlots}人
            </Badge>
          )}
        </div>
      </div>
    </Card>
  );
}
