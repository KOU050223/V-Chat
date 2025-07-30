import { NextRequest, NextResponse } from 'next/server';
import { RoomStore } from '@/lib/roomStore';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search') || '';
    
    let filteredRooms = RoomStore.getPublicRooms();
    
    if (search) {
      filteredRooms = RoomStore.searchRooms(search).filter(room => !room.isPrivate);
    }
    
    return NextResponse.json({ 
      rooms: filteredRooms,
      total: filteredRooms.length 
    });
  } catch (error) {
    console.error('Failed to fetch rooms:', error);
    return NextResponse.json(
      { error: 'Failed to fetch rooms' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const { name, description, isPrivate } = await req.json();
    console.log('Creating room with data:', { name, description, isPrivate });
    
    if (!name || name.trim().length === 0) {
      return NextResponse.json(
        { error: 'Room name is required' },
        { status: 400 }
      );
    }
    
    const newRoom = RoomStore.createRoom({
      name: name.trim(),
      description: description?.trim() || '',
      isPrivate: isPrivate || false,
      members: 0,
      createdBy: 'user-1' // 実際の実装では認証されたユーザーIDを使用
    });
    
    console.log('Created new room:', newRoom);
    
    return NextResponse.json({ 
      room: newRoom,
      message: 'Room created successfully' 
    });
  } catch (error) {
    console.error('Failed to create room:', error);
    return NextResponse.json(
      { error: 'Failed to create room' },
      { status: 500 }
    );
  }
} 