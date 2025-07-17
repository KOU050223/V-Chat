# Requirements Document

## Introduction

V-Chatは、3Dキャラクターモデル（V体）を使用してビデオ通話を行うWebアプリケーションです。ユーザーは顔を隠しながらノンバーバルコミュニケーションを行うことができ、顔出しが怖い人でも気軽に人と繋がれる機会を提供します。現代人が抱える心の閉鎖感を打破し、カジュアルな人との交流を推進することを目的としています。

## Requirements

### Requirement 1

**User Story:** 新規ユーザーとして、複数の認証方法でアカウントを作成したい、そうすることで自分に適した方法でサービスを利用開始できる

#### Acceptance Criteria

1. WHEN ユーザーが新規登録ページにアクセスする THEN システム SHALL Email、Google、GitHubの3つの認証オプションを表示する
2. WHEN ユーザーがEmail認証を選択する THEN システム SHALL メールアドレスとパスワードの入力フィールドを表示する
3. WHEN ユーザーがGoogle認証を選択する THEN システム SHALL Googleの認証フローにリダイレクトする
4. WHEN ユーザーがGitHub認証を選択する THEN システム SHALL GitHubの認証フローにリダイレクトする
5. WHEN 認証が成功する THEN システム SHALL ユーザー情報登録画面に遷移する

### Requirement 2

**User Story:** 登録済みユーザーとして、プロフィール情報を設定・編集したい、そうすることで自分のアイデンティティを表現できる

#### Acceptance Criteria

1. WHEN ユーザーがプロフィール設定画面にアクセスする THEN システム SHALL ユーザーID、ユーザー名、性別、V体IDの入力フィールドを表示する
2. WHEN ユーザーがユーザーIDを入力する THEN システム SHALL 重複チェックを実行し、利用可能性を表示する
3. WHEN ユーザーがV体を選択する THEN システム SHALL VroidHubから利用可能なV体モデルの一覧を表示する
4. WHEN ユーザーがプロフィールを保存する THEN システム SHALL 入力内容を検証し、データベースに保存する
5. WHEN ユーザーが既存プロフィールを編集する THEN システム SHALL 現在の情報を表示し、変更を許可する

### Requirement 3

**User Story:** ユーザーとして、ランダムマッチング機能を使って新しい人と出会いたい、そうすることで偶然の出会いを楽しめる

#### Acceptance Criteria

1. WHEN ユーザーがランダムマッチングを選択する THEN システム SHALL マッチング待機キューに追加する
2. WHEN 他のユーザーも待機中の場合 THEN システム SHALL 自動的にマッチングを成立させる
3. WHEN マッチングが成立する THEN システム SHALL 両ユーザーをビデオ通話ルームに接続する
4. WHEN マッチング待機中にキャンセルする THEN システム SHALL 待機キューから削除し、メイン画面に戻る
5. WHEN 長時間マッチングしない場合 THEN システム SHALL タイムアウト通知を表示する

### Requirement 4

**User Story:** ユーザーとして、セレクトマッチング機能を使って特定の人と通話したい、そうすることで知り合いと安全に通話できる

#### Acceptance Criteria

1. WHEN ユーザーがセレクトマッチングを選択する THEN システム SHALL ルーム作成とルーム参加の選択肢を表示する
2. WHEN ユーザーがルームを作成する THEN システム SHALL 一意のルームIDを生成し、表示する
3. WHEN ユーザーがルームIDを入力する THEN システム SHALL ルームの存在を確認し、参加を許可する
4. WHEN ルームに参加する THEN システム SHALL 他の参加者とビデオ通話を開始する
5. WHEN ルーム作成者がルームを閉じる THEN システム SHALL 全参加者を退出させ、ルームを削除する

### Requirement 5

**User Story:** ユーザーとして、V体を使ったビデオ通話を行いたい、そうすることで顔を隠しながらコミュニケーションできる

#### Acceptance Criteria

1. WHEN ビデオ通話が開始される THEN システム SHALL ユーザーのWebカメラから顔の動きを検出する
2. WHEN 顔の動きが検出される THEN システム SHALL MediaPipe Holisticを使用してモーションキャプチャを実行する
3. WHEN モーションデータが取得される THEN システム SHALL V体モデルに動きを適用する
4. WHEN V体の動きが更新される THEN システム SHALL React Three Fiberを使用して3D描画を更新する
5. WHEN 音声が入力される THEN システム SHALL LiveKitを使用して相手に音声を送信する
6. WHEN 相手のV体データを受信する THEN システム SHALL 相手のV体を自分の画面に表示する

### Requirement 6

**User Story:** ユーザーとして、VroidHubから自分好みのV体を選択・設定したい、そうすることで個性を表現できる

#### Acceptance Criteria

1. WHEN ユーザーがV体設定画面にアクセスする THEN システム SHALL VroidHubから利用可能なVRMファイルの一覧を表示する
2. WHEN ユーザーがV体を選択する THEN システム SHALL プレビュー表示を提供する
3. WHEN ユーザーがV体を確定する THEN システム SHALL VRMファイルをCloudflare R2にアップロードする
4. WHEN V体の設定が完了する THEN システム SHALL ユーザープロフィールにV体IDを保存する
5. WHEN カスタムVRMをアップロードする THEN システム SHALL ファイル形式とサイズを検証する

### Requirement 7

**User Story:** ユーザーとして、安定したビデオ通話品質を体験したい、そうすることでストレスなくコミュニケーションできる

#### Acceptance Criteria

1. WHEN ビデオ通話が開始される THEN システム SHALL LiveKit Cloudを使用してSFU接続を確立する
2. WHEN ネットワーク品質が低下する THEN システム SHALL 自動的に品質を調整する
3. WHEN 接続が不安定になる THEN システム SHALL 再接続を試行する
4. WHEN 音声品質に問題がある THEN システム SHALL ノイズキャンセリングを適用する
5. WHEN 通話中にエラーが発生する THEN システム SHALL エラー内容をユーザーに通知し、復旧手順を提示する

### Requirement 8

**User Story:** ユーザーとして、レスポンシブなUIでモバイルデバイスからもアクセスしたい、そうすることでいつでもどこでも利用できる

#### Acceptance Criteria

1. WHEN ユーザーがモバイルデバイスでアクセスする THEN システム SHALL モバイル最適化されたUIを表示する
2. WHEN タブレットでアクセスする THEN システム SHALL タブレット向けのレイアウトを適用する
3. WHEN デスクトップでアクセスする THEN システム SHALL フル機能のデスクトップUIを表示する
4. WHEN 画面サイズが変更される THEN システム SHALL 動的にレイアウトを調整する
5. WHEN タッチ操作を行う THEN システム SHALL タッチフレンドリーなインタラクションを提供する