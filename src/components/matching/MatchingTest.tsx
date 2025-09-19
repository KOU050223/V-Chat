'use client';

import { useState, useEffect } from 'react';
import { socketClient } from '@/lib/socket-client';
import { MatchingResult } from '@/types/matching_type';

export default function MatchingTest() {
  const [isConnected, setIsConnected] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [matchResult, setMatchResult] = useState<MatchingResult | null>(null);
  const [stats, setStats] = useState({ waitingCount: 0, activeMatches: 0 });
  const [logs, setLogs] = useState<string[]>([]);

  const addLog = (message: string) => {
    setLogs(prev => [...prev, `${new Date().toLocaleTimeString()}: ${message}`]);
  };

  useEffect(() => {
    // WebSocket接続
    socketClient.connect().then(() => {
      setIsConnected(true);
      addLog('WebSocket接続成功');
      
      // イベントリスナーの設定
      socketClient.onMatchingJoined((data) => {
        addLog(`マッチングキューに参加: ${JSON.stringify(data)}`);
      });

      socketClient.onMatchFound((data) => {
        addLog(`マッチング成功: ${JSON.stringify(data)}`);
        setMatchResult(data);
        setIsSearching(false);
      });

      socketClient.onMatchingLeft((data) => {
        addLog(`マッチングキューから離脱: ${JSON.stringify(data)}`);
        setIsSearching(false);
      });

      socketClient.onStatsUpdated((data) => {
        setStats(data);
        addLog(`統計更新: ${JSON.stringify(data)}`);
      });

      socketClient.onError((error) => {
        addLog(`エラー: ${JSON.stringify(error)}`);
        alert(error.message);
      });

      // 初期統計情報を取得
      socketClient.getStats();
    }).catch((error) => {
      addLog(`接続エラー: ${error.message}`);
    });

    return () => {
      socketClient.disconnect();
    };
  }, []);

  const startMatching = () => {
    if (!isConnected) {
      alert('WebSocket not connected');
      return;
    }

    setIsSearching(true);
    setMatchResult(null);
    addLog('マッチング開始');

    socketClient.joinMatching({
      userId: 'user-' + Date.now(),
      preferences: {
        ageRange: [18, 30],
        interests: ['ゲーム', '音楽'],
        maxWaitTime: 300
      },
      userInfo: {
        name: 'テストユーザー',
        age: 25,
        interests: ['ゲーム', '映画']
      }
    });
  };

  const cancelMatching = () => {
    const userId = 'user-' + Date.now();
    socketClient.leaveMatching(userId);
    addLog('マッチングキャンセル');
  };

  const clearLogs = () => {
    setLogs([]);
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h2 className="text-2xl font-bold mb-4">マッチング機能テスト</h2>
      
      {/* ステータス表示 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-blue-100 p-4 rounded-lg">
          <h3 className="font-bold">接続状態</h3>
          <p className={isConnected ? 'text-green-600' : 'text-red-600'}>
            {isConnected ? '✅ 接続中' : '❌ 未接続'}
          </p>
        </div>
        
        <div className="bg-green-100 p-4 rounded-lg">
          <h3 className="font-bold">待機ユーザー</h3>
          <p>{stats.waitingCount}人</p>
        </div>
        
        <div className="bg-purple-100 p-4 rounded-lg">
          <h3 className="font-bold">アクティブマッチング</h3>
          <p>{stats.activeMatches}件</p>
        </div>
      </div>

      {/* 操作ボタン */}
      <div className="mb-6">
        {!isSearching ? (
          <button
            onClick={startMatching}
            disabled={!isConnected}
            className="bg-blue-500 text-white px-6 py-3 rounded-lg hover:bg-blue-600 transition-colors disabled:bg-gray-400 mr-4"
          >
            マッチング開始
          </button>
        ) : (
          <button
            onClick={cancelMatching}
            className="bg-red-500 text-white px-6 py-3 rounded-lg hover:bg-red-600 transition-colors"
          >
            キャンセル
          </button>
        )}
        
        <button
          onClick={() => socketClient.getStats()}
          className="bg-gray-500 text-white px-4 py-3 rounded-lg hover:bg-gray-600 transition-colors ml-4"
        >
          統計更新
        </button>
        
        <button
          onClick={clearLogs}
          className="bg-yellow-500 text-white px-4 py-3 rounded-lg hover:bg-yellow-600 transition-colors ml-4"
        >
          ログクリア
        </button>
      </div>

      {/* マッチング結果 */}
      {matchResult && (
        <div className="bg-green-100 p-4 rounded-lg mb-6">
          <h3 className="text-lg font-bold text-green-800">マッチング成功！</h3>
          <p className="text-green-700">
            パートナー: {matchResult.partner.name}
          </p>
          <p className="text-sm text-green-600">
            ルームID: {matchResult.roomId}
          </p>
        </div>
      )}

      {/* ログ表示 */}
      <div className="bg-gray-100 p-4 rounded-lg">
        <h3 className="font-bold mb-2">ログ</h3>
        <div className="h-64 overflow-y-auto bg-white p-2 rounded text-sm">
          {logs.map((log, index) => (
            <div key={index} className="mb-1">
              {log}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}