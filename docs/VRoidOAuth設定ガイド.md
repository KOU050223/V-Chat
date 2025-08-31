# VRoid Hub OAuth設定・トラブルシューティングガイド

## 🚨 OAuth 403エラー "OAUTH_FORBIDDEN" の解決方法

**重要**: このエラーは断続的に発生し、時々成功することがあります。これはVRoid Hub側のアクセス制御やレート制限によるものです。

### 1. VRoid Hub開発者アプリケーション設定を確認

#### アプリケーション作成手順
1. [VRoid Hub Developer Console](https://hub.vroid.com/oauth/applications/) にアクセス
2. 新しいアプリケーションを作成
3. 以下の設定を正確に入力：

#### 重要な設定項目

**アプリケーション名**
```
V-Chat (または任意の名前)
```

**リダイレクトURI**
```
# 開発環境
http://localhost:3000/api/auth/callback/vroid

# 本番環境（例）
https://your-domain.com/api/auth/callback/vroid
```

**スコープ**
```
default
```

### 2. 環境変数の設定確認

`.env.local` ファイルで以下を確認：

```bash
# VRoid Hub OAuth設定
VROID_CLIENT_ID=your_actual_client_id
VROID_CLIENT_SECRET=your_actual_client_secret
NEXT_PUBLIC_VROID_CLIENT_ID=your_actual_client_id

# NextAuth設定
NEXTAUTH_URL=http://localhost:3000  # 本番環境では実際のドメイン
NEXTAUTH_SECRET=your_secure_random_string

# デバッグ用（開発時のみ）
NEXTAUTH_DEBUG=true
```

### 3. よくある設定ミス

#### リダイレクトURIの不一致
❌ **間違った例:**
```
http://localhost:3000/auth/callback/vroid
https://localhost:3000/api/auth/callback/vroid
http://localhost:3000/api/auth/callback
```

✅ **正しい例:**
```
http://localhost:3000/api/auth/callback/vroid
```

#### 環境変数の設定ミス
❌ **よくある間違い:**
- `VROID_CLIENT_ID` と `NEXT_PUBLIC_VROID_CLIENT_ID` の値が異なる
- 環境変数名のタイポ
- クライアントシークレットの露出

✅ **正しい設定:**
- 同じClient IDを両方の変数に設定
- Client Secretは `VROID_CLIENT_SECRET` のみに設定（NEXT_PUBLICは不要）

#### スコープの問題
❌ **使用できないスコープ:**
```
read write admin
```

✅ **正しいスコープ:**
```
default
```

### 4. デバッグ手順

#### Step 1: 環境変数の確認
開発サーバーを起動して、コンソールログを確認：

```bash
npm run dev
```

以下のようなログが出力されるか確認：
```
NextAuth config loaded
VROID_CLIENT_ID: ✓ 設定済み
VROID_CLIENT_SECRET: ✓ 設定済み
NEXTAUTH_SECRET: ✓ 設定済み
NEXTAUTH_URL: http://localhost:3000
Expected redirect URI: http://localhost:3000/api/auth/callback/vroid
```

#### Step 2: OAuth認証フローのテスト
1. アプリにアクセス
2. VRoid Hubでログインを試行
3. ブラウザの開発者ツール（Network/Console）でエラー詳細を確認

#### Step 3: VRoid Hub側での確認
1. [VRoid Hub](https://hub.vroid.com) にログイン
2. 設定 → 連携アプリ で、アプリケーションが表示されているか確認
3. 必要に応じて連携を解除して再認証

### 5. API権限の確認

#### 利用可能なAPI（defaultスコープ）
- ✅ ユーザー情報取得 (`/api/account`)
- ✅ 投稿モデル一覧 (`/api/character_models`)
- ✅ いいねモデル一覧 (`/api/hearts`)
- ✅ モデル詳細 (`/api/character_models/{id}`)
- ✅ ダウンロードライセンス (`/api/character_models/{id}/download_license`)

#### 利用不可な機能
- ❌ 管理者機能
- ❌ 他ユーザーの非公開データ
- ❌ 投稿・編集・削除操作

### 6. エラーメッセージ別対処法

#### "OAuth forbidden"
- **原因**: リダイレクトURIの不一致、無効なClient ID/Secret
- **対処**: VRoid Hub Developer Consoleで設定を再確認

#### "Invalid token"
- **原因**: アクセストークンの有効期限切れ
- **対処**: 再認証が必要（ログアウト→再ログイン）

#### "Insufficient scope"
- **原因**: 必要なスコープが不足
- **対処**: アプリケーション設定でスコープを確認・修正

### 7. 開発環境での注意点

#### HTTPSの問題
- ローカル開発では `http://localhost` が許可される
- 本番環境では必ず `https://` を使用

#### ポート番号
- 開発環境: `http://localhost:3000`
- カスタムポート使用時は設定を合わせる

#### キャッシュのクリア
- ブラウザのキャッシュをクリア
- NextAuthのセッションをクリア：`.next` フォルダを削除

### 8. 断続的な403エラーの対処法

#### 判明した事実
- **パターン**: 同じAPIエンドポイントが時々200 OK、時々403 OAUTH_FOBIDDENを返す
- **原因**: VRoid Hub側のレート制限、アクセス制御、または開発者アプリケーションのステータス
- **影響範囲**: `/character_models` と `/hearts` の両方で発生

#### 対処方法

**1. アプリケーションステータスの確認**
- [VRoid Hub Developer Console](https://hub.vroid.com/oauth/applications/) にログイン
- アプリケーションが「承認済み」または「審査中」かを確認
- 必要に応じて本人確認や審査プロセスを完了

**2. 利用制限の確認**
- 個人開発者 vs 企業開発者の権限の違いを確認
- API利用上限に達していないかチェック
- 連続したリクエストを避ける（間隔を空ける）

**3. エラー処理の実装**
```typescript
// リトライ機能付きのAPI呼び出し
async function fetchWithRetry(apiCall: () => Promise<any>, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await apiCall();
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      
      // OAUTH_FOBIDDENの場合は少し待ってリトライ
      if (error.message.includes('OAUTH_FORBIDDEN')) {
        await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
      }
    }
  }
}
```

**4. 代替手段の準備**
- いいねしたモデルが取得できない場合は、検索機能を使用
- マイモデルが取得できない場合は、外部VRMファイルのアップロード機能を提供
- エラー時のグレースフルな画面表示

### 9. 本番環境へのデプロイ

#### Vercelの場合
1. Environment Variables設定で全ての環境変数を設定
2. `NEXTAUTH_URL` を本番ドメインに変更
3. VRoid Hub側のリダイレクトURIも本番ドメインに追加

#### その他の注意点
- Production環境では `NEXTAUTH_DEBUG=false` に設定
- Client Secretは絶対に公開しない
- 定期的にCredentialをローテーション

### 9. よくある質問

**Q: 複数の環境（開発・ステージング・本番）で同じアプリケーションを使えますか？**
A: 可能ですが、リダイレクトURIにすべての環境のURLを登録する必要があります。

**Q: モデルのダウンロードに追加の権限が必要ですか？**
A: `default` スコープで利用可能です。ただし、モデルの利用条件（ライセンス）は確認が必要です。

**Q: 認証エラーが継続する場合は？**
A: 
1. VRoid Hub側でアプリケーションを削除・再作成
2. 新しいClient ID/Secretで環境変数を更新
3. ブラウザのセッション・キャッシュをすべてクリア

### 11. 実装状況と制限事項

#### 現在の実装状況 ✅
- VRoid Hub OAuth認証: **完全実装済み**
- いいねしたモデル取得: **断続的に動作** (API制限により時々403エラー)
- 投稿モデル取得: **断続的に動作** (API制限により時々403エラー) 
- VRMファイルダウンロード: **実装済み** (ライセンス取得後)
- IndexedDBキャッシュ: **実装済み** (効率的なファイル管理)
- エラーハンドリング: **実装済み** (ユーザーフレンドリーなメッセージ)

#### 既知の制限事項 ⚠️
- **API権限の不安定性**: VRoid Hub側のアクセス制御により、同一エンドポイントでも時々403エラーが発生
- **開発者アプリケーションの審査**: 一部のAPIは承認プロセスが必要な場合がある
- **レート制限**: 連続したAPIリクエストは制限される可能性がある

#### 推奨対処法 💡
1. **エラーが発生した場合**: ページを更新して再試行
2. **継続的なエラー**: VRoid Hub Developer Consoleでアプリケーション状況を確認
3. **代替手段**: 検索機能や外部VRMファイルアップロードを利用

### 12. サポートリソース

- [VRoid Hub Developer API](https://developer.vroid.com/api/)
- [NextAuth.js公式ドキュメント](https://next-auth.js.org/)
- [OAuth 2.0仕様](https://tools.ietf.org/html/rfc6749)

---

## 📋 チェックリスト

OAuth設定を完了するために、以下の項目を確認してください：

- [ ] VRoid Hub Developer Console でアプリケーションを作成
- [ ] リダイレクトURIを正確に設定 (`http://localhost:3000/api/auth/callback/vroid`)
- [ ] スコープを `default` に設定
- [ ] 環境変数ファイル (`.env.local`) に適切な値を設定
- [ ] アプリケーションが承認済み状態であることを確認
- [ ] 認証フローをテストして動作確認
- [ ] エラー時のフォールバック動作を理解

**トラブルが解決しない場合は、コンソールログとネットワークタブの詳細なエラー情報を確認して、上記のチェックリストを再度見直してください。**