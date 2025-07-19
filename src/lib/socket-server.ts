import { Server as SocketIOServer } from 'socket.io';
import { Server as NetServer } from 'http';
import { MatchingService } from './matching';
import { MatchingUser } from '@/types/matching_type';

export function setupSocketIO(httpServer: NetServer) {
    const io = new SocketIOServer(httpServer, {
        cors: {
            origin: process.env.NEXT_PUBLIC_CLIENT_URL || 'http://localhost:3000',
            methods: ['GET', 'POST']
        },
        path: '/api/socket'
    });

    io.on('connection', (socket) => {
        console.log('User connected:', socket.id);

        // マッチングキューに参加
        socket.on('join-matching', async (userData: any) => {
            try {
                const matchingUser: MatchingUser = {
                    userId: userData.userId,
                    socketId: socket.id,
                    timestamp: Date.now(),
                    preferences: userData.preferences,
                    userInfo: userData.userInfo
                };

                const success = await MatchingService.joinQueue(matchingUser);

                if(success) {
                    socket.emit('matching-joined', { success: true });

                    // マッチング検索を開始
                    const match = await MatchingService.findMatch(userData.userId);
                    if(match) {
                        const newMatch = await MatchingService.createMatch(matchingUser, match);

                        // 両ユーザにマッチング通知を送信
                        socket.emit('match-found', {
                            matchId: newMatch.id,
                            roomId: newMatch.roomId,
                            partner: {
                                userId: match.userId,
                                name: match.userInfo?.name || 'unknown',
                                age: match.userInfo?.age,
                                interests: match.userInfo?.interests
                            }
                        });

                        io.to(match.socketId).emit('match-found', {
                            matchId: newMatch.id,
                            roomId: newMatch.roomId,
                            partner: {
                                userId: matchingUser.userId,
                                name: matchingUser.userInfo?.name || 'unknown',
                                age: matchingUser.userInfo?.age,
                                interests: matchingUser.userInfo?.interests
                            }
                        });
                    }
            } else {
                socket.emit('matching-error', { message: 'Failed to join queue' });
            }
            } catch (error) {
              console.error('Matching error:', error);
              socket.emit('matching-error', { message: 'Internal server error' });
            }
        });

        // マッチングキューから離脱
        socket.on('leave-matching', async (userId: string) => {
          try {
            await MatchingService.leaveQueue(userId);
            socket.emit('matching-left', { success: true });
          } catch (error) {
            console.error('Leave matching error:', error);
            socket.emit('matching-error', { message: 'Failed to leave queue' });
         }
        });

        // 統計情報の取得
        socket.on('get-stats', async () => {
          try {
            const stats = await MatchingService.getStats();
            socket.emit('stats-updated', stats);
          } catch (error) {
            console.error('Stats error:', error);
          }
        });

        // 接続切断時の処理
        socket.on('disconnect', async() => {
            console.log('User disconnected:', socket.id);

            //ユーザーセッション情報からsocketIdを検索して削除
            try {
              const sessions = await MatchingService.getUserSessions();
              for (const [userId, sessionData] of Object.entries(sessions)) {
                const session = JSON.parse(sessionData);
                if (session.socketId === socket.id) {
                    await MatchingService.leaveQueue(userId);
                    break;
                }
              }
            } catch (error) {
                console.error('Disconnect cleanup error:' , error);
            }
        });
    });

    return io;
}