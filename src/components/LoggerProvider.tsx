'use client';

import { useEffect } from 'react';
import logger from '../lib/logger';

interface LoggerProviderProps {
  children: React.ReactNode;
}

export const LoggerProvider: React.FC<LoggerProviderProps> = ({ children }) => {
  useEffect(() => {
    // ロガーを初期化（console.logのオーバーライドが実行される）
    // ロガーはインポート時に自動的に初期化されるため、特別な処理は不要

    // グローバルエラーハンドラーを設定
    const handleUnhandledError = (event: ErrorEvent) => {
      console.error('Unhandled error:', event.error);
    };

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      console.error('Unhandled promise rejection:', event.reason);
    };

    window.addEventListener('error', handleUnhandledError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    return () => {
      window.removeEventListener('error', handleUnhandledError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, []);

  return <>{children}</>;
};