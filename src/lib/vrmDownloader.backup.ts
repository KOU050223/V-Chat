import { VRoidAPI } from '@/lib/vroid';

export interface VRMDownloadResult {
  blob: Blob;
  filename: string;
  modelId: string;
  licenseId?: string;
  expiresAt?: string;
}

export class VRMDownloader {
  private vroidClient: VRoidAPI;

  constructor(accessToken?: string, refreshToken?: string) {
    this.vroidClient = new VRoidAPI(accessToken, refreshToken);
  }

  /**
   * VRMファイルをダウンロード
   */
  async downloadVRM(modelId: string): Promise<VRMDownloadResult> {
    try {
      console.log('VRMダウンロード開始:', modelId);

      // 1. ダウンロードライセンス作成
      const licenseResponse = await this.vroidClient.getCharacterModelDownloadLicense(modelId);
      
      console.log('ライセンス作成レスポンス詳細:', {
        fullResponse: licenseResponse,
        data: licenseResponse.data,
        dataKeys: licenseResponse.data ? Object.keys(licenseResponse.data) : null,
        dataValues: licenseResponse.data
      });
      
      if (!(licenseResponse.data as any)?.id) {
        throw new Error('ダウンロードライセンスの作成に失敗しました');
      }

      const licenseId = (licenseResponse.data as any).id;
      const expiresAt = (licenseResponse.data as any).expires_at;
      
      console.log('ダウンロードライセンス作成成功:', {
        licenseId,
        expiresAt
      });

      // 2. 実際のダウンロードURL取得
      console.log('ダウンロードURL取得開始...');
      const downloadResponse = await this.vroidClient.getDownloadUrl(licenseId);
      
      console.log('ダウンロードURLレスポンス詳細:', {
        fullResponse: downloadResponse,
        data: downloadResponse.data,
        dataKeys: downloadResponse.data ? Object.keys(downloadResponse.data) : null,
        dataValues: downloadResponse.data
      });
      
      // より詳細なログ出力
      if (downloadResponse.data) {
        console.log('=== ダウンロードURLレスポンス構造分析 ===');
        console.log('Type of data:', typeof downloadResponse.data);
        console.log('Keys in data:', Object.keys(downloadResponse.data));
        console.log('Values in data:');
        Object.entries(downloadResponse.data).forEach(([key, value]) => {
          console.log(`  ${key}:`, value, `(type: ${typeof value})`);
        });
        console.log('=== 分析終了 ===');
      }
      
      // 3つのアプローチを試行
      let downloadUrl = null;
      let downloadSuccess = false;
      
      const accessToken = this.vroidClient.getAccessToken();
      if (!accessToken) {
        throw new Error('VRoidアクセストークンが利用できません');
      }
      
      // アプローチ1: ライセンスIDを直接ダウンロードURLとして使用
      try {
        console.log('=== アプローチ1: ライセンスID直接ダウンロード ===');
        const directUrl = `https://api.vroid.com/download_licenses/${licenseId}/download`;
        console.log('直接ダウンロードURL試行:', directUrl);
        
        const testResponse = await fetch(directUrl, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Accept': 'application/octet-stream',
          },
        });
        
        if (testResponse.ok) {
          console.log('アプローチ1成功: 直接ダウンロード可能');
          downloadUrl = directUrl;
          downloadSuccess = true;
        } else {
          console.log('アプローチ1失敗:', testResponse.status, testResponse.statusText);
        }
      } catch (error) {
        console.log('アプローチ1エラー:', error);
      }
      
      // アプローチ2: VRM Hub ファイルエンドポイント
      if (!downloadSuccess) {
        try {
          console.log('=== アプローチ2: VRoidファイルエンドポイント ===');
          const vrmFileUrl = `https://api.vroid.com/character_models/${(licenseResponse.data as any).character_model_id}/download?license_id=${licenseId}`;
          console.log('VRMファイルURL試行:', vrmFileUrl);
          
          const testResponse = await fetch(vrmFileUrl, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Accept': 'application/octet-stream',
            },
          });
          
          if (testResponse.ok) {
            console.log('アプローチ2成功: VRMファイルエンドポイント可能');
            downloadUrl = vrmFileUrl;
            downloadSuccess = true;
          } else {
            console.log('アプローチ2失敗:', testResponse.status, testResponse.statusText);
          }
        } catch (error) {
          console.log('アプローチ2エラー:', error);
        }
      }
      
      // アプローチ3: プロキシ経由でのダウンロード
      if (!downloadSuccess) {
        try {
          console.log('=== アプローチ3: プロキシ経由ダウンロード ===');
          const proxyUrl = `/api/vroid/download-vrm?license_id=${licenseId}&model_id=${(licenseResponse.data as any).character_model_id}`;
          console.log('プロキシURL試行:', proxyUrl);
          
          downloadUrl = proxyUrl;
          downloadSuccess = true;
          console.log('アプローチ3: プロキシ経由を試行');
        } catch (error) {
          console.log('アプローチ3エラー:', error);
        }
      }
      
      if (!downloadUrl) {
        throw new Error('すべてのダウンロード方法が失敗しました');
      }
      
      console.log('ダウンロードURL取得成功:', {
        url: downloadUrl
      });

      // 3. VRMファイルをダウンロード
      console.log('VRMファイルダウンロード開始...');
      const response = await fetch(downloadUrl, {
        method: 'GET',
        headers: {
          'Accept': 'application/octet-stream',
        },
      });

      if (!response.ok) {
        throw new Error(`VRMファイルダウンロード失敗: ${response.status} ${response.statusText}`);
      }

      const blob = await response.blob();
      const filename = this.extractFilenameFromUrl(downloadUrl) || `model_${modelId}.vrm`;

      console.log('VRMダウンロード完了:', {
        modelId,
        filename,
        size: blob.size,
        type: blob.type
      });

      return {
        blob,
        filename,
        modelId,
        url: downloadUrl
      };

    } catch (error) {
      console.error('VRMダウンロードエラー:', error);
      
      if (error instanceof Error) {
        throw error;
      } else {
        throw new Error(`VRMダウンロードに失敗しました: ${String(error)}`);
      }
    }
  }

  /**
   * ダウンロードURLからファイル名を抽出
   */
  private extractFilenameFromUrl(url: string): string | null {
    try {
      const urlObj = new URL(url);
      const pathname = urlObj.pathname;
      const filename = pathname.split('/').pop();
      
      if (filename && filename.includes('.vrm')) {
        return filename;
      }
      
      return null;
    } catch {
      return null;
    }
  }

  /**
   * BlobからObjectURLを作成
   */
  createObjectURL(blob: Blob): string {
    return URL.createObjectURL(blob);
  }

  /**
   * ObjectURLを解放
   */
  revokeObjectURL(url: string): void {
    URL.revokeObjectURL(url);
  }
}

/**
 * useVRoidModelsフック用のVRMダウンローダー作成関数
 */
export function createVRMDownloader(accessToken?: string, refreshToken?: string): VRMDownloader {
  return new VRMDownloader(accessToken, refreshToken);
}
