import { NextRequest, NextResponse } from 'next/server';
import { RoomStore } from '@/lib/roomStore';

// ルーム参加者管理（本格実装ではRedisやデータベースを使用）
declare global {
  var __roomParticipants: Map<string, Set<string>> | undefined;
}

const roomParticipants = globalThis.__roomParticipants ?? new Map<string, Set<string>>();

if (process.env.NODE_ENV === 'development') {
  globalThis.__roomParticipants = roomParticipants;
}

// デバッグ用: 現在の参加者状況をログ出力
function logCurrentState(roomId: string, action: string) {
  console.log(`=== PARTICIPANT STATE DEBUG (${action}) ===`);
  console.log('Room ID:', roomId);
  console.log('Current participants in Map:', Array.from(roomParticipants.get(roomId) || []));
  console.log('Room info from RoomStore:', RoomStore.getRoomById(roomId));
  console.log('All rooms in store:', RoomStore.getAllRooms().map(r => ({ id: r.id, name: r.name, members: r.members })));
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  try {
    const { roomId } = await params;
    
    // JSONパースエラーを防ぐ
    let requestData = {};
    try {
      const body = await req.text();
      requestData = body ? JSON.parse(body) : {};
    } catch (parseError) {
      console.error('JSON parse error:', parseError);
      return NextResponse.json(
        { error: 'Invalid JSON in request body' },
        { status: 400 }
      );
    }
    
    const { userIdentifier, userId, userName, action } = requestData as { 
      userIdentifier?: string; 
      userId?: string;
      userName?: string; 
      action?: string; 
    };

    console.log('=== ROOM REQUEST ===');
    console.log('Room ID:', roomId);
    console.log('User Identifier:', userIdentifier);
    console.log('User ID:', userId);
    console.log('User Name:', userName);
    console.log('Action:', action);

    if (!userIdentifier) {
      return NextResponse.json(
        { error: 'User identifier is required' },
        { status: 400 }
      );
    }

    // sendBeaconからのleave要求をPOSTで処理
    if (action === 'leave') {
      console.log('=== PROCESSING LEAVE REQUEST VIA POST (sendBeacon) ===');
      logCurrentState(roomId, 'BEFORE_LEAVE_POST');
      
      const participants = roomParticipants.get(roomId) || new Set();
      let removedCount = 0;
      
      // userIdentifierで削除
      if (participants.has(userIdentifier)) {
        participants.delete(userIdentifier);
        removedCount++;
        console.log('🗑️ Removed specific identifier:', userIdentifier);
      }
      
      // userIdベースで関連する古いidentifierも一括削除（HMR対策）
      if (userId) {
        const relatedIdentifiers = Array.from(participants).filter(identifier => 
          identifier.startsWith(userId + '-') && identifier !== userIdentifier
        );
        
        relatedIdentifiers.forEach(oldIdentifier => {
          participants.delete(oldIdentifier);
          removedCount++;
          console.log('🗑️ Removed related identifier:', oldIdentifier);
        });
      }
      
      if (removedCount > 0) {
        roomParticipants.set(roomId, participants);
        
        const newMemberCount = participants.size;
        const updatedRoom = RoomStore.updateRoom(roomId, { members: newMemberCount });
        
        console.log(`User(s) removed from room (POST): ${removedCount} identifiers`);
        console.log('New member count:', newMemberCount);
        logCurrentState(roomId, 'AFTER_LEAVE_POST');
        
        return NextResponse.json({
          room: updatedRoom,
          message: `Left room successfully via POST (${removedCount} identifiers removed)`,
          participants: Array.from(participants)
        });
      } else {
        console.log('User was not in room:', userIdentifier);
        logCurrentState(roomId, 'USER_NOT_IN_ROOM_POST');
        return NextResponse.json({
          room: RoomStore.getRoomById(roomId),
          message: 'User was not in room',
          participants: Array.from(participants)
        });
      }
    }

    // ルームの存在確認
    const room = RoomStore.getRoomById(roomId);
    if (!room) {
      console.log('Room not found:', roomId);
      return NextResponse.json(
        { error: 'Room not found' },
        { status: 404 }
      );
    }

    // 通常の参加処理
    logCurrentState(roomId, 'BEFORE_JOIN');
    
    // 参加者リストを取得または作成
    if (!roomParticipants.has(roomId)) {
      roomParticipants.set(roomId, new Set<string>());
    }

    const participants = roomParticipants.get(roomId)!;
    
    // 既に参加済みかチェック（userIdentifierベース）
    if (participants.has(userIdentifier)) {
      console.log('⚠️ User already in room with same identifier:', userIdentifier);
      logCurrentState(roomId, 'USER_ALREADY_IN_ROOM');
      return NextResponse.json({
        room: room,
        message: 'Already joined',
        participants: Array.from(participants)
      });
    }

    // userIdベースの重複チェック（HMR対策）
    if (userId) {
      const existingUserIdentifiers = Array.from(participants).filter(identifier => 
        identifier.startsWith(userId + '-')
      );
      
      if (existingUserIdentifiers.length > 0) {
        console.log('🔄 Found existing identifiers for userId:', userId, existingUserIdentifiers);
        // 古いuserIdentifierを削除
        existingUserIdentifiers.forEach(oldIdentifier => {
          participants.delete(oldIdentifier);
          console.log('🗑️ Removed old identifier:', oldIdentifier);
        });
      }
    }

    // 参加者を追加
    participants.add(userIdentifier);
    const newMemberCount = participants.size;

    console.log('Current participants:', Array.from(participants));
    console.log('New member count:', newMemberCount);

    // ルーム情報を更新
    const updatedRoom = RoomStore.updateRoom(roomId, { 
      members: newMemberCount 
    });
    
    logCurrentState(roomId, 'AFTER_JOIN');

    if (!updatedRoom) {
      return NextResponse.json(
        { error: 'Failed to update room' },
        { status: 500 }
      );
    }

    console.log('Room updated successfully:', updatedRoom);

    return NextResponse.json({
      room: updatedRoom,
      message: 'Successfully joined room',
      participants: Array.from(participants),
      userIdentifier: userIdentifier
    });

  } catch (error) {
    console.error('Failed to join room:', error);
    return NextResponse.json(
      { error: 'Failed to join room' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  try {
    const { roomId } = await params;
    
    // JSONパースエラーを防ぐ
    let requestData = {};
    try {
      const body = await req.text();
      requestData = body ? JSON.parse(body) : {};
    } catch (parseError) {
      console.error('JSON parse error:', parseError);
      return NextResponse.json(
        { error: 'Invalid JSON in request body' },
        { status: 400 }
      );
    }
    
    const { userIdentifier, userId } = requestData as { userIdentifier?: string; userId?: string };

    console.log('=== ROOM LEAVE REQUEST ===');
    console.log('Room ID:', roomId);
    console.log('User Identifier:', userIdentifier);
    console.log('User ID:', userId);

    if (!userIdentifier) {
      return NextResponse.json(
        { error: 'User identifier is required' },
        { status: 400 }
      );
    }

    // ルームの存在確認
    const room = RoomStore.getRoomById(roomId);
    if (!room) {
      return NextResponse.json(
        { error: 'Room not found' },
        { status: 404 }
      );
    }

    // 参加者リストから削除
    logCurrentState(roomId, 'BEFORE_LEAVE_DELETE');
    
    const participants = roomParticipants.get(roomId);
    if (participants) {
      const wasInRoom = participants.has(userIdentifier);
      participants.delete(userIdentifier);
      const newMemberCount = participants.size;

      console.log('User was in room:', wasInRoom);
      console.log('Remaining participants:', Array.from(participants));
      console.log('New member count:', newMemberCount);

      // ルーム情報を更新
      const updatedRoom = RoomStore.updateRoom(roomId, { 
        members: newMemberCount 
      });

      logCurrentState(roomId, 'AFTER_LEAVE_DELETE');

      // 参加者数が0になった場合、ルームを自動削除するかの判定
      // （現在は削除しないが、将来的には削除も可能）
      if (newMemberCount === 0) {
        console.log(`Room ${roomId} is now empty (0 members)`);
        // 将来の実装: RoomStore.deleteRoom(roomId);
      }

      return NextResponse.json({
        room: updatedRoom,
        message: 'Successfully left room',
        participants: Array.from(participants)
      });
    }

    logCurrentState(roomId, 'USER_NOT_IN_ROOM_DELETE');
    return NextResponse.json({
      room: room,
      message: 'User was not in room',
      participants: []
    });

  } catch (error) {
    console.error('Failed to leave room:', error);
    return NextResponse.json(
      { error: 'Failed to leave room' },
      { status: 500 }
    );
  }
}