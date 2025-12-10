import { NextRequest, NextResponse } from "next/server";
import { adminStorage, adminAuth } from "@/lib/firebase-admin";
import { sanitizeModelId } from "@/lib/modelIdUtils";

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

    // ファイルタイプの検証
    // VRMファイルは「application/octet-stream」または「model/gltf-binary」として送信される
    const allowedMimeTypes = [
      "application/octet-stream",
      "model/gltf-binary",
      "model/vrm",
    ];
    const hasValidMimeType = allowedMimeTypes.includes(file.type);
    const hasVrmExtension = file.name.toLowerCase().endsWith(".vrm");

    if (!hasValidMimeType && !hasVrmExtension) {
      return NextResponse.json(
        {
          error:
            "Invalid file type. Only VRM files are allowed. Expected MIME type: application/octet-stream, model/gltf-binary, or .vrm extension",
        },
        { status: 400 }
      );
    }

    // ファイルサイズの検証 (最大50MB)
    // VRMファイルは通常5-20MBだが、高品質モデルを考慮して50MBに設定
    const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB in bytes
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        {
          error: `File size exceeds the maximum allowed size of ${MAX_FILE_SIZE / 1024 / 1024}MB. Current size: ${(file.size / 1024 / 1024).toFixed(2)}MB`,
        },
        { status: 413 } // 413 Payload Too Large
      );
    }

    // 最小ファイルサイズの検証 (1KB以上)
    // 極端に小さいファイルは不正なファイルの可能性が高い
    const MIN_FILE_SIZE = 1024; // 1KB
    if (file.size < MIN_FILE_SIZE) {
      return NextResponse.json(
        {
          error: `File size is too small. Minimum size: ${MIN_FILE_SIZE / 1024}KB`,
        },
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

    // VRMファイルの構造検証（マジックバイトチェック）
    // VRMファイルはglTF 2.0バイナリ形式なので、先頭4バイトが "glTF" (0x676C5446)
    if (buffer.length >= 4) {
      const magicBytes = buffer.subarray(0, 4).toString("ascii");
      if (magicBytes !== "glTF") {
        return NextResponse.json(
          {
            error:
              "Invalid VRM file structure. File does not appear to be a valid glTF/VRM binary.",
          },
          { status: 400 }
        );
      }
    } else {
      return NextResponse.json(
        { error: "File is too small to be a valid VRM file" },
        { status: 400 }
      );
    }

    await storageFile.save(buffer, {
      contentType: "application/octet-stream",
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
