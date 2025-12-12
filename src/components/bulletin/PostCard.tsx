/**
 * 投稿カードコンポーネント
 */

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BulletinPost } from "@/types/bulletin";
import { Avatar, Badge, Button, Card } from "@/components/ui";
import { Heart, MessageCircle, Users, Calendar, Bookmark } from "lucide-react";
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
      雑談: "bg-gradient-to-br from-blue-500 to-blue-600 text-white border-blue-300 hover:from-blue-600 hover:to-blue-700 shadow-blue-200",
      ゲーム:
        "bg-gradient-to-br from-purple-500 to-purple-600 text-white border-purple-300 hover:from-purple-600 hover:to-purple-700 shadow-purple-200",
      趣味: "bg-gradient-to-br from-green-500 to-green-600 text-white border-green-300 hover:from-green-600 hover:to-green-700 shadow-green-200",
      技術: "bg-gradient-to-br from-orange-500 to-orange-600 text-white border-orange-300 hover:from-orange-600 hover:to-orange-700 shadow-orange-200",
      イベント:
        "bg-gradient-to-br from-pink-500 to-pink-600 text-white border-pink-300 hover:from-pink-600 hover:to-pink-700 shadow-pink-200",
      その他:
        "bg-gradient-to-br from-gray-500 to-gray-600 text-white border-gray-300 hover:from-gray-600 hover:to-gray-700 shadow-gray-200",
    };
    return colors[category as keyof typeof colors] || colors["その他"];
  };

  const getCategoryIcon = (category: string) => {
    const icons = {
      雑談: "💬",
      ゲーム: "🎮",
      趣味: "🎨",
      技術: "💻",
      イベント: "🎉",
      その他: "📌",
    };
    return icons[category as keyof typeof icons] || icons["その他"];
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
        "p-3 cursor-pointer transition-all duration-200",
        "hover:shadow-lg hover:shadow-primary/5 hover:-translate-y-1",
        "border hover:border-primary/40",
        "backdrop-blur-sm bg-card/95",
        className
      )}
      onClick={handleCardClick}
    >
      {/* ヘッダー */}
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-1.5 flex-1 min-w-0">
          <Avatar className="w-6 h-6 flex-shrink-0">
            {post.authorPhoto ? (
              <img
                src={post.authorPhoto}
                alt={post.authorName}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center text-white text-[10px] font-bold">
                {post.authorName[0]}
              </div>
            )}
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-[11px] truncate">
              {post.authorName}
            </p>
            <div className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
              <Calendar className="w-2.5 h-2.5" />
              <span>{formatDate(post.createdAt)}</span>
            </div>
          </div>
        </div>
        <Badge
          variant="outline"
          className={cn(
            getCategoryColor(post.category),
            "transition-all duration-200 cursor-default text-[10px] px-1.5 py-0 h-5 flex-shrink-0"
          )}
        >
          <span className="mr-0.5 text-xs">
            {getCategoryIcon(post.category)}
          </span>
          {post.category}
        </Badge>
      </div>

      {/* タイトルと内容 */}
      <div className="mb-2">
        <h3 className="text-base font-bold mb-1 line-clamp-1 hover:text-primary transition-colors leading-tight">
          {post.title}
        </h3>
        <p className="text-[11px] text-muted-foreground line-clamp-2 leading-snug">
          {post.content}
        </p>
      </div>

      {/* フッター */}
      <div className="flex items-center justify-between pt-2 border-t mt-2">
        <div className="flex items-center gap-2">
          {/* いいねボタン */}
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              "gap-0.5 h-6 px-1.5 transition-colors",
              isLiked && "text-red-500 hover:text-red-600"
            )}
            onClick={handleLike}
            disabled={!user || isLiking}
          >
            <Heart className={cn("w-3 h-3", isLiked && "fill-current")} />
            <span className="text-[10px] font-semibold">
              {post.likes.length}
            </span>
          </Button>

          {/* ブックマークボタン */}
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              "h-6 px-1.5 transition-colors",
              isBookmarked && "text-yellow-500 hover:text-yellow-600"
            )}
            onClick={handleBookmark}
            disabled={!user || isBookmarking}
          >
            <Bookmark
              className={cn("w-3 h-3", isBookmarked && "fill-current")}
            />
          </Button>

          {/* 返信数 */}
          <div className="flex items-center gap-0.5 text-muted-foreground">
            <MessageCircle className="w-3 h-3" />
            <span className="text-[10px] font-semibold">
              {post.replyCount || 0}
            </span>
          </div>

          {/* ルーム参加ボタン */}
          {post.roomId && (
            <Button
              size="sm"
              className="gap-1 h-6 px-2 text-[10px] bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white border-0 shadow-sm"
              onClick={(e) => {
                e.stopPropagation();
                router.push(`/room/${post.roomId}`);
              }}
            >
              <Users className="w-3 h-3" />
              参加
            </Button>
          )}
        </div>

        {/* 募集人数 */}
        <div className="flex items-center gap-1">
          <Users className="w-3 h-3 text-muted-foreground" />
          <span
            className={cn(
              "text-xs font-bold",
              isFull ? "text-red-500" : "text-primary"
            )}
          >
            {post.currentParticipants}/{post.maxParticipants}
          </span>
          {isFull && (
            <Badge variant="destructive" className="text-[10px] py-0 px-1 h-4">
              満員
            </Badge>
          )}
          {!isFull && remainingSlots <= 2 && (
            <Badge
              variant="secondary"
              className="text-[10px] py-0 px-1 h-4 bg-yellow-100 text-yellow-800 border-yellow-200"
            >
              残{remainingSlots}
            </Badge>
          )}
        </div>
      </div>
    </Card>
  );
}
