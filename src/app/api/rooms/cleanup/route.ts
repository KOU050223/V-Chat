import { NextRequest, NextResponse } from 'next/server';
import { RoomStore } from '@/lib/roomStore';

// 開発環境用: ルームクリーンアップAPI
export async function POST(req: NextRequest) {
  try {
    const { cleanupType } = await req.json();

    console.log('=== ROOM CLEANUP REQUEST ===');
    console.log('Cleanup Type:', cleanupType);
    console.log('Rooms before cleanup:', RoomStore.getAllRooms().length);

    let cleanedCount = 0;
    let message = '';

    switch (cleanupType) {
      case 'empty':
        cleanedCount = RoomStore.cleanupEmptyRooms();
        message = `${cleanedCount}個の空ルームを削除しました`;
        break;
      
      case 'old':
        cleanedCount = RoomStore.cleanupOldRooms(24); // 24時間以上古いルームを削除
        message = `${cleanedCount}個の古いルームを削除しました`;
        break;
      
      case 'all':
        const emptyCount = RoomStore.cleanupEmptyRooms();
        const oldCount = RoomStore.cleanupOldRooms(1); // 1時間以上古いルームを削除
        cleanedCount = emptyCount + oldCount;
        message = `${emptyCount}個の空ルームと${oldCount}個の古いルームを削除しました`;
        break;
      
      default:
        return NextResponse.json(
          { error: 'Invalid cleanup type. Use "empty", "old", or "all"' },
          { status: 400 }
        );
    }

    console.log('Rooms after cleanup:', RoomStore.getAllRooms().length);
    console.log('Cleanup completed:', message);

    return NextResponse.json({
      success: true,
      message: message,
      cleanedCount: cleanedCount,
      remainingRooms: RoomStore.getAllRooms().length,
      rooms: RoomStore.getAllRooms()
    });

  } catch (error) {
    console.error('Failed to cleanup rooms:', error);
    return NextResponse.json(
      { error: 'Failed to cleanup rooms' },
      { status: 500 }
    );
  }
}