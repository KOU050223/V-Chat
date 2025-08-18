# Redisサーバー立ち上げガイド

## 概要

V-Chatプロジェクトでは、ランダムマッチング機能の実装にRedisを使用しています。このドキュメントでは、開発環境でRedisサーバーを立ち上げる方法を説明します。

## Redisとは

Redisは、インメモリデータストアで、キー・バリューベースのNoSQLデータベースです。V-Chatでは以下の用途で使用しています：

- マッチングキューの管理
- リアルタイムなユーザー状態の同期
- セッション管理

## インストール方法

### Windows

#### 1. WSL2を使用する方法（推奨）

```bash
# WSL2をインストール（まだの場合）
wsl --install

# Ubuntuディストリビューションをインストール
wsl --install -d Ubuntu

# WSL2でUbuntuを起動
wsl

# パッケージリストを更新
sudo apt update

# Redisをインストール
sudo apt install redis-server

# Redisサービスを開始
sudo service redis-server start

# Redisが正常に動作しているか確認
redis-cli ping
# 応答: PONG
```

#### 2. Dockerを使用する方法

```bash
# Docker Desktopをインストール（まだの場合）
# https://www.docker.com/products/docker-desktop/

# Redisコンテナを起動
docker run --name redis-server -p 6379:6379 -d redis:latest

# コンテナが起動しているか確認
docker ps

# Redisに接続してテスト
docker exec -it redis-server redis-cli ping
# 応答: PONG
```

#### 3. Windows用Redis（非推奨）

```bash
# Chocolateyを使用
choco install redis-64

# または、GitHubから直接ダウンロード
# https://github.com/microsoftarchive/redis/releases
```

### macOS

```bash
# Homebrewを使用
brew install redis

# Redisサービスを開始
brew services start redis

# または手動で開始
redis-server /usr/local/etc/redis.conf

# Redisが正常に動作しているか確認
redis-cli ping
# 応答: PONG
```

### Linux (Ubuntu/Debian)

```bash
# パッケージリストを更新
sudo apt update

# Redisをインストール
sudo apt install redis-server

# Redisサービスを開始
sudo systemctl start redis-server

# 自動起動を有効化
sudo systemctl enable redis-server

# Redisが正常に動作しているか確認
redis-cli ping
# 応答: PONG
```

## 設定

### 基本的な設定ファイル

Redisの設定ファイルは通常以下の場所にあります：

- **Windows (WSL2)**: `/etc/redis/redis.conf`
- **macOS**: `/usr/local/etc/redis.conf`
- **Linux**: `/etc/redis/redis.conf`

### 開発環境用の設定

```conf
# redis.conf
# ポート設定
port 6379

# バインディング（すべてのインターフェースでリッスン）
bind 0.0.0.0

# パスワード認証（開発環境では無効化）
# requirepass your_password

# データベース数
databases 16

# 永続化設定（開発環境では無効化可能）
save 900 1
save 300 10
save 60 10000

# ログレベル
loglevel notice

# ログファイル
logfile /var/log/redis/redis-server.log

# データディレクトリ
dir /var/lib/redis
```

## 起動方法

### サービスとして起動

```bash
# Linux/macOS
sudo systemctl start redis-server
# または
brew services start redis

# Windows (WSL2)
sudo service redis-server start
```

### 手動で起動

```bash
# デフォルト設定で起動
redis-server

# カスタム設定ファイルで起動
redis-server /path/to/redis.conf

# バックグラウンドで起動
redis-server --daemonize yes
```

### Dockerで起動

```bash
# 基本的な起動
docker run --name redis-server -p 6379:6379 -d redis:latest

# カスタム設定で起動
docker run --name redis-server \
  -p 6379:6379 \
  -v /path/to/redis.conf:/usr/local/etc/redis/redis.conf \
  -d redis:latest redis-server /usr/local/etc/redis/redis.conf

# データ永続化付きで起動
docker run --name redis-server \
  -p 6379:6379 \
  -v redis-data:/data \
  -d redis:latest
```

