/**
 * 投稿カードのスケルトンローディング
 */

import { Card, Skeleton } from "@/components/ui";
import { cn } from "@/lib/utils";

interface PostCardSkeletonProps {
  className?: string;
}

export function PostCardSkeleton({ className }: PostCardSkeletonProps) {
  return (
    <Card
      className={cn(
        "p-4 transition-all duration-300",
        "border-2",
        "backdrop-blur-sm bg-card/95",
        className
      )}
    >
      {/* ヘッダー */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2 flex-1">
          <Skeleton className="w-8 h-8 rounded-full" />
          <div className="flex-1 min-w-0 space-y-1">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-3 w-14" />
          </div>
        </div>
        <Skeleton className="h-6 w-16 rounded-full" />
      </div>

      {/* タイトルと内容 */}
      <div className="mb-3 space-y-2">
        <Skeleton className="h-7 w-3/4" />
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-2/3" />
      </div>

      {/* タグ */}
      <div className="flex flex-wrap gap-1.5 mb-2">
        <Skeleton className="h-5 w-14 rounded-full" />
        <Skeleton className="h-5 w-16 rounded-full" />
        <Skeleton className="h-5 w-12 rounded-full" />
      </div>

      {/* フッター */}
      <div className="flex items-center justify-between pt-3 border-t mt-3">
        <div className="flex items-center gap-3">
          <Skeleton className="h-7 w-10" />
          <Skeleton className="h-7 w-8" />
          <Skeleton className="h-7 w-12" />
          <Skeleton className="h-7 w-16" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-6 w-14" />
        </div>
      </div>
    </Card>
  );
}
