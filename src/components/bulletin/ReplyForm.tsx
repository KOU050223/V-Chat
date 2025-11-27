/**
 * 返信フォームコンポーネント - Twitter風デザイン
 */

'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Avatar } from '@/components/ui/avatar';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

interface ReplyFormProps {
  postId: string;
  onSubmit: (content: string) => Promise<void>;
  className?: string;
}

export function ReplyForm({ postId, onSubmit, className }: ReplyFormProps) {
  const { user } = useAuth();
  const [content, setContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() || isSubmitting) return;

    setIsSubmitting(true);
    setError(null);

    try {
      await onSubmit(content);
      setContent('');
    } catch (err) {
      setError(err instanceof Error ? err.message : '返信の投稿に失敗しました');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!user) {
    return (
      <div className={className}>
        <div className="border border-border rounded-lg p-6 text-center">
          <p className="text-muted-foreground text-sm mb-3">
            返信するにはログインが必要です
          </p>
          <Button
            variant="outline"
            onClick={() => (window.location.href = '/login')}
          >
            ログイン
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={className}>
      <form onSubmit={handleSubmit} className="border border-border rounded-lg">
        <div className="flex gap-3 p-4">
          {/* アバター */}
          <Avatar className="w-10 h-10 flex-shrink-0">
            {user.photoURL ? (
              <img
                src={user.photoURL}
                alt={user.displayName || 'User'}
                className="w-full h-full object-cover rounded-full"
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center text-white font-bold rounded-full">
                {(user.displayName || 'U')[0]}
              </div>
            )}
          </Avatar>

          {/* 入力エリア */}
          <div className="flex-1">
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="返信を入力..."
              className="w-full min-h-[80px] px-0 py-2 text-sm bg-transparent border-0 resize-none focus:outline-none placeholder:text-muted-foreground"
              disabled={isSubmitting}
              maxLength={280}
            />

            {error && (
              <div className="mb-2">
                <p className="text-xs text-destructive">{error}</p>
              </div>
            )}

            {/* アクションバー */}
            <div className="flex items-center justify-between pt-2 border-t border-border mt-2">
              <div className="flex items-center gap-1">
                <span className="text-xs text-muted-foreground">
                  {content.length}/280
                </span>
              </div>

              <Button
                type="submit"
                disabled={
                  !content.trim() || isSubmitting || content.length > 280
                }
                size="sm"
                className="rounded-full px-4"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    投稿中...
                  </>
                ) : (
                  '返信'
                )}
              </Button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
