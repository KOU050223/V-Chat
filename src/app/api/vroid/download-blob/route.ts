import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";

const VROID_API_BASE = "https://hub.vroid.com/api";

/**
 * VRMファイルをダウンロードし、BlobとしてJSON形式で返すAPIエンドポイント
 * クライアントサイドでBlobURLを作成するために使用
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.accessToken) {
      return NextResponse.json(
        { error: "VRoidアカウントが連携されていません" },
        { status: 401 }
      );
    }

    const { modelId } = await request.json();

    if (!modelId) {
      return NextResponse.json({ error: "modelIdが必要です" }, { status: 400 });
    }

    // Step 1: ダウンロードライセンスを取得
    const licenseResponse = await fetch(
      `${VROID_API_BASE}/character_models/${modelId}/download_license`,
      {
        headers: {
          Authorization: `Bearer ${session.accessToken}`,
          "Content-Type": "application/json",
          "X-Api-Version": "11",
        },
      }
    );

    if (!licenseResponse.ok) {
      const errorText = await licenseResponse.text();
      return NextResponse.json(
        {
          error: `ライセンス取得エラー: ${licenseResponse.status} - ${errorText}`,
        },
        { status: licenseResponse.status }
      );
    }

    const licenseData = await licenseResponse.json();

    if (!licenseData.data?.url) {
      return NextResponse.json(
        { error: "ダウンロードURLが取得できませんでした" },
        { status: 500 }
      );
    }

    // Step 2: VRMファイルをダウンロード
    const vrmResponse = await fetch(licenseData.data.url, {
      method: "GET",
    });

    if (!vrmResponse.ok) {
      return NextResponse.json(
        { error: `VRMダウンロードエラー: ${vrmResponse.status}` },
        { status: vrmResponse.status }
      );
    }

    // Step 3: VRMファイルをArrayBufferとして取得し、Base64エンコード
    const vrmArrayBuffer = await vrmResponse.arrayBuffer();
    const vrmBuffer = Buffer.from(vrmArrayBuffer);
    const vrmBase64 = vrmBuffer.toString("base64");

    // Step 4: レスポンスを返す（Base64エンコードされたデータとメタデータ）
    return NextResponse.json({
      success: true,
      data: {
        modelId,
        contentType: "application/octet-stream",
        size: vrmArrayBuffer.byteLength,
        base64Data: vrmBase64,
        expiresAt: licenseData.data.expires_at,
      },
    });
  } catch (error) {
    console.error("VRM Blob Download Error:", error);
    return NextResponse.json(
      { error: "VRMダウンロードに失敗しました" },
      { status: 500 }
    );
  }
}

/**
 * CORS preflight リクエストに対応
 */
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}
