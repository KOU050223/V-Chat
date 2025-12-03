"use client";

import { useState, useCallback, useEffect } from "react";
import { VRoidCharacterModel } from "@/lib/vroid";
import { vrmCache } from "@/lib/vrmCache";

interface UseVRMDownloadOptions {
  enableCache?: boolean;
  maxCacheSize?: number; // MB
  maxCacheEntries?: number;
  cacheTTL?: number; // 時間
}

interface DownloadProgress {
  modelId: string;
  progress: number; // 0-100
  status: "downloading" | "processing" | "completed" | "error";
  error?: string;
}

export function useVRMDownload(options: UseVRMDownloadOptions = {}) {
  const {
    enableCache = true,
    maxCacheSize = 100,
    maxCacheEntries = 50,
    cacheTTL = 24,
  } = options;

  const [downloads, setDownloads] = useState<Map<string, DownloadProgress>>(
    new Map()
  );
  const [cacheInitialized, setCacheInitialized] = useState(false);

  // IndexedDBキャッシュを初期化
  useEffect(() => {
    if (enableCache) {
      vrmCache
        .init()
        .then(() => {
          setCacheInitialized(true);
        })
        .catch((error) => {
          console.error("VRM Cache initialization failed:", error);
          setCacheInitialized(false);
        });
    } else {
      setCacheInitialized(true);
    }
  }, [enableCache]);

  // キャッシュからVRMを取得
  const getCachedVRM = useCallback(
    async (modelId: string): Promise<string | null> => {
      if (!enableCache || !cacheInitialized) return null;

      try {
        return await vrmCache.get(modelId);
      } catch (error) {
        console.error("Cache get error:", error);
        return null;
      }
    },
    [enableCache, cacheInitialized]
  );

  // VRMファイルをダウンロードしてBlobURLを作成
  const downloadVRM = useCallback(
    async (model: VRoidCharacterModel): Promise<string> => {
      const modelId = model.id;

      // キャッシュから取得を試行
      const cachedUrl = await getCachedVRM(modelId);
      if (cachedUrl) {
        return cachedUrl;
      }

      // ダウンロード進行状況を初期化
      setDownloads(
        (prev) =>
          new Map(
            prev.set(modelId, {
              modelId,
              progress: 0,
              status: "downloading",
            })
          )
      );

      try {
        // APIからVRMデータを取得
        const response = await fetch("/api/vroid/download-blob", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ modelId }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || "ダウンロードに失敗しました");
        }

        // 進行状況を更新
        setDownloads(
          (prev) =>
            new Map(
              prev.set(modelId, {
                modelId,
                progress: 50,
                status: "processing",
              })
            )
        );

        const responseData = await response.json();

        if (!responseData.success) {
          throw new Error(responseData.error || "データの取得に失敗しました");
        }

        // Base64データをBlobに変換
        const { base64Data, size, expiresAt } = responseData.data;
        const binaryString = atob(base64Data);
        const bytes = new Uint8Array(binaryString.length);

        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }

        const blob = new Blob([bytes], { type: "application/octet-stream" });

        // キャッシュに保存してBlobURLを取得
        let blobUrl: string;
        if (enableCache && cacheInitialized) {
          try {
            const expiresAt = new Date(responseData.data.expiresAt);
            blobUrl = await vrmCache.set(modelId, model.name, blob, expiresAt);
          } catch (error) {
            console.error("Cache set error:", error);
            blobUrl = URL.createObjectURL(blob);
          }
        } else {
          blobUrl = URL.createObjectURL(blob);
        }

        // 進行状況を完了に更新
        setDownloads(
          (prev) =>
            new Map(
              prev.set(modelId, {
                modelId,
                progress: 100,
                status: "completed",
              })
            )
        );

        // しばらくしてダウンロード状況をクリア
        setTimeout(() => {
          setDownloads((prev) => {
            const newMap = new Map(prev);
            newMap.delete(modelId);
            return newMap;
          });
        }, 3000);

        return blobUrl;
      } catch (error: any) {
        console.error("VRM Download Error:", error);

        setDownloads(
          (prev) =>
            new Map(
              prev.set(modelId, {
                modelId,
                progress: 0,
                status: "error",
                error: error.message,
              })
            )
        );

        throw error;
      }
    },
    [enableCache, cacheInitialized, getCachedVRM]
  );

  // VRMファイルを直接ダウンロード（ファイル保存）
  const downloadVRMFile = useCallback(
    async (model: VRoidCharacterModel): Promise<void> => {
      const modelId = model.id;

      try {
        const response = await fetch("/api/vroid/download-vrm", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ modelId }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || "ダウンロードに失敗しました");
        }

        // ファイルをダウンロード
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);

        const a = document.createElement("a");
        a.href = url;
        a.download = `${model.name || modelId}.vrm`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);

        URL.revokeObjectURL(url);
      } catch (error: any) {
        console.error("VRM File Download Error:", error);
        throw error;
      }
    },
    []
  );

  // キャッシュをクリア
  const clearCache = useCallback(async () => {
    if (enableCache && cacheInitialized) {
      try {
        await vrmCache.clear();
      } catch (error) {
        console.error("Cache clear error:", error);
      }
    }
  }, [enableCache, cacheInitialized]);

  // ダウンロード状況を取得
  const getDownloadStatus = useCallback(
    (modelId: string): DownloadProgress | null => {
      return downloads.get(modelId) || null;
    },
    [downloads]
  );

  // キャッシュ情報を取得
  const getCacheInfo = useCallback(async () => {
    if (!enableCache || !cacheInitialized) {
      return {
        count: 0,
        totalSize: 0,
        maxSize: maxCacheSize * 1024 * 1024,
        entries: [],
      };
    }

    try {
      const stats = await vrmCache.getStats();
      return {
        ...stats,
        maxSize: maxCacheSize * 1024 * 1024,
      };
    } catch (error) {
      console.error("Cache stats error:", error);
      return {
        count: 0,
        totalSize: 0,
        maxSize: maxCacheSize * 1024 * 1024,
        entries: [],
      };
    }
  }, [enableCache, cacheInitialized, maxCacheSize]);

  return {
    // メソッド
    downloadVRM,
    downloadVRMFile,
    getCachedVRM,
    clearCache,

    // 状態
    downloads: Array.from(downloads.values()),
    getDownloadStatus,
    getCacheInfo,

    // 設定
    cacheEnabled: enableCache,
    cacheInitialized,
  };
}
