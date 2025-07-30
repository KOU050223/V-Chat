// ルームデータを管理する共通ストア
export interface Room {
  id: string;
  name: string;
  description: string;
  isPrivate: boolean;
  members: number;
  createdAt: Date;
  createdBy: string;
}

// メモリ内でルームを管理（本格的な実装ではデータベースを使用）
let rooms: Room[] = [
  {
    id: 'room-1753883576886',
    name: '雑談部屋',
    description: '気軽に雑談できるルームです',
    isPrivate: false,
    members: 0, // リセット
    createdAt: new Date('2024-01-01T10:00:00Z'),
    createdBy: 'user-1'
  },
  {
    id: 'room-1753883600000',
    name: '勉強会',
    description: 'プログラミングの勉強会です',
    isPrivate: false,
    members: 0,
    createdAt: new Date('2024-01-01T11:00:00Z'),
    createdBy: 'user-2'
  }
];

export class RoomStore {
  static getAllRooms(): Room[] {
    return rooms;
  }

  static getRoomById(roomId: string): Room | undefined {
    return rooms.find(room => room.id === roomId);
  }

  static createRoom(roomData: Omit<Room, 'id' | 'createdAt'>): Room {
    const newRoom: Room = {
      ...roomData,
      id: `room-${Date.now()}`,
      createdAt: new Date()
    };
    rooms.push(newRoom);
    return newRoom;
  }

  static updateRoom(roomId: string, updates: Partial<Room>): Room | null {
    const roomIndex = rooms.findIndex(room => room.id === roomId);
    if (roomIndex === -1) return null;
    
    rooms[roomIndex] = { ...rooms[roomIndex], ...updates };
    return rooms[roomIndex];
  }

  static deleteRoom(roomId: string): boolean {
    const roomIndex = rooms.findIndex(room => room.id === roomId);
    if (roomIndex === -1) return false;
    
    rooms.splice(roomIndex, 1);
    return true;
  }

  static getPublicRooms(): Room[] {
    return rooms.filter(room => !room.isPrivate);
  }

  static searchRooms(query: string): Room[] {
    const lowercaseQuery = query.toLowerCase();
    return rooms.filter(room => 
      room.name.toLowerCase().includes(lowercaseQuery) ||
      room.description.toLowerCase().includes(lowercaseQuery)
    );
  }
} 