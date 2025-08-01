import { NextRequest, NextResponse } from 'next/server';
import { RoomStore } from '@/lib/roomStore';

// 開発環境用: 参加者数をリセットする機能
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  // 本格実装では管理者権限チェックを行う
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json(
      { error: 'Reset function is only available in development mode' },
      { status: 403 }
    );
  }

  try {
    const { roomId } = await params;

    console.log('=== ROOM RESET REQUEST ===');
    console.log('Room ID:', roomId);

    // ルームの存在確認
    const room = RoomStore.getRoomById(roomId);
    if (!room) {
      return NextResponse.json(
        { error: 'Room not found' },
        { status: 404 }
      );
    }

    // 参加者リストをクリア
    const roomParticipants = globalThis.__roomParticipants;
    if (roomParticipants?.has(roomId)) {
      roomParticipants.delete(roomId);
    }

    // ルームの参加者数を0にリセット
    const updatedRoom = RoomStore.updateRoom(roomId, { members: 0 });

    if (!updatedRoom) {
      return NextResponse.json(
        { error: 'Failed to reset room' },
        { status: 500 }
      );
    }

    console.log('Room reset successfully:', updatedRoom);

    return NextResponse.json({
      room: updatedRoom,
      message: 'Room reset successfully',
      participants: []
    });

  } catch (error) {
    console.error('Failed to reset room:', error);
    return NextResponse.json(
      { error: 'Failed to reset room' },
      { status: 500 }
    );
  }
}