'use client';

import { useState, useEffect } from 'react';
import { socketClient } from '@/lib/socket-client';
import { MatchingResult } from '@/types/matching_type';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { 
  Users, 
  Clock, 
  MessageCircle, 
  X, 
  Play, 
  Heart,
  Sparkles,
  UserCheck,
  ArrowLeft
} from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';

export default function MatchingQueue() {
  const { user } = useAuth();
  const [isConnected, setIsConnected] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [searchTime, setSearchTime] = useState(0);
  const [matchResult, setMatchResult] = useState<MatchingResult | null>(null);
  const [stats, setStats] = useState({ waitingCount: 0, activeMatches: 0 });
  const [currentUserId, setCurrentUserId] = useState<string>(''); // 現在のユーザーIDを保存

  useEffect(() => {
    // WebSocket接続
    socketClient.connect().then(() => {
      setIsConnected(true);
      
      // イベントリスナーの設定
      socketClient.onMatchingJoined((data) => {
        console.log('Joined matching queue:', data);
      });

      socketClient.onMatchFound((data) => {
        console.log('Match found:', data);
        setMatchResult(data);
        setIsSearching(false);
        setSearchTime(0);
      });

      socketClient.onMatchingLeft((data) => {
        console.log('Left matching queue:', data);
        setIsSearching(false);
        setSearchTime(0);
      });

      socketClient.onStatsUpdated((data) => {
        setStats(data);
      });

      socketClient.onError((error) => {
        console.error('Matching error:', error);
        alert(error.message);
        setIsSearching(false);
      });

      // 初期統計情報を取得
      socketClient.getStats();
    }).catch((error) => {
      console.error('Failed to connect:', error);
    });

    return () => {
      socketClient.disconnect();
    };
  }, []);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isSearching) {
      interval = setInterval(() => {
        setSearchTime(prev => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isSearching]);

  const startMatching = () => {
    if (!isConnected) {
      alert('WebSocket not connected');
      return;
    }

    // ユーザーIDを生成して保存
    const userId = 'user-' + Date.now();
    setCurrentUserId(userId);

    setIsSearching(true);
    setSearchTime(0);
    setMatchResult(null);

    // 認証コンテキストからユーザー名を取得
    const userName = user?.displayName || user?.email?.split('@')[0] || '匿名ユーザー';
    const userInitial = userName.charAt(0);

    socketClient.joinMatching({
      userId: userId,
      preferences: {
        ageRange: [18, 30],
        interests: ['ゲーム', '音楽', '映画', 'スポーツ'],
        maxWaitTime: 300
      },
      userInfo: {
        name: userName, // 実際はユーザー名
        age: 25, // 実際はユーザーの年齢
        interests: ['ゲーム', '映画', '音楽']
      }
    });

    console.log('Starting matching with user:', userName);
  };

  const cancelMatching = () => {
    if (!currentUserId) {
      console.error('No current user ID found');
      return;
    }

    console.log('Cancelling matching for user:', currentUserId);
    socketClient.leaveMatching(currentUserId);
    
    // 状態をリセット
    setIsSearching(false);
    setSearchTime(0);
    setCurrentUserId('');
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const startChat = () => {
    // チャット画面に遷移
    console.log('Starting chat with:', matchResult?.partner.name);
    // router.push(`/chat/${matchResult?.roomId}`);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        {/* ヘッダー */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center mb-4">
            <Sparkles className="w-8 h-8 text-purple-500 mr-2" />
            <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
              V-Chat
            </h1>
          </div>
          <p className="text-gray-600">新しい友達を見つけましょう</p>
        </div>

        {/* 戻るボタン */}
        <div className="mb-6">
          <Link href="/dashboard">
            <Button variant="outline" className="flex items-center">
              <ArrowLeft className="w-4 h-4 mr-2" />
              ダッシュボードに戻る
            </Button>
          </Link>
        </div>

        {/* 接続状態 */}
        <Card className="mb-6">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <div className={`w-3 h-3 rounded-full mr-2 ${
                  isConnected ? 'bg-green-500' : 'bg-red-500'
                }`}></div>
                <span className="text-sm text-gray-600">
                  {isConnected ? 'オンライン' : 'オフライン'}
                </span>
              </div>
              <div className="flex items-center text-sm text-gray-500">
                <Users className="w-4 h-4 mr-1" />
                {stats.waitingCount}人が待機中
              </div>
            </div>
          </CardContent>
        </Card>

        {/* マッチング結果 */}
        {matchResult ? (
          <Card className="mb-6 border-green-200 bg-green-50">
            <CardHeader className="text-center pb-4">
              <div className="mx-auto mb-4">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
                  <Heart className="w-8 h-8 text-green-600" />
                </div>
              </div>
              <CardTitle className="text-green-800">マッチング成功！</CardTitle>
            </CardHeader>
            <CardContent className="text-center">
              <div className="mb-4">
                <Avatar className="w-16 h-16 mx-auto mb-2">
                  <AvatarImage src="/api/placeholder/64/64" />
                  <AvatarFallback className="text-lg">
                    {matchResult.partner.name.charAt(0)}
                  </AvatarFallback>
                </Avatar>
                <h3 className="text-lg font-semibold text-gray-800">
                  {matchResult.partner.name}
                </h3>
                {matchResult.partner.age && (
                  <p className="text-sm text-gray-600">{matchResult.partner.age}歳</p>
                )}
              </div>
              
              {matchResult.partner.interests && (
                <div className="mb-4">
                  <p className="text-sm text-gray-600 mb-2">興味</p>
                  <div className="flex flex-wrap justify-center gap-1">
                    {matchResult.partner.interests.slice(0, 3).map((interest, index) => (
                      <span
                        key={index}
                        className="px-2 py-1 bg-purple-100 text-purple-700 text-xs rounded-full"
                      >
                        {interest}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <Button
                onClick={startChat}
                className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
              >
                <MessageCircle className="w-4 h-4 mr-2" />
                チャット開始
              </Button>
            </CardContent>
          </Card>
        ) : !isSearching ? (
          /* マッチング開始画面 */
          <Card className="mb-6">
            <CardHeader className="text-center">
              <div className="mx-auto mb-4">
                <div className="w-16 h-16 bg-gradient-to-r from-purple-100 to-pink-100 rounded-full flex items-center justify-center">
                  <UserCheck className="w-8 h-8 text-purple-600" />
                </div>
              </div>
              <CardTitle>ランダムマッチング</CardTitle>
              <p className="text-sm text-gray-600">
                共通の興味を持つ友達を見つけましょう
              </p>
            </CardHeader>
            <CardContent>
              <Button
                onClick={startMatching}
                disabled={!isConnected}
                className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 disabled:bg-gray-400 disabled:cursor-not-allowed h-12 text-lg font-semibold"
              >
                <Play className="w-5 h-5 mr-2" />
                マッチング開始
              </Button>
            </CardContent>
          </Card>
        ) : (
          /* マッチング中画面 */
          <Card className="mb-6">
            <CardHeader className="text-center">
              <div className="mx-auto mb-4">
                <div className="relative">
                  <div className="w-16 h-16 bg-gradient-to-r from-purple-100 to-pink-100 rounded-full flex items-center justify-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
                  </div>
                  <div className="absolute -top-1 -right-1 w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
                    <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
                  </div>
                </div>
              </div>
              <CardTitle>マッチング中...</CardTitle>
              <p className="text-sm text-gray-600">
                最適なパートナーを探しています
              </p>
            </CardHeader>
            <CardContent className="text-center">
              <div className="mb-4">
                <div className="flex items-center justify-center mb-2">
                  <Clock className="w-4 h-4 mr-2 text-gray-500" />
                  <span className="text-lg font-mono text-gray-700">
                    {formatTime(searchTime)}
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-gradient-to-r from-purple-500 to-pink-500 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${Math.min((searchTime / 60) * 100, 100)}%` }}
                  ></div>
                </div>
              </div>
              
              <Button
                onClick={cancelMatching}
                variant="outline"
                className="w-full border-red-300 text-red-600 hover:bg-red-50"
              >
                <X className="w-4 h-4 mr-2" />
                キャンセル
              </Button>
            </CardContent>
          </Card>
        )}

        {/* 統計情報 */}
        <Card>
          <CardContent className="p-4">
            <div className="grid grid-cols-2 gap-4 text-center">
              <div>
                <div className="text-2xl font-bold text-purple-600">
                  {stats.waitingCount}
                </div>
                <div className="text-xs text-gray-500">待機中</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-pink-600">
                  {stats.activeMatches}
                </div>
                <div className="text-xs text-gray-500">アクティブ</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}