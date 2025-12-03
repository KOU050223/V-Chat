/**
 * 返信編集・削除API
 */

import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth-helpers";
import { adminDb } from "@/lib/firebase-admin";
import { BulletinApiResponse } from "@/types/bulletin";

export async function PATCH(
  request: NextRequest,
  props: { params: Promise<{ postId: string; replyId: string }> }
) {
  try {
    // 認証確認（NextAuth または Firebase ID トークン）
    const authResult = await authenticateRequest(request);
    if (!authResult.authenticated || !authResult.userId) {
      return NextResponse.json(
        { success: false, error: authResult.error || "認証が必要です" },
        { status: 401 }
      );
    }
    const userId = authResult.userId;

    const params = await props.params;
    const { postId, replyId } = params;

    // 返信の存在確認と権限チェック
    const replyRef = adminDb.collection("bulletin_replies").doc(replyId);

    const replyDoc = await replyRef.get();

    if (!replyDoc.exists) {
      return NextResponse.json(
        { success: false, error: "返信が見つかりません" },
        { status: 404 }
      );
    }

    const reply = replyDoc.data();

    // 返信が指定された投稿に属しているか確認
    if (reply?.postId !== postId) {
      return NextResponse.json(
        { success: false, error: "返信が見つかりません" },
        { status: 404 }
      );
    }

    // 作者確認
    if (reply?.authorId !== userId) {
      return NextResponse.json(
        { success: false, error: "返信を編集する権限がありません" },
        { status: 403 }
      );
    }

    // リクエストボディを取得
    const body = await request.json();
    const { content } = body;

    if (!content || typeof content !== "string" || !content.trim()) {
      return NextResponse.json(
        { success: false, error: "内容を入力してください" },
        { status: 400 }
      );
    }

    // 返信を更新
    const updateData = {
      content: content.trim(),
      updatedAt: new Date(),
      isEdited: true,
    };

    await replyRef.update(updateData);

    // 更新された返信を取得
    const updatedReplyDoc = await replyRef.get();
    const updatedReply = updatedReplyDoc.data();

    const response: BulletinApiResponse<unknown> = {
      success: true,
      data: {
        id: updatedReplyDoc.id,
        ...updatedReply,
        createdAt: updatedReply?.createdAt.toDate().toISOString(),
        updatedAt: updatedReply?.updatedAt.toDate().toISOString(),
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("返信更新エラー:", error);
    return NextResponse.json(
      { success: false, error: "返信の更新に失敗しました" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  props: { params: Promise<{ postId: string; replyId: string }> }
) {
  try {
    // 認証確認（NextAuth または Firebase ID トークン）
    const authResult = await authenticateRequest(request);
    if (!authResult.authenticated || !authResult.userId) {
      return NextResponse.json(
        { success: false, error: authResult.error || "認証が必要です" },
        { status: 401 }
      );
    }
    const userId = authResult.userId;

    const params = await props.params;
    const { postId, replyId } = params;
    console.log("DELETE 返信 - postId:", postId, "replyId:", replyId);
    console.log("DELETE 返信 - userId:", userId);

    // 返信の存在確認と権限チェック
    const replyRef = adminDb.collection("bulletin_replies").doc(replyId);

    const replyDoc = await replyRef.get();

    if (!replyDoc.exists) {
      return NextResponse.json(
        { success: false, error: "返信が見つかりません" },
        { status: 404 }
      );
    }

    const reply = replyDoc.data();

    // 返信が指定された投稿に属しているか確認
    if (reply?.postId !== postId) {
      return NextResponse.json(
        { success: false, error: "返信が見つかりません" },
        { status: 404 }
      );
    }

    // 作者確認
    if (reply?.authorId !== userId) {
      return NextResponse.json(
        { success: false, error: "返信を削除する権限がありません" },
        { status: 403 }
      );
    }

    // 返信を削除
    await replyRef.delete();

    const response: BulletinApiResponse<null> = {
      success: true,
      data: null,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("返信削除エラー:", error);
    return NextResponse.json(
      { success: false, error: "返信の削除に失敗しました" },
      { status: 500 }
    );
  }
}
