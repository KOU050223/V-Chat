'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar } from '@/components/ui/avatar';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Heart,
  MessageCircle,
  Users,
  Search,
  Clock,
  Plus,
  Calendar,
  Filter,
} from 'lucide-react';
import { BulletinPost, PostCategory } from '@/types/bulletin';
import { cn } from '@/lib/utils';

interface PostListProps {
  className?: string;
}

const categories: PostCategory[] = [
  '雑談',
  'ゲーム',
  '趣味',
  '技術',
  'イベント',
  'その他',
];

export function PostList({ className }: PostListProps) {
  const router = useRouter();
  const [posts, setPosts] = useState<BulletinPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'latest' | 'popular' | 'replies'>(
    'latest'
  );

  // 投稿一覧取得
  useEffect(() => {
    const fetchPosts = async () => {
      try {
        setLoading(true);
        const response = await fetch('/api/bulletin');
        const data = await response.json();

        if (data.success) {
          const postsWithDates = data.data.map(
            (post: Record<string, unknown>) => ({
              ...post,
              createdAt: new Date(post.createdAt as string),
              updatedAt: new Date(post.updatedAt as string),
            })
          );
          setPosts(postsWithDates);
        }
      } catch (err) {
        console.error('投稿一覧取得エラー:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchPosts();
  }, []);

  // フィルタリング・ソート処理
  const filteredAndSortedPosts = posts
    .filter((post) => {
      // カテゴリフィルタ
      const categoryMatch =
        selectedCategory === 'all' || post.category === selectedCategory;

      // 検索クエリフィルタ
      const searchMatch =
        searchQuery === '' ||
        post.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        post.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
        post.tags?.some((tag) =>
          tag.toLowerCase().includes(searchQuery.toLowerCase())
        );

      return categoryMatch && searchMatch;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'popular':
          return b.likes.length - a.likes.length;
        case 'replies':
          return (b.replyCount || 0) - (a.replyCount || 0);
        case 'latest':
        default:
          return b.createdAt.getTime() - a.createdAt.getTime();
      }
    });

  // 日付フォーマット
  const formatDate = (date: Date): string => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (minutes < 60) {
      return `${minutes}分前`;
    } else if (hours < 24) {
      return `${hours}時間前`;
    } else if (days < 7) {
      return `${days}日前`;
    } else {
      return date.toLocaleDateString('ja-JP', {
        month: 'short',
        day: 'numeric',
      });
    }
  };

  // カテゴリ色
  const getCategoryColor = (category: PostCategory): string => {
    const colors = {
      雑談: 'bg-blue-100 text-blue-800 border-blue-200',
      ゲーム: 'bg-purple-100 text-purple-800 border-purple-200',
      趣味: 'bg-green-100 text-green-800 border-green-200',
      技術: 'bg-orange-100 text-orange-800 border-orange-200',
      イベント: 'bg-red-100 text-red-800 border-red-200',
      その他: 'bg-gray-100 text-gray-800 border-gray-200',
    };
    return colors[category] || colors['その他'];
  };

  // 検索実行
  const handleSearch = () => {
    // フィルタリングは自動で行われるため特別な処理は不要
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {[...Array(5)].map((_, i) => (
          <Card key={i} className="p-6 animate-pulse">
            <div className="space-y-3">
              <div className="h-4 bg-gray-200 rounded w-3/4" />
              <div className="h-3 bg-gray-200 rounded w-1/2" />
              <div className="h-16 bg-gray-200 rounded" />
            </div>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className={cn('space-y-6', className)}>
      {/* ヘッダー */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">掲示板</h1>
          <p className="text-muted-foreground">
            メンバーと交流しよう！ルームを作って一緒に活動できます。
          </p>
        </div>
        <Button
          onClick={() => router.push('/bulletin/create')}
          className="gap-2"
        >
          <Plus className="w-4 h-4" />
          投稿作成
        </Button>
      </div>

      {/* フィルター・検索バー */}
      <Card className="p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          {/* 検索 */}
          <div className="flex-1 flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                type="text"
                placeholder="検索..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                className="pl-10"
              />
            </div>
            <Button onClick={handleSearch} variant="outline">
              検索
            </Button>
          </div>

          {/* フィルター */}
          <div className="flex gap-2">
            <Select
              value={selectedCategory}
              onValueChange={setSelectedCategory}
            >
              <SelectTrigger className="w-32">
                <Filter className="w-4 h-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全て</SelectItem>
                {categories.map((category) => (
                  <SelectItem key={category} value={category}>
                    {category}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={sortBy}
              onValueChange={(value: 'latest' | 'popular' | 'replies') =>
                setSortBy(value)
              }
            >
              <SelectTrigger className="w-32">
                <Clock className="w-4 h-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="latest">新着順</SelectItem>
                <SelectItem value="popular">人気順</SelectItem>
                <SelectItem value="replies">返信順</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </Card>

      {/* 投稿一覧 */}
      <div className="space-y-4">
        {filteredAndSortedPosts.length === 0 ? (
          <Card className="p-12 text-center">
            <div className="text-muted-foreground">
              <MessageCircle className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium mb-2">投稿がありません</p>
              <p className="mb-4">
                {searchQuery || selectedCategory !== 'all'
                  ? '検索条件を変更してみてください'
                  : '最初の投稿を作成してみませんか？'}
              </p>
              <Button
                onClick={() => router.push('/bulletin/create')}
                className="gap-2"
              >
                <Plus className="w-4 h-4" />
                投稿作成
              </Button>
            </div>
          </Card>
        ) : (
          filteredAndSortedPosts.map((post) => {
            const remainingSlots =
              post.maxParticipants - post.currentParticipants;
            const isFull = remainingSlots <= 0;

            return (
              <Card
                key={post.id}
                className="p-6 hover:shadow-lg transition-shadow cursor-pointer"
                onClick={() => router.push(`/bulletin/${post.id}`)}
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
                    <div className="flex-1">
                      <p className="font-medium">{post.authorName}</p>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Calendar className="w-3 h-3" />
                        <span>{formatDate(post.createdAt)}</span>
                      </div>
                    </div>
                  </div>
                  <Badge
                    variant="outline"
                    className={getCategoryColor(post.category)}
                  >
                    {post.category}
                  </Badge>
                </div>

                {/* タイトル・内容 */}
                <div className="mb-4">
                  <h3 className="text-xl font-bold mb-2 line-clamp-2">
                    {post.title}
                  </h3>
                  <p className="text-muted-foreground line-clamp-3">
                    {post.content}
                  </p>
                </div>

                {/* タグ */}
                {post.tags && post.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-4">
                    {post.tags.slice(0, 3).map((tag, index) => (
                      <Badge
                        key={index}
                        variant="secondary"
                        className="text-xs"
                      >
                        #{tag}
                      </Badge>
                    ))}
                    {post.tags.length > 3 && (
                      <Badge variant="secondary" className="text-xs">
                        +{post.tags.length - 3}
                      </Badge>
                    )}
                  </div>
                )}

                {/* フッター */}
                <div className="flex items-center justify-between pt-4 border-t">
                  <div className="flex items-center gap-4">
                    {/* いいね */}
                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                      <Heart className="w-4 h-4" />
                      <span>{post.likes.length}</span>
                    </div>

                    {/* 返信数 */}
                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                      <MessageCircle className="w-4 h-4" />
                      <span>{post.replyCount || 0}</span>
                    </div>

                    {/* 募集状況 */}
                    <div className="flex items-center gap-1">
                      <Users className="w-4 h-4 text-muted-foreground" />
                      <span
                        className={cn(
                          'text-sm font-medium',
                          isFull ? 'text-red-500' : 'text-primary'
                        )}
                      >
                        {post.currentParticipants}/{post.maxParticipants}
                      </span>
                    </div>
                  </div>

                  {/* ステータスバッジ */}
                  <div className="flex gap-2">
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
                    {post.roomId && (
                      <Badge
                        variant="outline"
                        className="bg-blue-50 text-blue-600 border-blue-200"
                      >
                        ルーム作成済み
                      </Badge>
                    )}
                  </div>
                </div>
              </Card>
            );
          })
        )}
      </div>

      {/* ページネーション（将来の拡張用） */}
      {filteredAndSortedPosts.length > 0 && (
        <div className="text-center text-sm text-muted-foreground">
          {filteredAndSortedPosts.length}件の投稿を表示中
        </div>
      )}
    </div>
  );
}
