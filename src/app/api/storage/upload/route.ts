import { NextRequest, NextResponse } from "next/server";
import { adminStorage, adminAuth } from "@/lib/firebase-admin";

/**
 * modelIdをサニタイズ・バリデーション
 * パストラバーサル攻撃を防ぐため、安全な文字のみを許可
 */
function sanitizeModelId(modelId: string): string | null {
  // 英数字、ハイフン、アンダースコアのみを許可
  const safePattern = /^[A-Za-z0-9_-]+$/;
  if (!safePattern.test(modelId)) {
    return null;
  }
  // 追加の安全策: 長さ制限（VRoid Hub のモデルIDは通常この範囲内）
  if (modelId.length > 100) {
    return null;
  }
  return modelId;
}

export async function POST(request: NextRequest) {
  try {
    // 1. 環境変数の検証
    const bucketName = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
    if (!bucketName) {
      console.error(
        "Configuration Error: NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET is missing"
      );
      return NextResponse.json(
        { error: "Server configuration error" },
        { status: 500 }
      );
    }

    // 2. 認証ガード (Authorization Header)
    const authHeader = request.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "Unauthorized: Missing or invalid token" },
        { status: 401 }
      );
    }
    const idToken = authHeader.split("Bearer ")[1];

    // トークン検証
    try {
      await adminAuth.verifyIdToken(idToken);
      // 必要であればuidを確認: const decodedToken = ...; console.log(decodedToken.uid);
    } catch (authError) {
      console.error("Auth Error:", authError);
      return NextResponse.json(
        { error: "Unauthorized: Invalid token" },
        { status: 401 }
      );
    }

    // 3. 入力データの検証
    const formData = await request.formData();
    const rawModelId = formData.get("modelId");
    const file = formData.get("file");

    if (!rawModelId || typeof rawModelId !== "string") {
      return NextResponse.json(
        { error: "Validation Error: modelId is required and must be a string" },
        { status: 400 }
      );
    }

    // modelIdのサニタイズとバリデーション
    const modelId = sanitizeModelId(rawModelId);
    if (!modelId) {
      return NextResponse.json(
        {
          error:
            "Invalid modelId format. Only alphanumeric characters, hyphens, and underscores are allowed.",
        },
        { status: 400 }
      );
    }

    // File型かどうかを確認 (Next.js/Web standard File interface)
    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { error: "Validation Error: file is required" },
        { status: 400 }
      );
    }

    // 4. ファイルアップロード処理
    const bucket = adminStorage.bucket(bucketName);
    const storageFile = bucket.file(`avatars/${modelId}.vrm`);

    // 重複チェック (必要であれば有効化、現在は上書き)
    // const [exists] = await storageFile.exists();
    // if (exists) { ... }

    const buffer = Buffer.from(await file.arrayBuffer());

    await storageFile.save(buffer, {
      contentType: file.type || "application/octet-stream", // 実際のMIME typeを使用
      metadata: {
        customMetadata: {
          modelId: modelId,
          uploadedAt: new Date().toISOString(),
          originalName: file.name,
        },
      },
    });

    console.log(`Successfully uploaded VRM to storage: ${modelId}`);

    return NextResponse.json({ success: true, modelId });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Storage Upload Error:", error);

    // エラー詳細を返すかどうかはセキュリティ要件によるが、ここでは簡易化
    return NextResponse.json(
      {
        error: "Internal Server Error",
        details: process.env.NODE_ENV === "development" ? message : undefined,
      },
      { status: 500 }
    );
  }
}
