"use client";

interface VRMCacheEntry {
  id: string;
  modelId: string;
  modelName: string | null;
  blob: Blob;
  blobUrl: string;
  size: number;
  cachedAt: Date;
  expiresAt: Date;
  accessCount: number;
  lastAccessed: Date;
}

interface VRMCacheOptions {
  maxSize?: number; // キャッシュ最大サイズ（MB）
  maxEntries?: number; // キャッシュ最大エントリ数
  defaultTTL?: number; // デフォルトTTL（時間）
}

export class VRMCacheManager {
  private dbName = "vrm-cache";
  private dbVersion = 1;
  private storeName = "vrm-files";
  private db: IDBDatabase | null = null;
  private blobUrls: Map<string, string> = new Map();

  constructor(private options: VRMCacheOptions = {}) {
    this.options = {
      maxSize: 500, // 500MB
      maxEntries: 50,
      defaultTTL: 24, // 24時間
      ...options,
    };
  }

  /**
   * IndexedDBを初期化
   */
  async init(): Promise<void> {
    if (typeof window === "undefined") return; // サーバーサイドでは何もしない

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        if (!db.objectStoreNames.contains(this.storeName)) {
          const store = db.createObjectStore(this.storeName, { keyPath: "id" });
          store.createIndex("modelId", "modelId", { unique: true });
          store.createIndex("cachedAt", "cachedAt");
          store.createIndex("lastAccessed", "lastAccessed");
        }
      };
    });
  }

  /**
   * キャッシュにVRMを保存
   */
  async set(
    modelId: string,
    modelName: string | null,
    blob: Blob,
    expiresAt?: Date
  ): Promise<string> {
    if (!this.db) await this.init();
    if (!this.db) throw new Error("IndexedDB is not available");

    const now = new Date();
    const expires =
      expiresAt ||
      new Date(now.getTime() + this.options.defaultTTL! * 60 * 60 * 1000);

    // 既存のBlobURLがある場合は解放してメモリリークを防ぐ
    const existingBlobUrl = this.blobUrls.get(modelId);
    if (existingBlobUrl) {
      URL.revokeObjectURL(existingBlobUrl);
    }

    // 新しいBlobURLを作成
    const blobUrl = URL.createObjectURL(blob);
    this.blobUrls.set(modelId, blobUrl);

    const entry: VRMCacheEntry = {
      id: modelId,
      modelId,
      modelName,
      blob,
      blobUrl,
      size: blob.size,
      cachedAt: now,
      expiresAt: expires,
      accessCount: 1,
      lastAccessed: now,
    };

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], "readwrite");
      const store = transaction.objectStore(this.storeName);
      const request = store.put(entry);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.cleanupIfNeeded();
        resolve(blobUrl);
      };
    });
  }

  /**
   * キャッシュからVRMを取得
   */
  async get(modelId: string): Promise<string | null> {
    if (!this.db) await this.init();
    if (!this.db) return null;

    // メモリキャッシュから先に確認
    const cachedUrl = this.blobUrls.get(modelId);
    if (cachedUrl) {
      this.updateAccessInfo(modelId);
      return cachedUrl;
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], "readwrite");
      const store = transaction.objectStore(this.storeName);
      const request = store.get(modelId);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const entry = request.result as VRMCacheEntry | undefined;

        if (!entry) {
          resolve(null);
          return;
        }

        // 有効期限をチェック
        if (new Date() > entry.expiresAt) {
          this.delete(modelId);
          resolve(null);
          return;
        }

        // BlobURLを再作成してメモリキャッシュに保存
        const blobUrl = URL.createObjectURL(entry.blob);
        this.blobUrls.set(modelId, blobUrl);

        // アクセス情報を更新
        entry.accessCount++;
        entry.lastAccessed = new Date();
        store.put(entry);

        resolve(blobUrl);
      };
    });
  }

  /**
   * キャッシュエントリを削除
   */
  async delete(modelId: string): Promise<void> {
    if (!this.db) return;

    // メモリキャッシュのBlobURLを削除
    const blobUrl = this.blobUrls.get(modelId);
    if (blobUrl) {
      URL.revokeObjectURL(blobUrl);
      this.blobUrls.delete(modelId);
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], "readwrite");
      const store = transaction.objectStore(this.storeName);
      const request = store.delete(modelId);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  /**
   * キャッシュ全体をクリア
   */
  async clear(): Promise<void> {
    if (!this.db) return;

    // メモリキャッシュのBlobURLsをすべて削除
    this.blobUrls.forEach((url) => URL.revokeObjectURL(url));
    this.blobUrls.clear();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], "readwrite");
      const store = transaction.objectStore(this.storeName);
      const request = store.clear();

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  /**
   * キャッシュ統計情報を取得
   */
  async getStats(): Promise<{
    count: number;
    totalSize: number;
    entries: Array<{
      modelId: string;
      modelName: string | null;
      size: number;
      cachedAt: Date;
      lastAccessed: Date;
      accessCount: number;
    }>;
  }> {
    if (!this.db) await this.init();
    if (!this.db) return { count: 0, totalSize: 0, entries: [] };

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], "readonly");
      const store = transaction.objectStore(this.storeName);
      const request = store.getAll();

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const entries = request.result as VRMCacheEntry[];
        const totalSize = entries.reduce((sum, entry) => sum + entry.size, 0);

        resolve({
          count: entries.length,
          totalSize,
          entries: entries.map((entry) => ({
            modelId: entry.modelId,
            modelName: entry.modelName,
            size: entry.size,
            cachedAt: entry.cachedAt,
            lastAccessed: entry.lastAccessed,
            accessCount: entry.accessCount,
          })),
        });
      };
    });
  }

  /**
   * アクセス情報を更新
   */
  private async updateAccessInfo(modelId: string): Promise<void> {
    if (!this.db) return;

    const transaction = this.db.transaction([this.storeName], "readwrite");
    const store = transaction.objectStore(this.storeName);

    const request = store.get(modelId);
    request.onsuccess = () => {
      const entry = request.result as VRMCacheEntry | undefined;
      if (entry) {
        entry.accessCount++;
        entry.lastAccessed = new Date();
        store.put(entry);
      }
    };
  }

  /**
   * 必要に応じてキャッシュをクリーンアップ
   */
  private async cleanupIfNeeded(): Promise<void> {
    const stats = await this.getStats();
    const maxSizeBytes = this.options.maxSize! * 1024 * 1024;

    // サイズまたはエントリ数が制限を超えている場合はクリーンアップ
    if (
      stats.totalSize > maxSizeBytes ||
      stats.count > this.options.maxEntries!
    ) {
      await this.cleanup();
    }
  }

  /**
   * LRU方式でキャッシュをクリーンアップ
   */
  private async cleanup(): Promise<void> {
    const stats = await this.getStats();
    const maxSizeBytes = this.options.maxSize! * 1024 * 1024;

    // 最後にアクセスされた時間でソート（古いものから削除）
    const sortedEntries = stats.entries.sort(
      (a, b) => a.lastAccessed.getTime() - b.lastAccessed.getTime()
    );

    let currentSize = stats.totalSize;
    let currentCount = stats.count;

    for (const entry of sortedEntries) {
      if (
        currentSize <= maxSizeBytes * 0.8 &&
        currentCount <= this.options.maxEntries! * 0.8
      ) {
        break; // 80%まで削減したら停止
      }

      await this.delete(entry.modelId);
      currentSize -= entry.size;
      currentCount--;
    }
  }
}

// シングルトンインスタンス
export const vrmCache = new VRMCacheManager();

// フック関数
export function useVRMCache(options?: VRMCacheOptions) {
  const cache = new VRMCacheManager(options);

  return {
    init: () => cache.init(),
    get: (modelId: string) => cache.get(modelId),
    set: (
      modelId: string,
      modelName: string | null,
      blob: Blob,
      expiresAt?: Date
    ) => cache.set(modelId, modelName, blob, expiresAt),
    delete: (modelId: string) => cache.delete(modelId),
    clear: () => cache.clear(),
    getStats: () => cache.getStats(),
  };
}
