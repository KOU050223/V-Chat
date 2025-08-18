import { NextRequest, NextResponse } from 'next/server';
import { RoomStore } from '@/lib/roomStore';

export async function GET(req: NextRequest) {
  try {
    const allRooms = RoomStore.getAllRooms();
    const publicRooms = RoomStore.getPublicRooms();
    
    return NextResponse.json({
      allRooms,
      publicRooms,
      totalRooms: allRooms.length,
      totalPublicRooms: publicRooms.length
    });
  } catch (error) {
    console.error('Debug API error:', error);
    return NextResponse.json(
      { error: 'Failed to get debug info' },
      { status: 500 }
    );
  }
} 