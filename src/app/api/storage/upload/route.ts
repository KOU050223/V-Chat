import { NextRequest, NextResponse } from "next/server";
import { adminStorage, adminAuth } from "@/lib/firebase-admin";
import { sanitizeModelId } from "@/lib/modelIdUtils";

const ALLOWED_MIME_TYPES = [
  "application/octet-stream",
  "model/gltf-binary",
  "model/vrm",
];

const UPLOAD_URL_TTL_MS = 15 * 60 * 1000; // 15 minutes

interface UploadRequestBody {
  modelId?: string;
  contentType?: string;
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
    } catch (authError) {
      console.error("Auth Error:", authError);
      return NextResponse.json(
        { error: "Unauthorized: Invalid token" },
        { status: 401 }
      );
    }

    // 3. 入力データの検証 (JSON Body)
    let body: UploadRequestBody;
    try {
      body = await request.json();
    } catch (e) {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const { modelId: rawModelId, contentType } = body;

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

    // コンテンツタイプの検証
    if (!contentType || !ALLOWED_MIME_TYPES.includes(contentType)) {
      return NextResponse.json(
        {
          error:
            "Invalid content type. Expected: application/octet-stream, model/gltf-binary, or model/vrm",
        },
        { status: 400 }
      );
    }

    // 4. Signed URLの生成
    const bucket = adminStorage.bucket(bucketName);
    const storageFile = bucket.file(`avatars/${modelId}.vrm`);

    const expires = Date.now() + UPLOAD_URL_TTL_MS;

    const uploadedAt = new Date().toISOString();

    const [uploadUrl] = await storageFile.getSignedUrl({
      action: "write",
      expires,
      contentType, // クライアントがアップロード時にこのContent-Typeを指定する必要がある
      extensionHeaders: {
        "x-goog-meta-modelId": modelId,
        "x-goog-meta-uploadedAt": uploadedAt,
      },
    });

    console.log(`Generated Signed URL for VRM upload: ${modelId}`);

    return NextResponse.json({ success: true, uploadUrl, modelId, uploadedAt });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Signed URL Generation Error:", error);

    return NextResponse.json(
      {
        error: "Internal Server Error",
        details: process.env.NODE_ENV === "development" ? message : undefined,
      },
      { status: 500 }
    );
  }
}
