# Implementation Plan: VRM Motion Sync

**Branch**: `feature/vrm-motion-sync` | **Date**: 2025-09-20 | **Spec**: `docs/vrm-motion-sync-guide.md`

## Summary
Webカメラでキャプチャしたユーザーの身体の動き（ポーズ）を、画面上のVRMアバターにリアルタイムで同期させる機能を実装する。`MediaPipe` でポーズを推定し、`@pixiv/three-vrm` を用いてVRMモデルのボーンに動きを適用（リターゲティング）する。描画は `React Three Fiber` で行う。

## Technical Context
**Language/Version**: TypeScript
**Primary Dependencies**: React Three Fiber, Drei, Three.js, @pixiv/three-vrm, MediaPipe
**Storage**: N/A
**Testing**: Jest, React Testing Library
**Target Platform**: Web Browser
**Project Type**: Web Application
**Performance Goals**: リアルタイムでのモーション同期（30-60fpsを目指す）
**Constraints**: 一般的なPCのブラウザで効率的に動作すること
**Scale/Scope**: アプリケーションのコア機能であるビデオ通話画面に統合される

## Constitution Check
*GATE: 以下の各原則に準拠していることを確認*

- **[✔] I. ユーザーの心理的安全性の確保**: 準拠。顔出し不要の3Dアバターコミュニケーションというプロダクトの核をなす機能である。
- **[✔] II. 迅速な価値提供とスケーラビリティ**: 準拠。PoCのコア体験を形成する重要な機能である。
- **[✔] III. モダン技術による最適な体験の追求**: 準拠。React Three Fiber, MediaPipeなど、仕様書で提案されている技術は憲法の定める技術スタックと一致する。
- **[✔] IV. 品質と効率を両立する開発プロセス**: 準拠。後述の計画には、テストの自動化とコンポーネントの分離が含まれる。
- **[✔] V. セキュリティとパフォーマンスの標準化**: 準拠。パフォーマンスは本機能の重要な要件であり、設計段階から考慮されている。

## Project Structure

### Documentation (this feature)
```
.specify/vrm-motion-sync/
├── plan.md              # このファイル
├── research.md          # (Phase 0で生成)
├── data-model.md        # (Phase 1で生成)
└── tasks.md             # (Phase 2で生成)
```

### Source Code (repository root)
```
# Web Application 構造に準拠
src/
├── components/vrm/
│   └── MotionSyncViewer.tsx
├── hooks/
│   └── usePoseEstimation.ts
└── lib/
    └── vrm-retargeter.ts
```

**Structure Decision**: Option 2: Web application

## Phase 0: Outline & Research
`docs/vrm-motion-sync-guide.md` が非常に詳細な調査と設計指針を提供しているため、これを主要なリサーチドキュメントとして扱う。追加の調査は不要。

**Output**: `research.md` (上記ドキュメントの要約)

## Phase 1: Design & Contracts
*Prerequisites: `research.md` が完成していること*

1.  **データモデル (`data-model.md`)**: この機能はクライアントサイドのレンダリングに閉じており、永続化を伴う新しいデータモデルは不要。
2.  **APIコントラクト**: 新しいAPIエンドポイントは不要。
3.  **テストの設計**:
    *   `vrm-retargeter.ts` のリターゲティングロジックに対する単体テストを作成する。
    *   `MotionSyncViewer.tsx` コンポーネントがフックやユーティリティと正しく連携するかを確認するための統合テストを作成する。

**Output**: `data-model.md` (N/A), 失敗するテストコード

## Phase 2: Task Planning Approach
*このセクションは `/tasks` コマンドが実行する内容の記述*

**Task Generation Strategy**:
`vrm-motion-sync-guide.md` の実装ステップに基づき、以下のタスクを生成する。

1.  MediaPipeのモデルファイル (`pose_landmarker_lite.task`) を `/public/mediapipe` に配置する。
2.  カメラ映像の取得とポーズ推定を行う `usePoseEstimation.ts` フックを作成する。
3.  ポーズ推定ロジックに対する単体テストを作成する。
4.  VRMモデルのボーンにモーションを適用する `vrm-retargeter.ts` ユーティリティを作成する。
5.  リターゲティングロジックに対する単体テストを作成する。
6.  上記を統合し、`useFrame` を使って毎フレーム更新する `MotionSyncViewer.tsx` コンポーネントを作成する。
7.  `MotionSyncViewer.tsx` の統合テストを作成する。

**Ordering Strategy**: TDDの順序（テスト → 実装）と依存関係（フック/ユーティリティ → コンポーネント）に従う。
