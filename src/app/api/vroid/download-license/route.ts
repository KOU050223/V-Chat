import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    console.log("=== Download License API Called ===");
    const session = await getServerSession(authOptions);

    console.log("Session check:", {
      hasSession: !!session,
      hasAccessToken: !!session?.accessToken,
      provider: session?.provider,
    });

    if (!session || !session.accessToken) {
      console.log("Authentication failed - no session or access token");
      return NextResponse.json(
        { error: "VRoid Hub認証が必要です" },
        { status: 401 }
      );
    }

    const body = await request.json();
    console.log("Request body:", body);

    const { model_id } = body;

    if (!model_id) {
      console.log("Missing model_id in request");
      return NextResponse.json(
        { error: "model_idが必要です" },
        { status: 400 }
      );
    }

    console.log("Download license request for model:", model_id);

    // 正しいVRoid Hub APIエンドポイント（公式ドキュメント準拠）
    const apiUrl = "https://hub.vroid.com/api/download_licenses";

    // VRoid API呼び出し関数（リトライ機能付き）
    const callVRoidAPI = async (accessToken: string) => {
      return await fetch(apiUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
          "X-Api-Version": "11", // 必須ヘッダー
          "User-Agent": "V-Chat/1.0",
        },
        body: JSON.stringify({
          character_model_id: model_id,
        }),
      });
    };

    try {
      let response = await callVRoidAPI(session.accessToken!);

      console.log("VRoid API Response:", {
        status: response.status,
        statusText: response.statusText,
        url: apiUrl,
      });

      // 401エラーの場合、トークンをリフレッシュして再試行
      if (response.status === 401 && session.refreshToken) {
        console.log("Access token expired, attempting to refresh...");

        try {
          const refreshResponse = await fetch(
            "https://hub.vroid.com/oauth/token",
            {
              method: "POST",
              headers: {
                "Content-Type": "application/x-www-form-urlencoded",
              },
              body: new URLSearchParams({
                grant_type: "refresh_token",
                refresh_token: session.refreshToken,
                client_id: process.env.VROID_CLIENT_ID!,
                client_secret: process.env.VROID_CLIENT_SECRET!,
              }),
            }
          );

          if (refreshResponse.ok) {
            const refreshedTokens = await refreshResponse.json();
            console.log("Token refreshed successfully, retrying API call");

            // 新しいアクセストークンで再試行
            response = await callVRoidAPI(refreshedTokens.access_token);

            console.log("Retry API Response:", {
              status: response.status,
              statusText: response.statusText,
            });
          } else {
            console.error(
              "Token refresh failed:",
              refreshResponse.status,
              refreshResponse.statusText
            );
          }
        } catch (refreshError) {
          console.error("Token refresh error:", refreshError);
        }
      }

      if (!response.ok) {
        const errorData = await response
          .json()
          .catch(() => ({ error: "Unknown error" }));
        console.error("VRoid API Error Response:", errorData);

        if (response.status === 401) {
          return NextResponse.json(
            { error: "VRoid Hub認証が期限切れです。再ログインしてください。" },
            { status: 401 }
          );
        }

        if (response.status === 403) {
          return NextResponse.json(
            {
              error:
                "このモデルのダウンロード権限がありません。いいねしたモデルのみダウンロード可能です。",
            },
            { status: 403 }
          );
        }

        return NextResponse.json(
          {
            error: `VRoid API エラー: ${response.status} ${response.statusText}`,
          },
          { status: response.status }
        );
      }

      const licenseData = await response.json();

      console.log("Download license response:", {
        modelId: model_id,
        hasData: !!licenseData.data,
        hasUrl:
          !!(licenseData.data as any)?.url ||
          !!(licenseData.data as any)?.download_url,
        hasId: !!(licenseData.data as any)?.id,
      });

      // レスポンスデータの構造を確認
      const license = licenseData.data as any;

      if (license?.download_url || license?.url) {
        // 直接ダウンロードURLが利用可能な場合
        const downloadUrl = license.download_url || license.url;
        return NextResponse.json({
          success: true,
          url: downloadUrl,
          license_id: license.id,
          expires_at: license.expires_at,
        });
      } else if (license?.id) {
        // ライセンスIDのみの場合はプロキシ経由のURLを生成
        const proxyUrl = `/api/vroid/download-vrm?license_id=${license.id}&model_id=${model_id}`;
        return NextResponse.json({
          success: true,
          url: proxyUrl,
          license_id: license.id,
          expires_at: license.expires_at,
          proxy: true,
        });
      } else {
        console.error("Unexpected license response structure:", license);
        return NextResponse.json(
          { error: "ダウンロードライセンスの取得に失敗しました" },
          { status: 500 }
        );
      }
    } catch (apiError: any) {
      console.error("VRoid API error:", apiError);

      return NextResponse.json(
        { error: `VRoid API エラー: ${apiError.message}` },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error("Download license endpoint error:", error);
    return NextResponse.json(
      { error: "サーバーエラーが発生しました" },
      { status: 500 }
    );
  }
}
