/**
 * 投稿詳細ページ
 */

'use client';

import { useState, useEffect, use, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar } from '@/components/ui/avatar';
import { ReplyForm } from '@/components/bulletin/ReplyForm';
import { ReplyList } from '@/components/bulletin/ReplyList';
import {
  ArrowLeft,
  Heart,
  Users,
  Calendar,
  MessageCircle,
  ExternalLink,
  Loader2,
  Plus,
  Share2,
  Edit,
  Trash2,
} from 'lucide-react';
import { BulletinPost, BulletinReply } from '@/types/bulletin';
import { useAuth } from '@/contexts/AuthContext';
import { handleError } from '@/lib/utils';
import { cn } from '@/lib/utils';

interface PageProps {
  params: Promise<{
    postId: string;
  }>;
}

export default function PostDetailPage({ params }: PageProps) {
  const resolvedParams = use(params);
  return <PostDetailContent postId={resolvedParams.postId} />;
}

function PostDetailContent({ postId }: { postId: string }) {
  const router = useRouter();
  const { user } = useAuth();
  const [post, setPost] = useState<BulletinPost | null>(null);
  const [replies, setReplies] = useState<BulletinReply[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCreatingRoom, setIsCreatingRoom] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  console.log(
    'PostDetailContent レンダリング。replies:',
    replies,
    'length:',
    replies.length
  );

  // 投稿取得
  const fetchPost = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/bulletin/${postId}`);
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || '投稿の取得に失敗しました');
      }

      setPost({
        ...data.data,
        createdAt: new Date(data.data.createdAt),
        updatedAt: new Date(data.data.updatedAt),
      });
    } catch (err) {
      setError(handleError('投稿取得エラー', err));
    } finally {
      setLoading(false);
    }
  }, [postId]);

  // 返信取得
  const fetchReplies = useCallback(async () => {
    try {
      console.log('返信を取得します。postId:', postId);
      const response = await fetch(`/api/bulletin/${postId}/replies`);
      console.log('返信取得レスポンスステータス:', response.status);

      const data = await response.json();
      console.log('返信取得レスポンスデータ:', data);

      if (data.success) {
        console.log('返信データ:', data.data);
        const repliesWithDates = data.data.map(
          (reply: Record<string, unknown>) => ({
            ...reply,
            createdAt: new Date(reply.createdAt as string),
            updatedAt: new Date(reply.updatedAt as string),
          })
        );
        console.log('日付変換後の返信データ:', repliesWithDates);
        setReplies(repliesWithDates);
      } else {
        console.error('返信取得が失敗しました:', data.error);
      }
    } catch (err) {
      console.error(handleError('返信取得エラー', err));
    }
  }, [postId]);

  // いいね処理
  const handleLike = async () => {
    if (!user || !post) return;

    try {
      const response = await fetch(`/api/bulletin/${postId}/like`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: user.uid,
        }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'いいねに失敗しました');
      }

      setPost((prev) =>
        prev
          ? {
              ...prev,
              likes: data.data.likes,
              updatedAt: new Date(data.data.updatedAt),
            }
          : null
      );
    } catch {
      console.error('いいね処理に失敗しました');
    }
  };

  // 返信投稿
  const handleReplySubmit = async (content: string) => {
    if (!user) throw new Error('ログインが必要です');

    const response = await fetch(`/api/bulletin/${postId}/replies`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        content,
        userId: user.uid,
        userName: user.displayName || 'ユーザー',
        userPhoto: user.photoURL || undefined,
      }),
    });

    const data = await response.json();

    if (!data.success) {
      throw new Error(data.error || '返信の投稿に失敗しました');
    }

    // 返信リストを更新
    await fetchReplies();
  };

  // 投稿編集
  const handleEdit = () => {
    router.push(`/bulletin/${postId}/edit`);
  };

  // 投稿削除
  const handleDelete = async () => {
    if (!user || !post) return;

    const confirmDelete = window.confirm(
      '本当にこの投稿を削除しますか？\nこの操作は取り消せません。'
    );

    if (!confirmDelete) return;

    setIsDeleting(true);

    try {
      const response = await fetch(`/api/bulletin/${postId}`, {
        method: 'DELETE',
        headers: {
          'x-user-id': user.uid,
        },
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || '投稿の削除に失敗しました');
      }

      alert('投稿を削除しました');
      router.push('/bulletin');
    } catch (err) {
      console.error('投稿削除エラー:', err);
      alert(err instanceof Error ? err.message : '投稿の削除に失敗しました');
    } finally {
      setIsDeleting(false);
    }
  };

  // ルーム作成
  const handleCreateRoom = async () => {
    if (!user || !post || post.authorId !== user.uid) return;

    setIsCreatingRoom(true);

    try {
      const response = await fetch(`/api/bulletin/${postId}/create-room`, {
        method: 'POST',
        headers: {
          'x-user-id': user.uid,
        },
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'ルームの作成に失敗しました');
      }

      // 投稿を更新
      setPost((prev) =>
        prev
          ? {
              ...prev,
              roomId: data.data.roomId,
              updatedAt: new Date(),
            }
          : null
      );

      // ルームページに遷移
      router.push(`/room/${data.data.roomId}`);
    } catch (err) {
      alert(handleError('ルーム作成エラー', err));
    } finally {
      setIsCreatingRoom(false);
    }
  };

  // シェア機能
  const handleShare = async () => {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({
          title: post?.title,
          text: post?.content,
          url,
        });
      } catch {
        console.log('シェアがキャンセルされました');
      }
    } else {
      // フォールバック: クリップボードにコピー
      await navigator.clipboard.writeText(url);
      alert('URLをクリップボードにコピーしました');
    }
  };

  useEffect(() => {
    fetchPost();
    fetchReplies();
  }, [postId, fetchPost, fetchReplies]);

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleString('ja-JP', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getCategoryColor = (category: string) => {
    const colors = {
      雑談: 'bg-blue-100 text-blue-800 border-blue-200',
      ゲーム: 'bg-purple-100 text-purple-800 border-purple-200',
      趣味: 'bg-green-100 text-green-800 border-green-200',
      技術: 'bg-orange-100 text-orange-800 border-orange-200',
      イベント: 'bg-pink-100 text-pink-800 border-pink-200',
      その他: 'bg-gray-100 text-gray-800 border-gray-200',
    };
    return colors[category as keyof typeof colors] || colors['その他'];
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background to-muted/20 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !post) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background to-muted/20 p-4">
        <div className="max-w-4xl mx-auto pt-20">
          <Card className="p-8 text-center">
            <p className="text-destructive mb-4">
              {error || '投稿が見つかりません'}
            </p>
            <Button onClick={() => router.push('/bulletin')}>
              掲示板に戻る
            </Button>
          </Card>
        </div>
      </div>
    );
  }

  const isLiked = user ? post.likes.includes(user.uid) : false;
  const remainingSlots = post.maxParticipants - post.currentParticipants;
  const isFull = remainingSlots <= 0;
  const isAuthor = user && post.authorId === user.uid;

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted/20 p-4">
      <div className="max-w-4xl mx-auto py-8">
        {/* 戻るボタン */}
        <Button
          variant="ghost"
          onClick={() => router.push('/bulletin')}
          className="gap-2 mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          掲示板に戻る
        </Button>

        {/* 投稿詳細 */}
        <Card className="p-6 mb-6">
          {/* ヘッダー */}
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3 flex-1">
              <Avatar className="w-12 h-12">
                {post.authorPhoto ? (
                  <img
                    src={post.authorPhoto}
                    alt={post.authorName}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center text-white font-bold text-lg">
                    {post.authorName[0]}
                  </div>
                )}
              </Avatar>
              <div className="flex-1">
                <p className="font-medium">{post.authorName}</p>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Calendar className="w-4 h-4" />
                  <span>{formatDate(post.createdAt)}</span>
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <Badge
                variant="outline"
                className={getCategoryColor(post.category)}
              >
                {post.category}
              </Badge>
              <Button variant="ghost" size="sm" onClick={handleShare}>
                <Share2 className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* タイトルと内容 */}
          <div className="mb-6">
            <h1 className="text-3xl font-bold mb-4">{post.title}</h1>
            <p className="text-base whitespace-pre-wrap">{post.content}</p>
          </div>

          {/* タグ */}
          {post.tags && post.tags.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-6">
              {post.tags.map((tag, index) => (
                <Badge key={index} variant="secondary">
                  #{tag}
                </Badge>
              ))}
            </div>
          )}

          {/* アクションバー */}
          <div className="flex items-center justify-between pt-6 border-t">
            <div className="flex items-center gap-4">
              {/* いいねボタン */}
              <Button
                variant="ghost"
                className={cn(
                  'gap-2',
                  isLiked && 'text-red-500 hover:text-red-600'
                )}
                onClick={handleLike}
                disabled={!user}
              >
                <Heart className={cn('w-5 h-5', isLiked && 'fill-current')} />
                <span className="font-medium">{post.likes.length}</span>
              </Button>

              {/* 返信数 */}
              <div className="flex items-center gap-2 text-muted-foreground">
                <MessageCircle className="w-5 h-5" />
                <span className="font-medium">{replies.length}</span>
              </div>

              {/* 募集人数 */}
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-muted-foreground" />
                <span
                  className={cn(
                    'font-medium',
                    isFull ? 'text-red-500' : 'text-primary'
                  )}
                >
                  {post.currentParticipants}/{post.maxParticipants}
                </span>
                {isFull ? (
                  <Badge variant="destructive">満員</Badge>
                ) : (
                  <Badge
                    variant="secondary"
                    className="bg-green-100 text-green-800 border-green-200"
                  >
                    募集中
                  </Badge>
                )}
              </div>
            </div>

            {/* 編集・削除ボタン（作者のみ） */}
            {isAuthor && (
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleEdit}
                  className="gap-2"
                >
                  <Edit className="w-4 h-4" />
                  編集
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDelete}
                  disabled={isDeleting}
                  className="gap-2 text-red-600 hover:text-red-700 border-red-200 hover:border-red-300"
                >
                  <Trash2 className="w-4 h-4" />
                  {isDeleting ? '削除中...' : '削除'}
                </Button>
              </div>
            )}

            {/* ルーム関連ボタン */}
            <div className="flex gap-2">
              {post.roomId ? (
                <Button
                  onClick={() => router.push(`/room/${post.roomId}`)}
                  className="gap-2"
                >
                  <ExternalLink className="w-4 h-4" />
                  ルームに参加
                </Button>
              ) : isAuthor ? (
                <Button
                  onClick={handleCreateRoom}
                  disabled={isCreatingRoom}
                  className="gap-2"
                >
                  <Plus className="w-4 h-4" />
                  {isCreatingRoom ? 'ルーム作成中...' : 'ルームを作成'}
                </Button>
              ) : null}
            </div>
          </div>
        </Card>

        {/* 返信セクション */}
        <Card className="overflow-hidden">
          {/* 返信ヘッダー */}
          <div className="px-6 py-4 border-b border-border bg-muted/20">
            <div className="flex items-center gap-3">
              <MessageCircle className="w-5 h-5 text-primary" />
              <h2 className="text-lg font-bold">
                返信{' '}
                <span className="text-muted-foreground">
                  ({replies.length})
                </span>
              </h2>
            </div>
          </div>

          {/* 返信フォーム */}
          <div className="px-6 py-4 border-b border-border">
            <ReplyForm postId={postId} onSubmit={handleReplySubmit} />
          </div>

          {/* 返信リスト */}
          <div className="px-6">
            <ReplyList
              replies={replies}
              postId={postId}
              onUpdate={fetchReplies}
            />
          </div>
        </Card>
      </div>
    </div>
  );
}
