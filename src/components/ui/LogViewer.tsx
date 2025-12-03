'use client';

import React, { useState, useEffect } from 'react';
import logger, { type LogEntry, type LogLevel } from '../../lib/logger';

interface LogViewerProps {
  isVisible: boolean;
  onClose: () => void;
}

export const LogViewer: React.FC<LogViewerProps> = ({ isVisible, onClose }) => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [filter, setFilter] = useState<'all' | 'error' | 'warn' | 'info' | 'debug'>('all');
  const [autoScroll, setAutoScroll] = useState(true);

  useEffect(() => {
    if (!isVisible) return;

    const updateLogs = () => {
      const allLogs = logger.getLogs();
      setLogs(allLogs);
    };

    updateLogs();
    const interval = setInterval(updateLogs, 1000);

    return () => clearInterval(interval);
  }, [isVisible]);

  useEffect(() => {
    if (autoScroll && isVisible) {
      const logContainer = document.getElementById('log-container');
      if (logContainer) {
        logContainer.scrollTop = logContainer.scrollHeight;
      }
    }
  }, [logs, autoScroll, isVisible]);

  const filteredLogs = filter === 'all' ? logs : logs.filter(log => log.level === filter);

  const getLevelColor = (level: string) => {
    switch (level) {
      case 'error': return 'text-red-500';
      case 'warn': return 'text-yellow-500';
      case 'info': return 'text-blue-500';
      case 'debug': return 'text-gray-500';
      default: return 'text-gray-300';
    }
  };

  const getLevelBg = (level: string) => {
    switch (level) {
      case 'error': return 'bg-red-500/10';
      case 'warn': return 'bg-yellow-500/10';
      case 'info': return 'bg-blue-500/10';
      case 'debug': return 'bg-gray-500/10';
      default: return 'bg-gray-300/10';
    }
  };

  const stats = logger.getLogStats();

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black bg-opacity-75 flex items-center justify-center p-4">
      <div className="bg-gray-900 text-white rounded-lg w-full max-w-6xl h-5/6 flex flex-col">
        {/* ヘッダー */}
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <h2 className="text-xl font-bold">ログビューア</h2>
          <div className="flex items-center gap-4">
            {/* 統計情報 */}
            <div className="flex gap-2 text-sm">
              <span className="text-red-500">Error: {stats.error}</span>
              <span className="text-yellow-500">Warn: {stats.warn}</span>
              <span className="text-blue-500">Info: {stats.info}</span>
              <span className="text-gray-500">Debug: {stats.debug}</span>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white"
            >
              ✕
            </button>
          </div>
        </div>

        {/* コントロール */}
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <div className="flex gap-2">
            {(['all', 'error', 'warn', 'info', 'debug'] as const).map(level => (
              <button
                key={level}
                onClick={() => setFilter(level)}
                className={`px-3 py-1 rounded text-sm ${
                  filter === level
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                {level === 'all' ? 'All' : level.charAt(0).toUpperCase() + level.slice(1)}
              </button>
            ))}
          </div>

          <div className="flex gap-2">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={autoScroll}
                onChange={(e) => setAutoScroll(e.target.checked)}
                className="rounded"
              />
              Auto Scroll
            </label>
            <button
              onClick={() => logger.clearLogs()}
              className="px-3 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700"
            >
              Clear
            </button>
            <button
              onClick={() => logger.downloadLogs()}
              className="px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700"
            >
              Download
            </button>
          </div>
        </div>

        {/* ログ表示エリア */}
        <div
          id="log-container"
          className="flex-1 overflow-y-auto p-4 font-mono text-sm"
        >
          {filteredLogs.length === 0 ? (
            <div className="text-gray-500 text-center py-8">
              ログがありません
            </div>
          ) : (
            filteredLogs.map((log, index) => (
              <div
                key={index}
                className={`mb-2 p-2 rounded ${getLevelBg(log.level)} border-l-4 border-l-current`}
              >
                <div className="flex items-start gap-2">
                  <span className="text-gray-400 text-xs whitespace-nowrap">
                    {new Date(log.timestamp).toLocaleTimeString('ja-JP', {
                      hour12: false,
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                      fractionalSecondDigits: 3
                    })}
                  </span>
                  <span className={`text-xs font-bold uppercase ${getLevelColor(log.level)} w-12`}>
                    {log.level}
                  </span>
                  <span className="flex-1 break-words">
                    {log.message}
                  </span>
                </div>
                {log.data && (
                  <div className="mt-1 ml-20 text-gray-400 text-xs">
                    <pre className="whitespace-pre-wrap">
                      {typeof log.data === 'string' ? log.data : JSON.stringify(log.data, null, 2)}
                    </pre>
                  </div>
                )}
                {log.source && (
                  <div className="mt-1 ml-20 text-gray-500 text-xs">
                    Source: {log.source}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};