// src/lib/matching.ts
import redis from './redis';
import { MatchingUser, Match, MatchingResult, MatchingStats } from '@/types/matching_type';

export class MatchingService {
  // Redisキー定数
  private static readonly QUEUE_KEY = 'matching:queue';
  private static readonly MATCHES_KEY = 'matching:matches';
  private static readonly STATS_KEY = 'matching:stats';
  private static readonly USER_SESSIONS_KEY = 'matching:user_sessions';

  /**
   * ユーザーをマッチングキューに追加
   */
  static async joinQueue(user: MatchingUser): Promise<boolean> {
    try {
      const userData = JSON.stringify(user);
      
      // 既存のユーザーを削除（重複防止）
      await this.leaveQueue(user.userId);
      
      // キューに追加（タイムスタンプをスコアとして使用）
      await redis.zadd(this.QUEUE_KEY, user.timestamp, userData);
      
      // ユーザーセッション情報を保存
      await redis.hset(
        this.USER_SESSIONS_KEY, 
        user.userId, 
        JSON.stringify({
          socketId: user.socketId,
          joinedAt: user.timestamp,
          preferences: user.preferences
        })
      );

      console.log(`User ${user.userId} joined matching queue`);
      
      // 統計情報を更新
      await this.updateStats();
      
      return true;
    } catch (error) {
      console.error('Failed to join queue:', error);
      return false;
    }
  }

  /**
   * ユーザーをマッチングキューから削除
   */
  static async leaveQueue(userId: string): Promise<boolean> {
    try {
      // キューからユーザーを検索して削除
      const queue = await redis.zrange(this.QUEUE_KEY, 0, -1);
      
      for (const userStr of queue) {
        const user = JSON.parse(userStr) as MatchingUser;
        if (user.userId === userId) {
          await redis.zrem(this.QUEUE_KEY, userStr);
          break;
        }
      }
      
      // ユーザーセッション情報を削除
      await redis.hdel(this.USER_SESSIONS_KEY, userId);
      
      console.log(`User ${userId} left matching queue`);
      
      // 統計情報を更新
      await this.updateStats();
      
      return true;
    } catch (error) {
      console.error('Failed to leave queue:', error);
      return false;
    }
  }

  /**
   * マッチング相手を検索
   */
  static async findMatch(userId: string): Promise<MatchingUser | null> {
    try {
      const queue = await redis.zrange(this.QUEUE_KEY, 0, -1);
      const currentUser = queue.find(userStr => {
        const user = JSON.parse(userStr) as MatchingUser;
        return user.userId === userId;
      });

      if (!currentUser) {
        return null;
      }

      const currentUserData = JSON.parse(currentUser) as MatchingUser;

      // 自分以外のユーザーを検索
      for (const userStr of queue) {
        const user = JSON.parse(userStr) as MatchingUser;
        
        if (user.userId !== userId) {
          // マッチング条件をチェック
          if (this.checkMatchingConditions(currentUserData, user)) {
            return user;
          }
        }
      }

      return null;
    } catch (error) {
      console.error('Failed to find match:', error);
      return null;
    }
  }

  /**
   * マッチング条件をチェック
   */
  private static checkMatchingConditions(user1: MatchingUser, user2: MatchingUser): boolean {
    // 基本的な条件チェック
    if (!user1.preferences || !user2.preferences) {
      return true; // 設定がない場合は無条件でマッチ
    }

    // 年齢範囲チェック
    if (user1.preferences.ageRange && user2.userInfo?.age) {
      const [min, max] = user1.preferences.ageRange;
      if (user2.userInfo.age < min || user2.userInfo.age > max) {
        return false;
      }
    }

    if (user2.preferences.ageRange && user1.userInfo?.age) {
      const [min, max] = user2.preferences.ageRange;
      if (user1.userInfo.age < min || user1.userInfo.age > max) {
        return false;
      }
    }

    // 興味の一致チェック（オプション）
    if (user1.preferences.interests && user2.userInfo?.interests) {
      const commonInterests = user1.preferences.interests.filter(
        interest => user2.userInfo!.interests!.includes(interest)
      );
      if (commonInterests.length === 0) {
        return false;
      }
    }

    return true;
  }

  /**
   * マッチングを作成
   */
  static async createMatch(user1: MatchingUser, user2: MatchingUser): Promise<Match> {
    const matchId = `match_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const roomId = `room_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const match: Match = {
      id: matchId,
      users: [user1.userId, user2.userId],
      socketIds: [user1.socketId, user2.socketId],
      createdAt: new Date(),
      status: 'active',
      roomId: roomId
    };

    // マッチング情報をRedisに保存
    await redis.hset(this.MATCHES_KEY, matchId, JSON.stringify(match));
    
    // 両ユーザーをキューから削除
    await this.leaveQueue(user1.userId);
    await this.leaveQueue(user2.userId);

    console.log(`Match created: ${matchId} between ${user1.userId} and ${user2.userId}`);
    
    return match;
  }

