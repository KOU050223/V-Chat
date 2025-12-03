import { VRoidAPI } from "@/lib/vroid";

export interface VRMDownloadResult {
  blob: Blob;
  filename: string;
  modelId: string;
  licenseId?: string;
  expiresAt?: string;
}

/**
 * VRMファイルダウンロードを管理するクラス
 * VRoid Hub APIを使用してVRMファイルをダウンロードします
 */
export class VRMDownloader {
  private vroidClient: VRoidAPI;

  constructor(accessToken?: string, refreshToken?: string) {
    this.vroidClient = new VRoidAPI(accessToken, refreshToken);
  }

  /**
   * VRMファイルをダウンロード
   * @param modelId - ダウンロードするモデルのID
   * @returns VRMファイルのBlobとメタデータ
   */
  async downloadVRM(modelId: string): Promise<VRMDownloadResult> {
    try {
      console.log("VRMダウンロード開始:", modelId);

      // 1. ダウンロードライセンス作成
      const licenseResponse =
        await this.vroidClient.getCharacterModelDownloadLicense(modelId);

      if (!(licenseResponse.data as any)?.id) {
        throw new Error("ダウンロードライセンスの作成に失敗しました");
      }

      const licenseId = (licenseResponse.data as any).id;
      const expiresAt = (licenseResponse.data as any).expires_at;

      console.log("ダウンロードライセンス作成成功:", {
        licenseId,
        expiresAt,
      });

      // 2. プロキシ経由でVRMファイルをダウンロード
      const downloadUrl = `/api/vroid/download-vrm?license_id=${licenseId}&model_id=${modelId}`;
      console.log("VRMファイルダウンロード開始:", downloadUrl);

      const response = await fetch(downloadUrl, {
        method: "GET",
        headers: {
          Accept: "application/octet-stream",
        },
      });

      if (!response.ok) {
        throw new Error(
          `VRMファイルダウンロード失敗: ${response.status} ${response.statusText}`
        );
      }

      // 3. ファイル情報を取得
      const blob = await response.blob();
      const contentDisposition = response.headers.get("content-disposition");

      // ファイル名を抽出または生成
      let filename = `model_${modelId}.vrm`;
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(
          /filename[^;=\n]*=((['"]).*?\\2|[^;\\n]*)/
        );
        if (filenameMatch) {
          filename = filenameMatch[1].replace(/['"]/g, "");
        }
      }

      console.log("VRMダウンロード完了:", {
        modelId,
        filename,
        size: blob.size,
        type: blob.type,
      });

      return {
        blob,
        filename,
        modelId,
        licenseId,
        expiresAt,
      };
    } catch (error: any) {
      console.error("VRMダウンロードエラー:", error);
      throw new Error(`VRMダウンロードエラー: ${error.message}`);
    }
  }

  /**
   * VRMファイルのダウンロードリンクを作成
   * @param blob - VRMファイルのBlob
   * @param filename - ファイル名
   * @returns ダウンロードURL
   */
  createDownloadUrl(blob: Blob, filename?: string): string {
    const url = URL.createObjectURL(blob);

    if (filename) {
      // ダウンロードリンクを自動的に作成
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      return url;
    }

    return url;
  }

  /**
   * ダウンロードURLのメモリを解放
   * @param url - 解放するURL
   */
  revokeDownloadUrl(url: string): void {
    URL.revokeObjectURL(url);
  }

  /**
   * VRMファイルを直接ダウンロードさせる
   * @param blob - VRMファイルのBlob
   * @param filename - ファイル名
   */
  triggerDownload(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = filename;
    link.target = "_blank";

    // DOM に一時的に追加してクリック
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // メモリ解放
    URL.revokeObjectURL(url);
  }
}
