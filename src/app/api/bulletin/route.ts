/**
 * 掲示板API - 投稿一覧取得・作成
 * GET /api/bulletin - 投稿一覧取得
 * POST /api/bulletin - 投稿作成
 */

import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth-helpers";
import { getAdminFirestore } from "@/lib/firebase-admin";
import { Timestamp } from "firebase-admin/firestore";
import {
  BulletinApiResponse,
  BulletinPost,
  CreatePostRequest,
  PostCategory,
  SortOrder,
} from "@/types/bulletin";

// GET: 投稿一覧取得
export async function GET(request: NextRequest) {
  try {
    const db = getAdminFirestore();

    // 認証確認（オプショナル - ログインしていなくても投稿は見られる）
    const authResult = await authenticateRequest(request);
    const userId = authResult.userId;

    const searchParams = request.nextUrl.searchParams;
    const categoriesParam = searchParams.get("categories");
    const search = searchParams.get("search");
    const sortOrder = (searchParams.get("sortOrder") as SortOrder) || "newest";
    const limit = parseInt(searchParams.get("limit") || "20", 10);
    const lastDocId = searchParams.get("lastDocId");

    const postsRef = db.collection("bulletin_posts");

    // ソートのみFirestoreで実行（カテゴリフィルターはクライアント側で実行）
    let q: FirebaseFirestore.Query = postsRef;
    switch (sortOrder) {
      case "popular":
        q = q.orderBy("likesCount", "desc");
        break;
      case "participants":
        q = q.orderBy("currentParticipants", "asc");
        break;
      case "newest":
      default:
        q = q.orderBy("createdAt", "desc");
        break;
    }

    // ページネーション: カーソルベース
    if (lastDocId) {
      const lastDoc = await postsRef.doc(lastDocId).get();
      if (lastDoc.exists) {
        q = q.startAfter(lastDoc);
      }
    }

    // limit を適用
    q = q.limit(limit);

    const querySnapshot = await q.get();

    // ユーザーのブックマークを取得（ログインしている場合のみ）
    let bookmarkedPostIds: Set<string> = new Set();
    if (userId) {
      const bookmarksSnapshot = await db
        .collection("user_bookmarks")
        .where("userId", "==", userId)
        .get();
      bookmarkedPostIds = new Set(
        bookmarksSnapshot.docs.map((doc) => doc.data().postId)
      );
    }

    // 返信数を取得
    const postIds = querySnapshot.docs.map((doc) => doc.id);
    const replyCountsMap = new Map<string, number>();

    if (postIds.length > 0) {
      // 各投稿の返信数を並列で取得
      const replyCountPromises = postIds.map(async (postId) => {
        const repliesSnapshot = await db
          .collection("bulletin_replies")
          .where("postId", "==", postId)
          .count()
          .get();
        return { postId, count: repliesSnapshot.data().count };
      });

      const replyCounts = await Promise.all(replyCountPromises);
      replyCounts.forEach(({ postId, count }) => {
        replyCountsMap.set(postId, count);
      });
    }

    let posts: BulletinPost[] = querySnapshot.docs.map((doc) => {
      const data = doc.data();
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
        replyCount: replyCountsMap.get(doc.id) || 0,
        isBookmarked: bookmarkedPostIds.has(doc.id),
        createdAt: data.createdAt?.toDate() || new Date(),
        updatedAt: data.updatedAt?.toDate() || new Date(),
      };
    });

    // カテゴリフィルター（クライアント側で実行）
    if (categoriesParam) {
      const categories = categoriesParam.split(",").filter((c) => c.trim());
      if (categories.length > 0) {
        posts = posts.filter(
          (post) =>
            categories.includes(post.category) ||
            post.tags?.some((tag) => categories.includes(tag))
        );
      }
    }

    // 検索フィルター（クライアント側で実行）
    if (search) {
      const searchLower = search.toLowerCase();
      posts = posts.filter(
        (post) =>
          post.title.toLowerCase().includes(searchLower) ||
          post.content.toLowerCase().includes(searchLower) ||
          post.tags?.some((tag) => tag.toLowerCase().includes(searchLower))
      );
    }

    // 次のページがあるかチェック
    const hasMore = querySnapshot.docs.length === limit;
    const lastDoc = querySnapshot.docs[querySnapshot.docs.length - 1];

    const response: BulletinApiResponse<BulletinPost[]> = {
      success: true,
      data: posts,
      message: hasMore ? lastDoc?.id : undefined, // lastDocIdをmessageに格納
    };

    // hasMoreをヘッダーに追加
    return NextResponse.json(response, {
      headers: {
        "X-Has-More": hasMore.toString(),
        "X-Last-Doc-Id": lastDoc?.id || "",
      },
    });
  } catch (error) {
    console.error("投稿一覧取得エラー:", error);
    const response: BulletinApiResponse = {
      success: false,
      error: "投稿一覧の取得に失敗しました",
    };
    return NextResponse.json(response, { status: 500 });
  }
}

