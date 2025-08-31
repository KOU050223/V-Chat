import { NextRequest, NextResponse } from 'next/server';
import { RoomStore } from '@/lib/roomStore';

// 強制リセット用API（開発・デバッグ用）
export async function POST(req: NextRequest) {
  try {
    const { action } = await req.json();

    console.log('=== FORCE RESET REQUEST ===');
    console.log('Action:', action);
    console.log('All rooms before reset:', RoomStore.getAllRooms());

    if (action === 'reset_all_participants') {
      // 全ルームの参加者数を0にリセット
      const allRooms = RoomStore.getAllRooms();
      let resetCount = 0;

      for (const room of allRooms) {
        if (room.members > 0) {
          RoomStore.updateRoom(room.id, { members: 0 });
          resetCount++;
          console.log(`Reset room ${room.id} (${room.name}) members to 0`);
        }
      }

      // グローバルな参加者リストもリセット
      if (process.env.NODE_ENV === 'development') {
        if (globalThis.__roomParticipants) {
          // RoomStore用のparticipantsをリセット
          for (const roomId of Object.keys(globalThis.__roomParticipants as any)) {
            (globalThis.__roomParticipants as any)[roomId] = [];
          }
        }
        
        // join/route.ts用のMapもリセット
        if (globalThis.__roomParticipants && typeof globalThis.__roomParticipants === 'object') {
          // MapかObjectかを判定してリセット
          try {
            if (globalThis.__roomParticipants instanceof Map) {
              globalThis.__roomParticipants.clear();
            } else {
              // Object形式の場合
              Object.keys(globalThis.__roomParticipants as any).forEach(key => {
                delete (globalThis.__roomParticipants as any)[key];
              });
            }
          } catch (error) {
            console.warn('Failed to reset global participants:', error);
          }
        }
      }

      console.log('All rooms after reset:', RoomStore.getAllRooms());
      
      return NextResponse.json({
        success: true,
        message: `${resetCount}ルームの参加者数をリセットしました`,
        resetCount: resetCount,
        allRooms: RoomStore.getAllRooms()
      });
    }

    return NextResponse.json(
      { error: 'Invalid action. Use "reset_all_participants"' },
      { status: 400 }
    );

  } catch (error) {
    console.error('Failed to force reset:', error);
    return NextResponse.json(
      { error: 'Failed to force reset' },
      { status: 500 }
    );
  }
}