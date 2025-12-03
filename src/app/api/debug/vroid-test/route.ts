import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";

const VROID_API_BASE = "https://hub.vroid.com/api";

/**
 * VRoid API接続テスト用エンドポイント
 * 開発環境でのみ利用可能
 */
export async function GET(request: NextRequest) {
  // 本番環境では無効化
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json(
      { error: "Debug endpoint is not available in production" },
      { status: 404 }
    );
  }

  try {
    const session = await getServerSession(authOptions);

    console.log("=== VRoid API Test ===");
    console.log("Session check:", {
      hasSession: !!session,
      hasAccessToken: !!session?.accessToken,
      provider: session?.provider,
      tokenLength: session?.accessToken?.length,
      hasVroidProfile: !!session?.vroidProfile,
      hasVroidData: !!session?.vroidData,
      userName: session?.user?.name,
      userEmail: session?.user?.email,
    });

    if (!session?.accessToken) {
      const result = {
        error: "No access token available",
        hasSession: !!session,
        provider: session?.provider,
        sessionInfo: {
          user: session?.user,
          vroidProfile: session?.vroidProfile,
          vroidData: session?.vroidData,
        },
        suggestion:
          "VRoid認証が完了していないか、セッションが期限切れです。再ログインが必要です。",
      };
      console.log("Result:", result);
      return NextResponse.json(result, { status: 401 });
    }

    // VRoid APIのユーザー情報取得をテスト
    console.log("Testing VRoid API /account endpoint...");
    const vroidResponse = await fetch(`${VROID_API_BASE}/account`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${session.accessToken}`,
        "Content-Type": "application/json",
        "X-Api-Version": "11",
      },
    });

    console.log("VRoid API Response:", {
      status: vroidResponse.status,
      statusText: vroidResponse.statusText,
      headers: Object.fromEntries(vroidResponse.headers.entries()),
    });

    const result: any = {
      sessionOk: true,
      vroidApiStatus: vroidResponse.status,
      vroidApiStatusText: vroidResponse.statusText,
    };

    if (vroidResponse.ok) {
      const userData = await vroidResponse.json();
      console.log(
        "VRoid API Success - User data received:",
        JSON.stringify(userData, null, 2)
      );
      result.success = true;
      result.userData = userData;
      result.sessionData = {
        vroidProfile: session.vroidProfile,
        vroidData: session.vroidData,
        user: session.user,
        // 抽出情報の詳細
        extractionDetails: {
          hasExtractedInfo: !!(session.vroidProfile as any)?.extractedInfo,
          extractedInfo: (session.vroidProfile as any)?.extractedInfo,
          actualUser: (session.vroidProfile as any)?.actualUser,
          dataStructureAnalysis: (session.vroidProfile as any)?.extractedInfo
            ?.dataStructure,
        },
      };
    } else {
      const errorText = await vroidResponse.text();
      console.log("VRoid API Error:", errorText);

      let parsedError;
      try {
        parsedError = JSON.parse(errorText);
      } catch {
        parsedError = { message: errorText };
      }

      result.error = parsedError;
      result.suggestion = getErrorSuggestion(vroidResponse.status, parsedError);
    }

    console.log("Test result:", result);
    console.log("===================");

    return NextResponse.json(result);
  } catch (error) {
    console.error("VRoid API test error:", error);
    return NextResponse.json(
      {
        error: "Test failed",
        details: error instanceof Error ? error.message : "Unknown error",
        suggestion:
          "サーバーエラーが発生しました。コンソールログを確認してください。",
      },
      { status: 500 }
    );
  }
}

function getErrorSuggestion(status: number, error: any): string {
  switch (status) {
    case 401:
      return "アクセストークンが無効です。VRoid Hubで再認証が必要です。";
    case 403:
      if (error.error?.code === "OAUTH_FORBIDDEN") {
        return "OAuth設定エラー: VRoid Hub Developer Consoleでリダイレクトuriまたはスコープを確認してください。";
      }
      return "アクセス権限がありません。VRoid Hubアプリケーション設定を確認してください。";
    case 429:
      return "API制限に達しました。しばらく待ってから再試行してください。";
    case 500:
      return "VRoid Hub APIサーバーエラーです。しばらく待ってから再試行してください。";
    default:
      return `HTTP ${status} エラーが発生しました。VRoid Hub APIの状態を確認してください。`;
  }
}
