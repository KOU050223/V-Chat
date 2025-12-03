import { VRMCacheManager } from '@/lib/vrmCache';
import { VRoidAPI } from '@/lib/vroid';

/**
 * VRM表示のための統合管理クラス
 * - URL直接読み込みを基本とする
 * - 必要に応じてキャッシュを活用
 * - ダウンロードは明示的な操作のみ
 */
export class VRMDisplayManager {
  private vrmCache: VRMCacheManager;
  private vroidApi: VRoidAPI;

  constructor(accessToken?: string, refreshToken?: string) {
    this.vrmCache = new VRMCacheManager({
      maxSize: 200, // 200MB（適度なサイズ）
      maxEntries: 10, // 最大10モデル
      defaultTTL: 2, // 2時間（短めに設定）
    });
    this.vroidApi = new VRoidAPI(accessToken, refreshToken);
  }

  /**
   * VRMファイルを表示用に取得
   * @param modelId VRoidモデルID
   * @param options 表示オプション
   */
  async getVRMForDisplay(modelId: string, options: {
    useCache?: boolean;
    cacheIfNew?: boolean;
    quality?: 'high' | 'medium' | 'low';
  } = {}): Promise<{
    url?: string;
    blob?: Blob;
    fromCache: boolean;
    cacheKey: string;
  }> {
    const { useCache = true, cacheIfNew = true, quality = 'medium' } = options;
    const cacheKey = `${modelId}_${quality}`;

    try {
      // 1. キャッシュから確認（高速）
      if (useCache) {
        const cachedUrl = await this.vrmCache.get(cacheKey);
        if (cachedUrl) {
          console.log('🎯 VRM found in cache:', modelId);
          return {
            url: cachedUrl,
            fromCache: true,
            cacheKey
          };
        }
      }

      // 2. URL直接取得を試行
      console.log('🌐 Getting VRM download URL:', modelId);
      const licenseResponse = await this.vroidApi.getCharacterModelDownloadLicense(modelId);
      
      if (!licenseResponse.data?.url) {
        throw new Error('Download URL not available');
      }

      const downloadUrl = licenseResponse.data.url;
      
      // 3. URL直接読み込みで十分な場合はそのまま返す
      if (!cacheIfNew) {
        return {
          url: downloadUrl,
          fromCache: false,
          cacheKey
        };
      }

      // 4. キャッシュする場合はBlobを取得
      console.log('📥 Fetching VRM for caching:', modelId);
      const response = await fetch(downloadUrl, {
        headers: {
          'Accept': 'application/octet-stream',
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch VRM: ${response.statusText}`);
      }

      const blob = await response.blob();
      
      // 5. キャッシュに保存（非同期）
      if (cacheIfNew) {
        try {
          await this.vrmCache.set(cacheKey, `Model ${modelId}`, blob);
        } catch (error: any) {
          console.warn('Failed to cache VRM:', error);
        }
      }

      return {
        blob,
        fromCache: false,
        cacheKey
      };

    } catch (error) {
      console.error('Failed to get VRM for display:', error);
      throw error;
    }
  }

  /**
   * VRMファイルを明示的にダウンロード（ユーザー操作）
   */
  async downloadVRM(modelId: string, modelName?: string): Promise<void> {
    try {
      const result = await this.getVRMForDisplay(modelId, { 
        useCache: true, 
        cacheIfNew: true 
      });

      if (result.blob) {
        // ダウンロードトリガー
        const url = URL.createObjectURL(result.blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${modelName || modelId}.vrm`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        console.log('✅ VRM download completed:', modelId);
      } else if (result.url) {
        // URL直接ダウンロード
        window.open(result.url, '_blank');
      }
    } catch (error) {
      console.error('Failed to download VRM:', error);
      throw error;
    }
  }

  /**
   * キャッシュ管理
   */
  async getCacheInfo() {
    await this.vrmCache.init();
    return this.vrmCache.getStats();
  }

  async clearCache() {
    await this.vrmCache.init();
    return this.vrmCache.clear();
  }
}

export default VRMDisplayManager;
