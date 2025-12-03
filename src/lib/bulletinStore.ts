/**
 * 掲示板用のインメモリストア
 * 開発用。本番環境ではFirestoreを使用
 */

import { BulletinPost, BulletinReply } from '@/types/bulletin';

class BulletinStore {
  private posts: Map<string, BulletinPost> = new Map();
  private replies: Map<string, BulletinReply[]> = new Map();

  // 投稿関連
  getAllPosts(): BulletinPost[] {
    return Array.from(this.posts.values());
  }

  getPostById(id: string): BulletinPost | undefined {
    return this.posts.get(id);
  }

  createPost(post: BulletinPost): BulletinPost {
    this.posts.set(post.id, post);
    return post;
  }

  updatePost(
    id: string,
    updates: Partial<BulletinPost>
  ): BulletinPost | undefined {
    const post = this.posts.get(id);
    if (!post) return undefined;

    const updatedPost = {
      ...post,
      ...updates,
      updatedAt: new Date(),
    };
    this.posts.set(id, updatedPost);
    return updatedPost;
  }

  deletePost(id: string): boolean {
    const deleted = this.posts.delete(id);
    if (deleted) {
      this.replies.delete(id);
    }
    return deleted;
  }

  // いいね機能
  toggleLike(postId: string, userId: string): BulletinPost | undefined {
    const post = this.posts.get(postId);
    if (!post) return undefined;

    const likes = new Set(post.likes);
    if (likes.has(userId)) {
      likes.delete(userId);
    } else {
      likes.add(userId);
    }

    const updatedPost = {
      ...post,
      likes: Array.from(likes),
      updatedAt: new Date(),
    };
    this.posts.set(postId, updatedPost);
    return updatedPost;
  }

  // 返信関連
  getRepliesByPostId(postId: string): BulletinReply[] {
    return this.replies.get(postId) || [];
  }

  createReply(reply: BulletinReply): BulletinReply {
    const postReplies = this.replies.get(reply.postId) || [];
    postReplies.push(reply);
    this.replies.set(reply.postId, postReplies);
    return reply;
  }

  deleteReply(postId: string, replyId: string): boolean {
    const postReplies = this.replies.get(postId);
    if (!postReplies) return false;

    const index = postReplies.findIndex((r) => r.id === replyId);
    if (index === -1) return false;

    postReplies.splice(index, 1);
    this.replies.set(postId, postReplies);
    return true;
  }

  // ルーム作成時に投稿を更新
  setPostRoom(postId: string, roomId: string): BulletinPost | undefined {
    return this.updatePost(postId, { roomId });
  }

  // 参加者数を増やす
  incrementParticipants(postId: string): BulletinPost | undefined {
    const post = this.posts.get(postId);
    if (!post) return undefined;

    return this.updatePost(postId, {
      currentParticipants: Math.min(
        post.currentParticipants + 1,
        post.maxParticipants
      ),
    });
  }

  // データリセット（テスト用）
  reset(): void {
    this.posts.clear();
    this.replies.clear();
  }
}

// シングルトンインスタンス
export const bulletinStore = new BulletinStore();
