interface LogLevel {
  ERROR: 'error';
  WARN: 'warn';
  INFO: 'info';
  DEBUG: 'debug';
}

interface LogEntry {
  timestamp: string;
  level: keyof LogLevel;
  message: string;
  data?: any;
  source?: string;
}

class Logger {
  private logs: LogEntry[] = [];
  private maxLogs: number = 1000;
  private isDevelopment: boolean = process.env.NODE_ENV === 'development';

  constructor() {
    // ブラウザ環境でのみ実行
    if (typeof window !== 'undefined') {
      try {
        this.setupConsoleOverride();
      } catch (error) {
        // セットアップに失敗してもアプリが落ちないようにする
        console.error('Logger setup failed:', error);
      }
    }
  }

  private setupConsoleOverride() {
    // 元のconsole関数を保存
    const originalConsole = {
      log: console.log.bind(console),
      error: console.error.bind(console),
      warn: console.warn.bind(console),
      info: console.info.bind(console),
      debug: console.debug.bind(console)
    };

    // console.logをオーバーライド（安全な実装）
    console.log = (...args: any[]) => {
      try {
        // まず元のconsole.logを実行
        originalConsole.log(...args);

        // ログファイルに記録（エラーが発生してもアプリを止めない）
        setTimeout(() => {
          try {
            this.log('info', this.formatMessage(args));
          } catch (logError) {
            // ログ記録エラーは無視
          }
        }, 0);
      } catch (error) {
        // 何らかのエラーが発生した場合は元のconsole.logのみ実行
        originalConsole.log(...args);
      }
    };

    console.error = (...args: any[]) => {
      try {
        originalConsole.error(...args);
        setTimeout(() => {
          try {
            this.log('error', this.formatMessage(args));
          } catch (logError) {
            // ログ記録エラーは無視
          }
        }, 0);
      } catch (error) {
        originalConsole.error(...args);
      }
    };

    console.warn = (...args: any[]) => {
      try {
        originalConsole.warn(...args);
        setTimeout(() => {
          try {
            this.log('warn', this.formatMessage(args));
          } catch (logError) {
            // ログ記録エラーは無視
          }
        }, 0);
      } catch (error) {
        originalConsole.warn(...args);
      }
    };

    console.info = (...args: any[]) => {
      try {
        originalConsole.info(...args);
        setTimeout(() => {
          try {
            this.log('info', this.formatMessage(args));
          } catch (logError) {
            // ログ記録エラーは無視
          }
        }, 0);
      } catch (error) {
        originalConsole.info(...args);
      }
    };

    console.debug = (...args: any[]) => {
      try {
        originalConsole.debug(...args);
        setTimeout(() => {
          try {
            this.log('debug', this.formatMessage(args));
          } catch (logError) {
            // ログ記録エラーは無視
          }
        }, 0);
      } catch (error) {
        originalConsole.debug(...args);
      }
    };
  }

  private formatMessage(args: any[]): string {
    return args.map(arg => {
      if (typeof arg === 'object' && arg !== null) {
        try {
          // 循環参照を検出して安全にシリアライズ
          return JSON.stringify(arg, this.circularReplacer(), 2);
        } catch (err) {
          // JSON.stringify が失敗した場合の代替処理
          if (arg instanceof Error) {
            return `Error: ${arg.name}: ${arg.message}`;
          }
          return `[Object: ${arg.constructor?.name || 'Unknown'}]`;
        }
      }
      return String(arg);
    }).join(' ');
  }

  // 循環参照を処理するためのreplacer関数
  private circularReplacer() {
    const seen = new WeakSet();
    return (key: string, value: any) => {
      if (typeof value === 'object' && value !== null) {
        if (seen.has(value)) {
          return '[Circular Reference]';
        }
        seen.add(value);
      }
      return value;
    };
  }

  private log(level: keyof LogLevel, message: string, data?: any, source?: string) {
    // 重複ログのフィルタリング
    const isDuplicate = this.logs.length > 0 &&
      this.logs[this.logs.length - 1].message === message &&
      this.logs[this.logs.length - 1].level === level;

    // VRM警告の重複を特別に処理
    const isVrmWarning = message.includes('Curves of LookAtDegreeMap defined in VRM 0.0 are not supported');

    if (isDuplicate || (isVrmWarning && this.logs.some(log => log.message.includes('Curves of LookAtDegreeMap')))) {
      return; // 重複ログは記録しない
    }

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      data,
      source
    };

    this.logs.push(entry);

    // ログ数の制限
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs);
    }

    // ブラウザのローカルストレージに保存
    this.saveToLocalStorage();
  }

  private saveToLocalStorage() {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.setItem('vchat-logs', JSON.stringify(this.logs));
      }
    } catch (error) {
      // ローカルストレージの容量制限などでエラーが発生した場合
      // エラーを無視してアプリの動作を継続
    }
  }

  // 公開メソッド
  public getLogs(): LogEntry[] {
    return [...this.logs];
  }

  public getLogsByLevel(level: keyof LogLevel): LogEntry[] {
    return this.logs.filter(log => log.level === level);
  }

  public clearLogs(): void {
    this.logs = [];
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.removeItem('vchat-logs');
    }
  }

  public exportLogs(): string {
    return this.logs.map(log =>
      `[${log.timestamp}] [${log.level.toUpperCase()}] ${log.message}${log.data ? '\n' + JSON.stringify(log.data, null, 2) : ''}`
    ).join('\n');
  }

  public downloadLogs(): void {
    if (typeof window === 'undefined') return;

    const logContent = this.exportLogs();
    const blob = new Blob([logContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `vchat-logs-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // フィルタリング機能
  public getLogsAfter(timestamp: string): LogEntry[] {
    return this.logs.filter(log => log.timestamp > timestamp);
  }

  public getLogsBySource(source: string): LogEntry[] {
    return this.logs.filter(log => log.source === source);
  }

  // 統計情報
  public getLogStats(): { [key in keyof LogLevel]: number } {
    const stats = { error: 0, warn: 0, info: 0, debug: 0 };
    this.logs.forEach(log => {
      stats[log.level]++;
    });
    return stats;
  }
}

// シングルトンインスタンス
const logger = new Logger();

// ログ復元（ページリロード時）
if (typeof window !== 'undefined' && window.localStorage) {
  try {
    const savedLogs = localStorage.getItem('vchat-logs');
    if (savedLogs) {
      const parsedLogs = JSON.parse(savedLogs);
      if (Array.isArray(parsedLogs)) {
        (logger as any).logs = parsedLogs;
      }
    }
  } catch (error) {
    // ログ復元に失敗してもアプリの動作を継続
  }
}

export default logger;

// 便利な関数もエクスポート
export const logInfo = (message: string, data?: any, source?: string) => {
  console.log(message, data);
};

export const logError = (message: string, data?: any, source?: string) => {
  console.error(message, data);
};

export const logWarn = (message: string, data?: any, source?: string) => {
  console.warn(message, data);
};

export const logDebug = (message: string, data?: any, source?: string) => {
  console.debug(message, data);
};