  /**
   * マッチング結果を取得
   */
  static async getMatch(matchId: string): Promise<Match | null> {
    try {
      const matchData = await redis.hget(this.MATCHES_KEY, matchId);
      return matchData ? JSON.parse(matchData) : null;
    } catch (error) {
      console.error('Failed to get match:', error);
      return null;
    }
  }

  /**
   * マッチングを終了
   */
  static async endMatch(matchId: string): Promise<boolean> {
    try {
      const match = await this.getMatch(matchId);
      if (match) {
        match.status = 'ended';
        await redis.hset(this.MATCHES_KEY, matchId, JSON.stringify(match));
        console.log(`Match ${matchId} ended`);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Failed to end match:', error);
      return false;
    }
  }

  /**
   * ユーザーのアクティブなマッチングを取得
   */
  static async getUserActiveMatch(userId: string): Promise<Match | null> {
    try {
      const matches = await redis.hgetall(this.MATCHES_KEY);
      
      for (const [matchId, matchData] of Object.entries(matches)) {
        const match = JSON.parse(matchData) as Match;
        if (match.users.includes(userId) && match.status === 'active') {
          return match;
        }
      }
      
      return null;
    } catch (error) {
      console.error('Failed to get user active match:', error);
      return null;
    }
  }

  /**
   * 統計情報を取得
   */
  static async getStats(): Promise<MatchingStats> {
    try {
      const waitingCount = await redis.zcard(this.QUEUE_KEY);
      const matches = await redis.hgetall(this.MATCHES_KEY);
      const activeMatches = Object.values(matches).filter(
        matchData => (JSON.parse(matchData) as Match).status === 'active'
      ).length;

      // 平均待機時間を計算
      const queue = await redis.zrange(this.QUEUE_KEY, 0, -1, 'WITHSCORES');
      let totalWaitTime = 0;
      let userCount = 0;
      
      for (let i = 0; i < queue.length; i += 2) {
        const timestamp = parseInt(queue[i + 1]);
        totalWaitTime += Date.now() - timestamp;
        userCount++;
      }
      
      const averageWaitTime = userCount > 0 ? totalWaitTime / userCount : 0;

      return {
        waitingCount,
        activeMatches,
        averageWaitTime
      };
    } catch (error) {
      console.error('Failed to get stats:', error);
      return {
        waitingCount: 0,
        activeMatches: 0,
        averageWaitTime: 0
      };
    }
  }

  /**
   * 統計情報を更新
   */
  private static async updateStats(): Promise<void> {
    try {
      const stats = await this.getStats();
      await redis.set(this.STATS_KEY, JSON.stringify(stats));
    } catch (error) {
      console.error('Failed to update stats:', error);
    }
  }

  /**
   * 古いマッチングをクリーンアップ
   */
  static async cleanupOldMatches(): Promise<void> {
    try {
      const matches = await redis.hgetall(this.MATCHES_KEY);
      const now = Date.now();
      const oneHourAgo = now - (60 * 60 * 1000); // 1時間前

      for (const [matchId, matchData] of Object.entries(matches)) {
        const match = JSON.parse(matchData) as Match;
        if (match.createdAt.getTime() < oneHourAgo) {
          await redis.hdel(this.MATCHES_KEY, matchId);
          console.log(`Cleaned up old match: ${matchId}`);
        }
      }
    } catch (error) {
      console.error('Failed to cleanup old matches:', error);
    }
  }

  /**
   * ユーザーがキューにいるかチェック
   */
  static async isUserInQueue(userId: string): Promise<boolean> {
    try {
      const queue = await redis.zrange(this.QUEUE_KEY, 0, -1);
      return queue.some(userStr => {
        const user = JSON.parse(userStr) as MatchingUser;
        return user.userId === userId;
      });
    } catch (error) {
      console.error('Failed to check if user in queue:', error);
      return false;
    }
  }

  /**
   * キューからユーザー情報を取得
   */
  static async getQueueUser(userId: string): Promise<MatchingUser | null> {
    try {
      const queue = await redis.zrange(this.QUEUE_KEY, 0, -1);
      
      for (const userStr of queue) {
        const user = JSON.parse(userStr) as MatchingUser;
        if (user.userId === userId) {
          return user;
        }
      }
      
      return null;
    } catch (error) {
      console.error('Failed to get queue user:', error);
      return null;
    }
  }
}

// シングルトンインスタンス
export const matchingService = new MatchingService();