# Tasks: VRM Motion Sync

**Input**: Design documents from `/.specify/vrm-motion-sync/`

## Format: `[ID] [P?] Description`
- **[P]**: 並行実行が可能（ファイルが異なり、依存関係がないタスク）

## Phase 1: Setup
- [ ] T001 [P] MediaPipeモデル `pose_landmarker_lite.task` をダウンロードし、`/public/mediapipe/` に配置する。

## Phase 2: Tests First (TDD) ⚠️ 
**重要: 以下のテストは、実装に着手する前に作成し、必ず失敗することを確認してください。**
- [ ] T002 [P] リターゲティング処理の単体テストを作成する (`/src/lib/vrm-retargeter.test.ts`)。
- [ ] T003 [P] ポーズ推定フックの単体テストを作成する (`/src/hooks/usePoseEstimation.test.ts`)。
- [ ] T004 統合コンポーネントのテストを作成する (`/src/components/vrm/MotionSyncViewer.test.tsx`)。

## Phase 3: Core Implementation
**注意: 各実装は、対応するテストが失敗することを確認した後に着手してください。**
- [ ] T005 [P] リターゲティング処理のロジックを実装し、T002のテストをパスさせる (`/src/lib/vrm-retargeter.ts`)。
- [ ] T006 [P] カメラとMediaPipeを扱う `usePoseEstimation.ts` フックを実装し、T003のテストをパスさせる。
- [ ] T007 最終的な統合コンポーネント `MotionSyncViewer.tsx` を実装し、T004のテストをパスさせる。

## Dependencies
- `T001` は `T006` の前に完了している必要があります。
- `T002`, `T003`, `T004` (テスト群) は、それぞれ対応する `T005`, `T006`, `T007` (実装群) の前に完了している必要があります。
- `T005` と `T006` は並行して実装可能です。
- `T007` は `T005` と `T006` の完了に依存します。
