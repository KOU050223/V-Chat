<!--
SYNC IMPACT REPORT

- Version Change: None -> 1.0.0
- Summary: Initial constitution established based on project documents (`アイデア.md`, `development-guidelines.md`).
- Sections Added:
  - Core Principles (5 principles defined)
  - 技術スタック概要
  - Governance
- Sections Removed: None
- Templates Requiring Updates:
  - ⚠ PENDING: `.specify/templates/plan-template.md` (Review for alignment with new principles)
  - ⚠ PENDING: `.specify/templates/spec-template.md` (Review for alignment with new principles)
  - ⚠ PENDING: `.specify/templates/tasks-template.md` (Review for alignment with new principles)
- Follow-up TODOs: None
-->
# v-chat Constitution

## Core Principles

### I. ユーザーの心理的安全性の確保
顔出し不要の3Dアバターコミュニケーションを核とし、誰もが安心してカジュアルに交流できる場を提供する。ユーザーのプライバシーを尊重し、心の閉鎖感を打破することをプロダクトの最優先事項とする。

### II. 迅速な価値提供とスケーラビリティ
無料枠SaaSを組み合わせた低コスト運用で、PoC (Proof of Concept) として素早く価値を検証する。コア機能（アバター通話、マッチング）を優先し、需要に応じたスケールアップが可能なアーキテクチャを設計する。

### III. モダン技術による最適な体験の追求
Next.js, React Three Fiber, LiveKitなど、各領域で最適な技術を積極的に採用し、高品質な3Dコミュニケーション体験を構築する。shadcn/uiとTailwindCSSによる、一貫性と保守性の高いUIを維持する。

### IV. 品質と効率を両立する開発プロセス
TypeScriptの型安全性を活用し、ESLint/Prettierでコード品質を維持する。GitHub ActionsによるCI/CDを導入してテストとデプロイを自動化し、開発サイクルを高速化する。

### V. セキュリティとパフォーマンスの標準化
認証・認可やデータ保護を徹底し、安全なサービス利用を保証する。Next.jsの最適化機能などを活用し、特に3Dモデル描画におけるパフォーマンスを常に意識した実装を行う。

## 技術スタック概要

- **フロントエンド:** Next.js, TypeScript, React Three Fiber, shadcn/ui, TailwindCSS
- **リアルタイム通信:** LiveKit
- **バックエンド/BaaS:** Vercel Functions, Firebase, Neon, Upstash Redis
- **インフラ:** Vercel, GitHub Actions

## Governance

- この憲法は、プロジェクトにおける全ての開発プラクティスに優先される。
- 原則の変更には、ドキュメントの更新、チームの合意、そして既存コードへの影響評価が必要である。
- 全てのプルリクエストは、レビュー時にこの憲法の原則に準拠しているか確認されるものとする。

**Version**: 1.0.0 | **Ratified**: 2025-09-20 | **Last Amended**: 2025-09-20
