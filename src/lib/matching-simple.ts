import { MatchingUser, Match } from '@/types/matching';

class SimpleMatchingService {
    private waitingUsers: MatchingUser[] = [];
    private matches: Match[] = [];

    // ユーザーがマッチングキューに参加
    joinQueue(user: MatchingUser): void {
      console.log(`ユーザー ${user.userId} がキューに参加しました`);

      // 既にキューにいる場合は削除
      this.leaveQueue(user.userId);

      // キューに追加
      this.waitingUsers.push(user);

      // マッチングを試行
      this.tryToMatch(user.userId);
    }

    // ユーザーがキューから離脱
    leaveQueue(userId: string): void {
      console.log(`ユーザー ${userId} がキューから離脱しました`);

      this.waitingUsers = this.waitingUsers.filter(
        user => user.userId !== userId
      );
    }

    // マッチングを試行
    private tryToMatch(currentUserId: string): void {
      //　自分以外のユーザーを探す
      const otherUser = this.waitingUsers.find(
        user => user.userId !== currentUserId
      );

      if (otherUser) {
        // マッチング成功
        const match: Match = {
            id: `match_${Date.now()}_${Math.random().toString(36).substr(2,9)}`,
            users: [currentUserId, otherUser.userId],
            createdAt: new Date(),
            status: 'active'
        };

        console.log(`マッチング成功！: ${currentUserId} と ${otherUser.userId}`);

        // マッチング結果を保存
        this.matches.push(match);

        // 両ユーザーをキューから削除
        this.leaveQueue(currentUserId);
        this.leaveQueue(otherUser.userId);

        // WebSocketを通じてユーザーに通知
        this.notifyMatch(match);
      } else {
        console.log(`ユーザー ${currentUserId} は待機中...`);
      }
    }

    // マッチング結果を通知
    private notifyMatch(match: Match): void {
        console.log(`マッチング通知: ${match.id}`);
    }

    getWatingCount(): number {
        return this.waitingUsers.length;
    }

    isUserWaiting(userId: string): boolean {
       return this.waitingUsers.some(user => user.userId === userId);
    }
}

export const simpleMatchingService = new SimpleMatchingService();