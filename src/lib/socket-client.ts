// src/lib/socket-client.ts
import * as io from 'socket.io-client';
import { Socket } from 'socket.io-client';
import { MatchingUser, MatchingResult } from '@/types/matching_type';

export class SocketClient {
  private socket: Socket | null = null;
  private isConnected = false;

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.socket = io.io(process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:3001');

      this.socket.on('connect', () => {
        console.log('Connected to WebSocket server');
        this.isConnected = true;
        resolve();
      });

      this.socket.on('connect_error', (error: any) => {
        console.error('WebSocket connection error:', error);
        this.isConnected = false;
        reject(error);
      });

      this.socket.on('disconnect', () => {
        console.log('Disconnected from WebSocket server');
        this.isConnected = false;
      });
    });
  }

  joinMatching(userData: {
    userId: string;
    preferences?: any;
    userInfo?: any;
  }): void {
    if (this.socket && this.isConnected) {
      this.socket.emit('join-matching', userData);
    } else {
      console.error('Socket not connected');
    }
  }

  leaveMatching(userId: string): void {
    if (this.socket && this.isConnected) {
      this.socket.emit('leave-matching', userId);
    }
  }

  getStats(): void {
    if (this.socket && this.isConnected) {
      this.socket.emit('get-stats');
    }
  }

  onMatchingJoined(callback: (data: any) => void): void {
    if (this.socket) {
      this.socket.on('matching-joined', callback);
    }
  }

  onMatchFound(callback: (data: MatchingResult) => void): void {
    if (this.socket) {
      this.socket.on('match-found', callback);
    }
  }

  onMatchingLeft(callback: (data: any) => void): void {
    if (this.socket) {
      this.socket.on('matching-left', callback);
    }
  }

  onStatsUpdated(callback: (stats: any) => void): void {
    if (this.socket) {
      this.socket.on('stats-updated', callback);
    }
  }

  onError(callback: (error: any) => void): void {
    if (this.socket) {
      this.socket.on('matching-error', callback);
    }
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.isConnected = false;
    }
  }

  isSocketConnected(): boolean {
    return this.isConnected;
  }
}

// シングルトンインスタンス
export const socketClient = new SocketClient();