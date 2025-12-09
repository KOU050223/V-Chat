/**
 * ブックマークAPI
 * GET /api/bookmark - ブックマーク一覧取得
 * POST /api/bookmark - ブックマーク追加
 * DELETE /api/bookmark - ブックマーク削除
 */

import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth-helpers";
import { getAdminFirestore } from "@/lib/firebase-admin";
import { Timestamp } from "firebase-admin/firestore";
import { BulletinApiResponse, BulletinPost } from "@/types/bulletin";

// GET: ブックマーク一覧取得
export async function GET(request: NextRequest) {
  try {
    console.log("ブックマーク一覧取得API: リクエスト受信");

    // 認証確認
    const authResult = await authenticateRequest(request);
    console.log("認証結果:", {
      authenticated: authResult.authenticated,
      userId: authResult.userId,
      error: authResult.error,
    });

    if (!authResult.authenticated || !authResult.userId) {
      const response: BulletinApiResponse = {
        success: false,
        error: authResult.error || "認証が必要です",
      };
      return NextResponse.json(response, { status: 401 });
    }
    const userId = authResult.userId;

    const db = getAdminFirestore();

    console.log("Firestoreからブックマーク取得開始:", userId);

    // ユーザーのブックマーク取得
    // 注: orderByを使うにはFirestoreインデックスが必要
    // インデックスがデプロイされるまで、クライアント側でソート
    const bookmarksSnapshot = await db
      .collection("user_bookmarks")
      .where("userId", "==", userId)
      .get();

    console.log("ブックマーク件数:", bookmarksSnapshot.size);

    if (bookmarksSnapshot.empty) {
      const response: BulletinApiResponse<BulletinPost[]> = {
        success: true,
        data: [],
      };
      return NextResponse.json(response);
    }

    // ブックマークされた投稿IDを取得（createdAtでソート）
    const bookmarks = bookmarksSnapshot.docs
      .map((doc) => ({
        postId: doc.data().postId,
        createdAt: doc.data().createdAt?.toDate() || new Date(0),
      }))
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    const postIds = bookmarks.map((bookmark) => bookmark.postId);

    // 投稿情報をバッチ取得（N+1クエリ問題の解決）
    const postRefs = postIds.map((id) =>
      db.collection("bulletin_posts").doc(id)
    );
    const postDocs = await db.getAll(...postRefs);

    const posts = postDocs
      .filter((doc) => doc.exists)
      .map((doc) => {
        const data = doc.data()!;
        return {
          id: doc.id,
          title: data.title,
          content: data.content,
          category: data.category,
          maxParticipants: data.maxParticipants,
          currentParticipants: data.currentParticipants,
          authorId: data.authorId,
          authorName: data.authorName,
          authorPhoto: data.authorPhoto,
          likes: data.likes || [],
          tags: data.tags || [],
          roomId: data.roomId,
          isBookmarked: true,
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date(),
        };
      });

    // ブックマーク順序を維持（getAll は順序を保証しないため）
    const postsMap = new Map(posts.map((p) => [p.id, p]));
    const orderedPosts: BulletinPost[] = postIds
      .map((id) => postsMap.get(id))
      .filter((p) => p !== undefined) as BulletinPost[];

    const response: BulletinApiResponse<BulletinPost[]> = {
      success: true,
      data: orderedPosts,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("ブックマーク一覧取得エラー:", error);
    console.error(
      "エラー詳細:",
      error instanceof Error ? error.message : String(error)
    );
    console.error("エラースタック:", error instanceof Error ? error.stack : "");

    const response: BulletinApiResponse = {
      success: false,
      error:
        error instanceof Error
          ? `ブックマーク一覧の取得に失敗しました: ${error.message}`
          : "ブックマーク一覧の取得に失敗しました",
    };
    return NextResponse.json(response, { status: 500 });
  }
}

// POST: ブックマーク追加
export async function POST(request: NextRequest) {
  try {
    // 認証確認
    const authResult = await authenticateRequest(request);
    if (!authResult.authenticated || !authResult.userId) {
      const response: BulletinApiResponse = {
        success: false,
        error: authResult.error || "認証が必要です",
      };
      return NextResponse.json(response, { status: 401 });
    }
    const userId = authResult.userId;

    const { postId } = await request.json();

    if (!postId) {
      const response: BulletinApiResponse = {
        success: false,
        error: "投稿IDが必要です",
      };
      return NextResponse.json(response, { status: 400 });
    }

    const db = getAdminFirestore();

    // 投稿が存在するか確認
    const postDoc = await db.collection("bulletin_posts").doc(postId).get();
    if (!postDoc.exists) {
      const response: BulletinApiResponse = {
        success: false,
        error: "投稿が見つかりません",
      };
      return NextResponse.json(response, { status: 404 });
    }

    // ブックマークの複合キー
    const bookmarkId = `${userId}__${postId}`;

    // 既にブックマークされているか確認
    const bookmarkDoc = await db
      .collection("user_bookmarks")
      .doc(bookmarkId)
      .get();

    if (bookmarkDoc.exists) {
      const response: BulletinApiResponse = {
        success: false,
        error: "既にブックマーク済みです",
      };
      return NextResponse.json(response, { status: 400 });
    }

    // ブックマーク追加
    await db.collection("user_bookmarks").doc(bookmarkId).set({
      userId,
      postId,
      createdAt: Timestamp.now(),
    });

    const response: BulletinApiResponse = {
      success: true,
      message: "ブックマークに追加しました",
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("ブックマーク追加エラー:", error);
    const response: BulletinApiResponse = {
      success: false,
      error: "ブックマークの追加に失敗しました",
    };
    return NextResponse.json(response, { status: 500 });
  }
}

// DELETE: ブックマーク削除
export async function DELETE(request: NextRequest) {
  try {
    // 認証確認
    const authResult = await authenticateRequest(request);
    if (!authResult.authenticated || !authResult.userId) {
      const response: BulletinApiResponse = {
        success: false,
        error: authResult.error || "認証が必要です",
      };
      return NextResponse.json(response, { status: 401 });
    }
    const userId = authResult.userId;

    const searchParams = request.nextUrl.searchParams;
    const postId = searchParams.get("postId");

    if (!postId) {
      const response: BulletinApiResponse = {
        success: false,
        error: "投稿IDが必要です",
      };
      return NextResponse.json(response, { status: 400 });
    }

    const db = getAdminFirestore();

    // ブックマークの複合キー
    const bookmarkId = `${userId}__${postId}`;

    // ブックマーク削除
    await db.collection("user_bookmarks").doc(bookmarkId).delete();

    const response: BulletinApiResponse = {
      success: true,
      message: "ブックマークから削除しました",
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("ブックマーク削除エラー:", error);
    const response: BulletinApiResponse = {
      success: false,
      error: "ブックマークの削除に失敗しました",
    };
    return NextResponse.json(response, { status: 500 });
  }
}
