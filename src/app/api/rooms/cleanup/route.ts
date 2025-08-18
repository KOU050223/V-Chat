import { NextRequest, NextResponse } from 'next/server';
import { RoomStore } from '@/lib/roomStore';
import { CleanupService } from '@/lib/cleanupService';

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
      
      case 'comprehensive':
        // 包括的なクリーンアップ
        const emptyRooms = RoomStore.cleanupEmptyRooms();
        const oldRooms = RoomStore.cleanupOldRooms(6); // 6時間以上
        const orphanedParticipants = await cleanupOrphanedParticipants();
        
        cleanedCount = emptyRooms + oldRooms + orphanedParticipants;
        message = `包括的クリーンアップ完了: 空ルーム${emptyRooms}個、古いルーム${oldRooms}個、孤立データ${orphanedParticipants}個`;
        
        return NextResponse.json({
          success: true,
          message: message,
          totalCleaned: cleanedCount,
          emptyRooms: emptyRooms,
          oldRooms: oldRooms,
          orphanedParticipants: orphanedParticipants,
          remainingRooms: RoomStore.getAllRooms().length,
          rooms: RoomStore.getAllRooms()
        });
        
      case 'force':
        // 強制クリーンアップ（サービス経由）
        CleanupService.forceCleanup();
        message = '強制クリーンアップを実行しました';
        cleanedCount = 0; // サービス経由なので詳細な数は取得しない
        break;
      
      default:
        return NextResponse.json(
          { error: 'Invalid cleanup type. Use "empty", "old", "all", "comprehensive", or "force"' },
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

/**
 * 存在しないルームの参加者データを削除（サーバー側）
 */
async function cleanupOrphanedParticipants(): Promise<number> {
  if (!globalThis.__roomParticipants) {
    return 0;
  }

  const participantMap = globalThis.__roomParticipants;
  const allRooms = RoomStore.getAllRooms();
  const validRoomIds = new Set(allRooms.map(room => room.id));
  
  let cleanedCount = 0;
  
  // 存在しないルームの参加者データを削除
  for (const roomId of participantMap.keys()) {
    if (!validRoomIds.has(roomId)) {
      participantMap.delete(roomId);
      cleanedCount++;
      console.log(`🗑️ API: Removed orphaned participants for room: ${roomId}`);
    }
  }

  return cleanedCount;
}