// 自動クリーンアップサービス
import { RoomStore } from "./roomStore";

// グローバルクリーンアップタイマー
declare global {
  var __cleanupInterval: NodeJS.Timeout | undefined;
  var __roomParticipants: Map<string, Set<string>> | undefined;
}

export class CleanupService {
  private static isRunning: boolean = false;
  private static cleanupInterval: NodeJS.Timeout | null = null;

  /**
   * 自動クリーンアップサービスを開始
   */
  static startAutoCleanup() {
    if (this.isRunning) {
      console.log("⚠️ Auto cleanup service is already running");
      return;
    }

    console.log("🧹 Starting auto cleanup service...");
    this.isRunning = true;

    // 即座に1回実行
    this.performCleanup();

    // 5分ごとに自動クリーンアップを実行
    this.cleanupInterval = setInterval(
      () => {
        this.performCleanup();
      },
      5 * 60 * 1000
    ); // 5分

    // 開発環境では間隔を短縮（1分）
    if (process.env.NODE_ENV === "development") {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = setInterval(
        () => {
          this.performCleanup();
        },
        1 * 60 * 1000
      ); // 1分
      console.log("🔧 DEV MODE: Auto cleanup interval set to 1 minute");
    }

    // グローバルに保存（HMR対策）
    if (process.env.NODE_ENV === "development") {
      globalThis.__cleanupInterval = this.cleanupInterval;
    }
  }

  /**
   * 自動クリーンアップサービスを停止
   */
  static stopAutoCleanup() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.isRunning = false;
    console.log("🛑 Auto cleanup service stopped");
  }

  /**
   * 包括的なクリーンアップを実行
   */
  static performCleanup() {
    console.log("🧹 === PERFORMING AUTO CLEANUP ===");

    const results = {
      emptyRooms: 0,
      oldRooms: 0,
      orphanedParticipants: 0,
      sessionStorageKeys: 0,
    };

    try {
      // 1. 空ルームのクリーンアップ
      results.emptyRooms = RoomStore.cleanupEmptyRooms();

      // 2. 古いルーム（6時間以上）のクリーンアップ
      results.oldRooms = RoomStore.cleanupOldRooms(6);

      // 3. 孤立した参加者データのクリーンアップ
      results.orphanedParticipants = this.cleanupOrphanedParticipants();

      // 4. セッションストレージのクリーンアップ（ブラウザ環境でのみ）
      if (typeof window !== "undefined") {
        results.sessionStorageKeys = this.cleanupSessionStorage();
      }

      // 5. メモリ使用量の監視（開発環境）
      if (process.env.NODE_ENV === "development") {
        this.logMemoryUsage();
      }

      console.log("✅ Auto cleanup completed:", results);

      // 何かクリーンアップされた場合は詳細ログ
      const totalCleaned = Object.values(results).reduce((a, b) => a + b, 0);
      if (totalCleaned > 0) {
        console.log(`🗑️ Total items cleaned: ${totalCleaned}`);
      }
    } catch (error) {
      console.error("❌ Auto cleanup failed:", error);
    }
  }

  /**
   * 存在しないルームの参加者データを削除
   */
  private static cleanupOrphanedParticipants(): number {
    if (!globalThis.__roomParticipants) {
      return 0;
    }

    const participantMap = globalThis.__roomParticipants;
    const allRooms = RoomStore.getAllRooms();
    const validRoomIds = new Set(allRooms.map((room) => room.id));

    let cleanedCount = 0;

    // 存在しないルームの参加者データを削除
    for (const roomId of participantMap.keys()) {
      if (!validRoomIds.has(roomId)) {
        participantMap.delete(roomId);
        cleanedCount++;
        console.log(`🗑️ Removed orphaned participants for room: ${roomId}`);
      }
    }

    return cleanedCount;
  }

  /**
   * 古いセッションストレージデータを削除
   */
  private static cleanupSessionStorage(): number {
    if (typeof window === "undefined") {
      return 0;
    }

    let cleanedCount = 0;
    const keysToRemove: string[] = [];

    // room-* キーを探す
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      if (key && key.startsWith("room-")) {
        // ルームIDを抽出
        const roomIdMatch = key.match(/^room-([^-]+(?:-[^-]+)*)-/);
        if (roomIdMatch) {
          const roomId = roomIdMatch[1];

          // ルームが存在しない場合は削除対象
          if (!RoomStore.getRoomById(roomId)) {
            keysToRemove.push(key);
          }
        }
      }
    }

    // 古いキーを削除
    keysToRemove.forEach((key) => {
      sessionStorage.removeItem(key);
      cleanedCount++;
    });

    if (cleanedCount > 0) {
      console.log(`🗑️ Cleaned ${cleanedCount} old session storage keys`);
    }

    return cleanedCount;
  }

  /**
   * メモリ使用量をログ出力（開発環境）
   */
  private static logMemoryUsage() {
    const allRooms = RoomStore.getAllRooms();
    const participantMap = globalThis.__roomParticipants;

    console.log("📊 Memory Usage Report:");
    console.log(`  - Total rooms: ${allRooms.length}`);
    console.log(
      `  - Participant maps: ${participantMap ? participantMap.size : 0}`
    );

    if (participantMap) {
      let totalParticipants = 0;
      participantMap.forEach((participants) => {
        totalParticipants += participants.size;
      });
      console.log(`  - Total participants tracked: ${totalParticipants}`);
    }

    // セッションストレージのサイズ
    if (typeof window !== "undefined") {
      let sessionStorageRoomKeys = 0;
      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i);
        if (key && key.startsWith("room-")) {
          sessionStorageRoomKeys++;
        }
      }
      console.log(`  - Session storage room keys: ${sessionStorageRoomKeys}`);
    }
  }

  /**
   * 手動で強制クリーンアップを実行
   */
  static forceCleanup() {
    console.log("🧹 === FORCE CLEANUP REQUESTED ===");
    this.performCleanup();
  }

  /**
   * クリーンアップサービスの状態を取得
   */
  static getStatus() {
    return {
      isRunning: this.isRunning,
      hasInterval: this.cleanupInterval !== null,
      isDevelopment: process.env.NODE_ENV === "development",
    };
  }
}
