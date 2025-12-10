import { NextRequest, NextResponse } from "next/server";
import { adminStorage } from "@/lib/firebase-admin";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const modelId = searchParams.get("modelId");

    if (!modelId) {
      return NextResponse.json(
        { error: "modelId is required" },
        { status: 400 }
      );
    }

    // 認証ガードなどはこのルートには（通常）不要だが、必要に応じて追加

    // 環境変数の取得（サーバーサイド専用変数を優先し、なければパブリック変数を使用）
    const bucketName =
      process.env.FIREBASE_STORAGE_BUCKET ||
      process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
    if (!bucketName) {
      console.error("Configuration Error: FIREBASE_STORAGE_BUCKET is not set");
      return NextResponse.json(
        { error: "Server configuration error" },
        { status: 500 }
      );
    }

    const bucket = adminStorage.bucket(bucketName);
    const file = bucket.file(`avatars/${modelId}.vrm`);

    const [exists] = await file.exists();
    if (!exists) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    const [metadata] = await file.getMetadata();
    const contentType = metadata.contentType || "application/octet-stream";
    const size = metadata.size;

    // ストリームとしてファイルを取得
    const stream = file.createReadStream();

    // Node.js ReadableStreamをWeb ReadableStreamに変換
    const webStream = new ReadableStream({
      start(controller) {
        stream.on("data", (chunk: Buffer) => {
          controller.enqueue(chunk);
        });
        stream.on("end", () => {
          controller.close();
        });
        stream.on("error", (err: Error) => {
          controller.error(err);
        });
      },
    });

    // レスポンス作成
    const response = new NextResponse(webStream);
    response.headers.set("Content-Type", contentType);
    if (size) {
      response.headers.set("Content-Length", size.toString());
    }
    response.headers.set(
      "Content-Disposition",
      `attachment; filename="${modelId}.vrm"`
    );

    // CORSヘッダー
    response.headers.set("Access-Control-Allow-Origin", "*");
    response.headers.set("Access-Control-Allow-Methods", "GET, OPTIONS");

    // キャッシュ制御 (1時間)
    response.headers.set("Cache-Control", "public, max-age=3600");

    return response;
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Storage Proxy Error:", error);
    return NextResponse.json(
      { error: "Internal Server Error", details: errorMessage },
      { status: 500 }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}