## 接続テスト

### redis-cliを使用

```bash
# Redisに接続
redis-cli

# 基本的なコマンドテスト
127.0.0.1:6379> ping
PONG

127.0.0.1:6379> set test "Hello Redis"
OK

127.0.0.1:6379> get test
"Hello Redis"

127.0.0.1:6379> del test
(integer) 1

127.0.0.1:6379> exit
```

### プログラムから接続

```bash
# Node.jsでテスト
node -e "
const Redis = require('redis');
const client = Redis.createClient();

client.on('connect', () => {
  console.log('Redisに接続しました');
  client.set('test', 'Hello from Node.js', (err, reply) => {
    if (err) console.error(err);
    else console.log('SET:', reply);
    
    client.get('test', (err, reply) => {
      if (err) console.error(err);
      else console.log('GET:', reply);
      client.quit();
    });
  });
});

client.on('error', (err) => {
  console.error('Redis接続エラー:', err);
});
"
```

## V-Chatプロジェクトでの使用

### 環境変数の設定

`.env.local`ファイルに以下を追加：

```env
# Redis設定
REDIS_URL=redis://localhost:6379
# または
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
```

### プロジェクトでの接続確認

```bash
# プロジェクトディレクトリで
npm run dev

# ブラウザで http://localhost:3000/matching にアクセス
# コンソールでRedis接続ログを確認
```

## トラブルシューティング

### よくある問題

#### 1. ポート6379が既に使用されている

```bash
# ポートの使用状況を確認
netstat -tulpn | grep 6379
# または
lsof -i :6379

# 既存のRedisプロセスを停止
sudo systemctl stop redis-server
# または
sudo pkill redis-server
```

#### 2. 権限エラー

```bash
# Redisディレクトリの権限を確認
ls -la /var/lib/redis
ls -la /var/log/redis

# 権限を修正
sudo chown -R redis:redis /var/lib/redis
sudo chown -R redis:redis /var/log/redis
```

#### 3. 接続できない

```bash
# Redisが起動しているか確認
sudo systemctl status redis-server

# ファイアウォールの設定を確認
sudo ufw status

# Redisの設定でbindアドレスを確認
grep bind /etc/redis/redis.conf
```

### ログの確認

```bash
# Redisログを確認
sudo tail -f /var/log/redis/redis-server.log

# システムログでRedis関連を確認
sudo journalctl -u redis-server -f
```

## 本番環境での考慮事項

### セキュリティ

```conf
# redis.conf
# パスワード認証を有効化
requirepass strong_password_here

# 危険なコマンドを無効化
rename-command FLUSHDB ""
rename-command FLUSHALL ""
rename-command CONFIG ""

# ネットワークアクセスを制限
bind 127.0.0.1
```

### パフォーマンス

```conf
# redis.conf
# メモリ制限
maxmemory 256mb
maxmemory-policy allkeys-lru

# 永続化設定
save 900 1
save 300 10
save 60 10000

# ログレベル
loglevel warning
```

### 監視

```bash
# Redis情報を確認
redis-cli info

# メモリ使用量を確認
redis-cli info memory

# 接続数を確認
redis-cli info clients
```

## 参考リンク

- [Redis公式ドキュメント](https://redis.io/documentation)
- [Redis GitHub](https://github.com/redis/redis)
- [Redis Docker Hub](https://hub.docker.com/_/redis)
- [Node.js Redisクライアント](https://github.com/redis/node-redis)

## まとめ

このドキュメントで説明した手順に従って、開発環境でRedisサーバーを立ち上げることができます。V-Chatプロジェクトのランダムマッチング機能を正常に動作させるために、Redisサーバーが起動していることを確認してください。

問題が発生した場合は、トラブルシューティングセクションを参照するか、ログを確認して原因を特定してください。
