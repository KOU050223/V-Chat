import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const { roomName, description, isPrivate } = await req.json();
  // ここでDBやRedisにルーム情報を保存し、roomIdを発行
  const roomId = 'room-' + Date.now();
  // 実際はDB保存処理を追加
  return NextResponse.json({ roomId });
}