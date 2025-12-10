/**
 * Storage上のVRMのダウンロードURLを取得する
 * プロキシAPI経由で存在確認を行い、存在すればプロキシURLを返す
 */
export async function getVRMStorageUrl(
  modelId: string
): Promise<string | null> {
  try {
    const encodedId = encodeURIComponent(modelId);
    const proxyUrl = `/api/storage/proxy?modelId=${encodedId}`;
    // HEADリクエストで存在確認
    const res = await fetch(proxyUrl, { method: "HEAD" });
    if (res.ok) {
      return proxyUrl;
    }
    return null;
  } catch (error) {
    console.warn("Failed to check VRM storage URL:", error);
    return null;
  }
}

/**
 * VRMファイルをStorageにアップロードし、ダウンロードURLを返す
 * サーバーサイドAPI経由でアップロードを行う
 */
export async function uploadVRMToStorage(
  modelId: string,
  blob: Blob,
  token: string
): Promise<string> {
  try {
    const formData = new FormData();
    formData.append("modelId", modelId);
    formData.append("file", blob, `${modelId}.vrm`);

    console.log(`Uploading VRM to Storage (via Server): ${modelId}`);

    const res = await fetch("/api/storage/upload", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    });

    if (!res.ok) {
      let errorMessage = res.statusText;
      try {
        const errorData = await res.json();
        if (errorData.error) {
          errorMessage = errorData.error;
        }
      } catch {
        // JSON parse failed, use statusText
      }
      throw new Error(`Failed to upload VRM: ${res.status} ${errorMessage}`);
    }

    const encodedId = encodeURIComponent(modelId);
    const proxyUrl = `/api/storage/proxy?modelId=${encodedId}`;
    console.log(`VRM uploaded successfully. Proxy URL: ${proxyUrl}`);
    return proxyUrl;
  } catch (error: unknown) {
    console.error("Storage upload error:", error);
    if (error instanceof Error) {
      throw error;
    }
    throw new Error("Unknown storage upload error");
  }
}

/**
 * VRMがStorageにあるか確認し、なければダウンロード関数を実行してアップロードする
 * 最終的にStorageのURLを返す
 */
export async function ensureVRMInStorage(
  modelId: string,
  downloadFn: () => Promise<Blob>,
  token: string
): Promise<string> {
  // 1. まずStorageを確認
  const existingUrl = await getVRMStorageUrl(modelId);
  if (existingUrl) {
    console.log(`VRM found in Storage, using cached URL: ${modelId}`);
    return existingUrl;
  }

  // 2. なければダウンロード
  console.log(
    `VRM not found in Storage, downloading from source...: ${modelId}`
  );

  let blob: Blob;
  try {
    blob = await downloadFn();
  } catch (error: unknown) {
    console.error(`Failed to download VRM for modelId=${modelId}`, error);
    throw new Error(
      `Failed to download VRM for modelId=${modelId}: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }

  // 3. Storageにアップロード
  return await uploadVRMToStorage(modelId, blob, token);
}
