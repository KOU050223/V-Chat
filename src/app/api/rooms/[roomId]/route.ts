import { NextRequest, NextResponse } from 'next/server';
import { RoomStore } from '@/lib/roomStore';

export async function GET(
  req: NextRequest,
  { params }: { params: { roomId: string } }
) {
  try {
    const roomId = params.roomId;
    console.log('Looking for room with ID:', roomId);
    
    const room = RoomStore.getRoomById(roomId);
    console.log('Found room:', room);
    
    if (!room) {
      console.log('Room not found for ID:', roomId);
      return NextResponse.json(
        { error: 'Room not found' },
        { status: 404 }
      );
    }
    
    // プライベートルームの場合はアクセス制限を追加
    if (room.isPrivate) {
      // 実際の実装では認証チェックを行う
      return NextResponse.json(
        { error: 'Access denied to private room' },
        { status: 403 }
      );
    }
    
    console.log('Returning room data:', room);
    return NextResponse.json({ room });
  } catch (error) {
    console.error('Failed to fetch room:', error);
    return NextResponse.json(
      { error: 'Failed to fetch room' },
      { status: 500 }
    );
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { roomId: string } }
) {
  try {
    const roomId = params.roomId;
    const { members } = await req.json();
    
    console.log('Updating room:', { roomId, members });
    
    // 参加者数が負の値にならないように制限
    const safeMembers = Math.max(0, Math.min(100, members || 0)); // 最大100人まで
    
    const updatedRoom = RoomStore.updateRoom(roomId, { members: safeMembers });
    
    if (!updatedRoom) {
      console.log('Room not found for update:', roomId);
      return NextResponse.json(
        { error: 'Room not found' },
        { status: 404 }
      );
    }
    
    console.log('Room updated successfully:', updatedRoom);
    
    return NextResponse.json({ 
      room: updatedRoom,
      message: 'Room updated successfully' 
    });
  } catch (error) {
    console.error('Failed to update room:', error);
    return NextResponse.json(
      { error: 'Failed to update room' },
      { status: 500 }
    );
  }
} 