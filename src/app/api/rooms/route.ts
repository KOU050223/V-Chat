import { NextRequest, NextResponse } from 'next/server';
import { RoomStore } from '@/lib/roomStore';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search') || '';
    
    console.log('All rooms in store:', RoomStore.getAllRooms());
    console.log('Search query:', search);
    
    let filteredRooms = RoomStore.getPublicRooms();
    
    // 参加者数が0のルームを除外（空のルームを非表示）
    filteredRooms = filteredRooms.filter(room => room.members > 0);
    
    if (search) {
      const searchResults = RoomStore.searchRooms(search)
        .filter(room => !room.isPrivate && room.members > 0); // 検索でも空ルームを除外
      filteredRooms = searchResults;
    }
    
    console.log('Filtered rooms (excluding empty):', filteredRooms);
    
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
    console.log('Rooms before creation:', RoomStore.getAllRooms());
    
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
    console.log('Rooms after creation:', RoomStore.getAllRooms());
    
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