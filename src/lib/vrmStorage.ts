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
    console.log(`Getting Signed URL for VRM upload: ${modelId}`);

    // 1. 署名付きURLの取得
    const signedUrlRes = await fetch("/api/storage/upload", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        modelId,
        contentType: blob.type || "application/octet-stream",
      }),
    });

    if (!signedUrlRes.ok) {
      let errorMessage = signedUrlRes.statusText;
      try {
        const errorData = await signedUrlRes.json();
        if (errorData.error) {
          errorMessage = errorData.error;
        }
      } catch {
        // JSON parse failed
      }
      throw new Error(
        `Failed to get upload URL: ${signedUrlRes.status} ${errorMessage}`
      );
    }

    const data: unknown = await signedUrlRes.json();

    // Validate response shape
    if (
      !data ||
      typeof data !== "object" ||
      !("uploadUrl" in data) ||
      typeof (data as { uploadUrl: unknown }).uploadUrl !== "string" ||
      !("uploadedAt" in data) ||
      typeof (data as { uploadedAt: unknown }).uploadedAt !== "string"
    ) {
      throw new Error(
        "Invalid response from upload API: missing uploadUrl or uploadedAt"
      );
    }

    const { uploadUrl, uploadedAt } = data as {
      uploadUrl: string;
      uploadedAt: string;
    };

    // 2. Storageへ直接アップロード (PUT)
    console.log(`Uploading VRM to Storage (via Signed URL): ${modelId}`);

    const uploadRes = await fetch(uploadUrl, {
      method: "PUT",
      headers: {
        "Content-Type": blob.type || "application/octet-stream",
        "x-goog-meta-modelId": modelId,
        "x-goog-meta-uploadedAt": uploadedAt,
      },
      body: blob,
    });

    if (!uploadRes.ok) {
      let errorDetails = uploadRes.statusText;
      try {
        // レスポンスボディがある場合のみ読み取る
        const responseText = await uploadRes.text();
        if (responseText) {
          errorDetails = responseText;
        }
      } catch {
        // レスポンスボディの読み取りに失敗した場合はstatusTextを使用 (何もしない)
      }
      throw new Error(
        `Failed to upload to Storage: ${uploadRes.status} ${errorDetails}`
      );
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
 * downloadFnがnullを返した場合は、nullを返す（フォールバック処理は呼び出し側で行う）
 */
export async function ensureVRMInStorage(
  modelId: string,
  downloadFn: () => Promise<Blob | null>,
  token: string
): Promise<string | null> {
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

  let blob: Blob | null;
  try {
    blob = await downloadFn();
    if (!blob) {
      console.warn(
        `Download function returned null for modelId=${modelId}. Skipping storage upload.`
      );
      return null;
    }
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
