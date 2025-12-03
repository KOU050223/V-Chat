/**
 * 返信編集フォームコンポーネント
 */

"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { BulletinReply } from "@/types/bulletin";
import { useAuth } from "@/contexts/AuthContext";

interface EditReplyFormProps {
  reply: BulletinReply;
  postId: string;
  onSuccess: () => void;
  onCancel: () => void;
  className?: string;
}

export function EditReplyForm({
  reply,
  postId,
  onSuccess,
  onCancel,
  className,
}: EditReplyFormProps) {
  const { user } = useAuth();
  const [content, setContent] = useState(reply.content);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() || isSubmitting || !user) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/bulletin/${postId}/replies/${reply.id}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ content: content.trim() }),
        }
      );

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || "返信の更新に失敗しました");
      }

      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "処理に失敗しました");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className={className}>
      {error && (
        <div className="p-3 mb-4 bg-destructive/10 border border-destructive rounded-lg">
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="space-y-3">
          <Label htmlFor="reply-content">返信を編集</Label>
          <textarea
            id="reply-content"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="返信を入力..."
            className="w-full min-h-[100px] px-3 py-2 text-sm border border-input rounded-md bg-background resize-y focus:outline-none focus:ring-2 focus:ring-ring"
            maxLength={500}
            disabled={isSubmitting}
            required
          />
          <p className="text-xs text-muted-foreground text-right">
            {content.length}/500
          </p>
        </div>

        <div className="flex justify-end gap-2 mt-4">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={isSubmitting}
          >
            キャンセル
          </Button>
          <Button type="submit" disabled={!content.trim() || isSubmitting}>
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
    </div>
  );
}
