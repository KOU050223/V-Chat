/**
 * 返信リストコンポーネント - Twitter風デザイン
 */

"use client";

import { useState } from "react";
import { BulletinReply } from "@/types/bulletin";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Edit, Trash2, MoreHorizontal } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EditReplyForm } from "./EditReplyForm";
import { useAuth } from "@/contexts/AuthContext";

interface ReplyListProps {
  replies: BulletinReply[];
  postId: string;
  onUpdate: () => void;
  className?: string;
}

export function ReplyList({
  replies,
  postId,
  onUpdate,
  className,
}: ReplyListProps) {
  const { user } = useAuth();
  const [editingReplyId, setEditingReplyId] = useState<string | null>(null);
  const [deletingReplyId, setDeletingReplyId] = useState<string | null>(null);

  const handleDeleteReply = async (reply: BulletinReply) => {
    if (!user) return;

    const confirmDelete = window.confirm(
      "本当にこの返信を削除しますか？\nこの操作は取り消せません。"
    );

    if (!confirmDelete) return;

    setDeletingReplyId(reply.id);

    try {
      // Firebase ID トークンを取得
      const idToken = await user.getIdToken();

      const response = await fetch(
        `/api/bulletin/${postId}/replies/${reply.id}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${idToken}`,
          },
        }
      );

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || "返信の削除に失敗しました");
      }

      onUpdate();
    } catch (err) {
      console.error("返信削除エラー:", err);
      alert(err instanceof Error ? err.message : "返信の削除に失敗しました");
    } finally {
      setDeletingReplyId(null);
    }
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
    return new Date(date).toLocaleDateString("ja-JP", {
      year: "numeric",
      month: "short",
      day: "numeric",
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
        {replies.map((reply) => {
          const isAuthor = user && reply.authorId === user.uid;
          const isEditing = editingReplyId === reply.id;

          return (
            <div
              key={reply.id}
              className="py-4 hover:bg-muted/30 transition-colors"
            >
              {isEditing ? (
                // 編集フォーム
                <div className="px-2">
                  <EditReplyForm
                    reply={reply}
                    postId={postId}
                    onSuccess={() => {
                      setEditingReplyId(null);
                      onUpdate();
                    }}
                    onCancel={() => setEditingReplyId(null)}
                  />
                </div>
              ) : (
                // 通常表示
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
                    <div className="flex items-center justify-between">
                      <div className="flex items-baseline gap-2 mb-1">
                        <span className="font-semibold text-sm hover:underline">
                          {reply.authorName}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          · {formatDate(reply.createdAt)}
                          {reply.isEdited && " (編集済み)"}
                        </span>
                      </div>

                      {/* 編集・削除メニュー（作者のみ） */}
                      {isAuthor && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0"
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => setEditingReplyId(reply.id)}
                              className="gap-2"
                            >
                              <Edit className="h-4 w-4" />
                              編集
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleDeleteReply(reply)}
                              disabled={deletingReplyId === reply.id}
                              className="gap-2 text-destructive focus:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                              {deletingReplyId === reply.id
                                ? "削除中..."
                                : "削除"}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </div>

                    {/* 返信テキスト */}
                    <p className="text-sm whitespace-pre-wrap break-words leading-relaxed">
                      {reply.content}
                    </p>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
