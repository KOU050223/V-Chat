/**
 * 返信リストコンポーネント - Twitter風デザイン
 */

'use client';

import { BulletinReply } from '@/types/bulletin';
import { Avatar } from '@/components/ui/avatar';

interface ReplyListProps {
  replies: BulletinReply[];
  className?: string;
}

export function ReplyList({ replies, className }: ReplyListProps) {
  const formatDate = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - new Date(date).getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'たった今';
    if (minutes < 60) return `${minutes}分前`;
    if (hours < 24) return `${hours}時間前`;
    if (days < 7) return `${days}日前`;
    return new Date(date).toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  if (!replies || replies.length === 0) {
    return (
      <div className={className}>
        <div className="py-12 text-center">
          <p className="text-muted-foreground text-sm">まだ返信がありません</p>
          <p className="text-muted-foreground text-xs mt-1">
            最初に返信してみましょう！
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={className}>
      <div className="divide-y divide-border">
        {replies.map((reply) => (
          <div
            key={reply.id}
            className="py-4 hover:bg-muted/30 transition-colors cursor-pointer"
          >
            <div className="flex gap-3 px-2">
              {/* アバター */}
              <Avatar className="w-10 h-10 flex-shrink-0">
                {reply.authorPhoto ? (
                  <img
                    src={reply.authorPhoto}
                    alt={reply.authorName}
                    className="w-full h-full object-cover rounded-full"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center text-white font-bold rounded-full">
                    {reply.authorName[0]}
                  </div>
                )}
              </Avatar>

              {/* 返信内容 */}
              <div className="flex-1 min-w-0">
                {/* ヘッダー（名前と時間） */}
                <div className="flex items-baseline gap-2 mb-1">
                  <span className="font-semibold text-sm hover:underline">
                    {reply.authorName}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    · {formatDate(reply.createdAt)}
                  </span>
                </div>

                {/* 返信テキスト */}
                <p className="text-sm whitespace-pre-wrap break-words leading-relaxed">
                  {reply.content}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