// POST: 投稿作成
export async function POST(request: NextRequest) {
  try {
    // 認証確認（NextAuth または Firebase ID トークン）
    const authResult = await authenticateRequest(request);
    if (!authResult.authenticated || !authResult.userId) {
      const response: BulletinApiResponse = {
        success: false,
        error: authResult.error || "認証が必要です",
      };
      return NextResponse.json(response, { status: 401 });
    }
    const userId = authResult.userId;

    const db = getAdminFirestore();
    const body: CreatePostRequest = await request.json();

    // バリデーション
    if (!body.title || body.title.trim().length === 0) {
      const response: BulletinApiResponse = {
        success: false,
        error: "タイトルは必須です",
      };
      return NextResponse.json(response, { status: 400 });
    }

    if (!body.content || body.content.trim().length === 0) {
      const response: BulletinApiResponse = {
        success: false,
        error: "本文は必須です",
      };
      return NextResponse.json(response, { status: 400 });
    }

    if (body.maxParticipants < 1 || body.maxParticipants > 10) {
      const response: BulletinApiResponse = {
        success: false,
        error: "募集人数は1〜10人の範囲で指定してください",
      };
      return NextResponse.json(response, { status: 400 });
    }

    // ユーザー情報（リクエストボディから取得、userId は検証済み）
    const userName = body.userName || "ゲストユーザー";
    const userPhoto = body.userPhoto;

    // Firestoreに保存するデータ
    const postData: Record<string, unknown> = {
      title: body.title.trim(),
      content: body.content.trim(),
      category: body.category,
      maxParticipants: body.maxParticipants,
      currentParticipants: 0,
      authorId: userId,
      authorName: userName,
      likes: [],
      likesCount: 0,
      tags: body.tags || [],
      roomId: null,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    };

    // authorPhotoが存在する場合のみ追加
    if (userPhoto) {
      postData.authorPhoto = userPhoto;
    }

    // Firestoreに保存
    const docRef = await db.collection("bulletin_posts").add(postData);
    console.log("投稿をFirestoreに保存しました:", docRef.id);

    const createdPost: BulletinPost = {
      id: docRef.id,
      title: postData.title as string,
      content: postData.content as string,
      category: postData.category as PostCategory,
      maxParticipants: postData.maxParticipants as number,
      currentParticipants: postData.currentParticipants as number,
      authorId: postData.authorId as string,
      authorName: postData.authorName as string,
      authorPhoto: postData.authorPhoto as string | undefined,
      likes: postData.likes as string[],
      tags: postData.tags as string[],
      roomId: postData.roomId as string | undefined,
      createdAt:
        postData.createdAt instanceof Timestamp
          ? postData.createdAt.toDate()
          : new Date(),
      updatedAt:
        postData.updatedAt instanceof Timestamp
          ? postData.updatedAt.toDate()
          : new Date(),
    };

    const response: BulletinApiResponse<BulletinPost> = {
      success: true,
      data: createdPost,
      message: "投稿を作成しました",
    };

    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    console.error("投稿作成エラー:", error);
    console.error(
      "エラー詳細:",
      error instanceof Error ? error.message : String(error)
    );
    const response: BulletinApiResponse = {
      success: false,
      error:
        error instanceof Error ? error.message : "投稿の作成に失敗しました",
    };
    return NextResponse.json(response, { status: 500 });
  }
}
