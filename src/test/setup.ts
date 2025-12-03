import "@testing-library/jest-dom";
import { afterEach, vi } from "vitest";
import { cleanup } from "@testing-library/react";

// 各テスト後にクリーンアップ
afterEach(() => {
  cleanup();
});

// process.env.NODE_ENV のモック
vi.stubEnv("NODE_ENV", "test");
