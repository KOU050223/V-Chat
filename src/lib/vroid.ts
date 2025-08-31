// VRoid Hub API クライアント（公式APIドキュメントv11準拠）


interface VRoidUser {
  id: string;
  pixiv_user_id: string;
  name: string;
  icon: {
    is_default_image: boolean;
    sq170: { url: string; url2x?: string | null; width: number; height: number };
    sq50: { url: string; url2x?: string | null; width: number; height: number };
  };
}

interface VRoidCharacterModel {
  id: string;
  name: string | null;
  is_private: boolean;
  is_downloadable: boolean;
  is_comment_off: boolean;
  is_other_users_available: boolean;
  is_other_users_allow_viewer_preview: boolean;
  is_hearted: boolean;
  portrait_image: {
    is_default_image: boolean;
    original: { url: string; url2x?: string | null; width: number; height: number };
    w600: { url: string; url2x?: string | null; width: number; height: number };
    w300: { url: string; url2x?: string | null; width: number; height: number };
    sq600: { url: string; url2x?: string | null; width: number; height: number };
    sq300: { url: string; url2x?: string | null; width: number; height: number };
    sq150: { url: string; url2x?: string | null; width: number; height: number };
  };
  full_body_image: {
    is_default_image: boolean;
    original: { url: string; url2x?: string | null; width: number; height: number };
    w600: { url: string; url2x?: string | null; width: number; height: number };
    w300: { url: string; url2x?: string | null; width: number; height: number };
  };
  character: {
    id: string;
    name: string;
    is_private: boolean;
    created_at: string;
    published_at: string | null;
    user: VRoidUser;
  };
  license?: {
    modification: 'default' | 'disallow' | 'allow';
    redistribution: 'default' | 'disallow' | 'allow';
    credit: 'default' | 'necessary' | 'unnecessary';
    characterization_allowed_user: 'default' | 'author' | 'everyone';
    sexual_expression: 'default' | 'disallow' | 'allow';
    violent_expression: 'default' | 'disallow' | 'allow';
    corporate_commercial_use: 'default' | 'disallow' | 'allow';
    personal_commercial_use: 'default' | 'disallow' | 'profit' | 'nonprofit';
  };
  created_at: string;
  published_at: string | null;
  heart_count: number;
  download_count: number;
  usage_count: number;
  view_count: number;
  tags: Array<{
    name: string;
    locale: string | null;
    en_name: string | null;
    ja_name: string | null;
  }>;
  age_limit: {
    is_r18: boolean;
    is_r15: boolean;
    is_adult: boolean;
  };
}

interface VRoidAPIResponse<T> {
  data: T;
  error?: {
    code: string;
    message: string;
  };
  _links?: {
    next?: { href: string };
    prev?: { href: string };
  };
}

interface VRoidDownloadLicense {
  id?: string; // ライセンスID
  url?: string; // ダウンロードURL（古いAPI用）
  download_url?: string; // ダウンロードURL（新しいAPI用）
  expires_at: string;
  character_model_id?: string;
  character_model_version_id?: string;
  is_public_visibility?: boolean;
  is_private_visibility?: boolean;
}

export class VRoidAPI {
  private baseURL = '/api/vroid/proxy';
  private accessToken?: string;
  private refreshToken?: string;

  constructor(accessToken?: string, refreshToken?: string) {
    this.accessToken = accessToken;
    this.refreshToken = refreshToken;
  }

  /**
   * アクセストークンを取得
   */
  getAccessToken(): string | undefined {
    return this.accessToken;
  }

  /**
   * 認証済みAPIリクエストを送信
   */
  private async authenticatedRequest<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    // アクセストークンの存在確認
    if (!this.accessToken) {
      throw new Error('VRoidアクセストークンが設定されていません');
    }
    const method = options.method || 'GET';
    
    // サーバーサイド（Node.js）環境かクライアントサイド環境かを判定
    const isServerSide = typeof window === 'undefined';
    const baseUrl = isServerSide 
      ? `${process.env.VROID_API_BASE_URL || process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/vroid/proxy`
      : (process.env.NEXT_PUBLIC_VROID_API_BASE_URL || '/api/vroid/proxy');
    
    let url = `${baseUrl}?endpoint=${encodeURIComponent(endpoint)}`;
    if (method !== 'GET') {
      url += `&method=${method}`;
    }

    const fetchOptions: RequestInit = {
      method: method === 'GET' ? 'GET' : method === 'DELETE' ? 'DELETE' : 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    };

    // POST/PUT/PATCHリクエストの場合、bodyをJSONとして送信
    if (method === 'POST' || method === 'PUT' || method === 'PATCH') {
      fetchOptions.body = JSON.stringify({
        endpoint,
        data: options.body ? JSON.parse(options.body as string) : undefined,
      });
    }

    const response = await fetch(url, fetchOptions);

    // 403エラーの場合は警告レベル、それ以外は通常ログ
    if (response.status === 403) {
      console.warn('VRoid API Permission Response:', {
        endpoint,
        status: response.status,
        statusText: response.statusText,
      });
    } else {
      console.log('VRoid API Response:', {
        endpoint,
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries()),
      });
    }

    if (!response.ok) {
      const errorText = await response.text();
      
      // 403エラー（権限不足）の場合は警告レベルでログ出力
      if (response.status === 403) {
        console.warn('VRoid API Permission Error:', {
          status: response.status,
          statusText: response.statusText,
          errorText,
          endpoint,
          url,
        });
      } else {
        console.error('VRoid API Error Response:', {
          status: response.status,
          statusText: response.statusText,
          errorText,
          endpoint,
          url,
        });
      }
      
      let errorData;
      try {
        errorData = JSON.parse(errorText);
      } catch {
        errorData = { error: errorText || 'Unknown error' };
      }
      
      // 特定のHTTPステータスに基づく詳細エラーメッセージ
      if (response.status === 403) {
        if (errorText.includes('OAUTH_FORBIDDEN') || errorText.includes('OAuth')) {
          throw new Error(`VRoid API OAuth認証エラー (403): VRoid Hub Developer Consoleでアプリケーション設定を確認してください。特に、リダイレクトURIとスコープ設定をチェックしてください。`);
        } else {
          throw new Error(`VRoid API アクセス権限がありません (403): このAPIエンドポイント(${endpoint})へのアクセス権限がありません。VRoid Hub Developer Consoleでアプリケーションの権限設定を確認してください。`);
        }
      }
      
      if (response.status === 401) {
        throw new Error(`VRoid API 認証エラー (401): アクセストークンが無効または期限切れです。再ログインが必要です。`);
      }
      
      throw new Error(errorData.error || `VRoid API request failed: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();
    
    // VRoid APIのエラーレスポンスをチェック
    if (result.error && result.error.message && result.error.code) {
      // 特定のエラーコードに応じた詳細なメッセージを提供
      const errorCode = result.error.code;
      const errorMessage = result.error.message;
      
      switch (errorCode) {
        case 'OAUTH_FORBIDDEN':
          throw new Error(`OAuth認証エラー: ${errorMessage}. VRoid Hubのアプリケーション設定（リダイレクトURI、スコープ）を確認してください。`);
        case 'INVALID_TOKEN':
          throw new Error(`無効なアクセストークン: ${errorMessage}. 再認証が必要です。`);
        case 'INSUFFICIENT_SCOPE':
          throw new Error(`権限不足: ${errorMessage}. 必要なスコープが不足しています。`);
        default:
          throw new Error(`VRoid API エラー: ${errorCode} - ${errorMessage}`);
      }
    }

    return result;
  }

  /**
   * ユーザー情報を取得
   */
  async getMe(): Promise<VRoidUser> {
    return this.authenticatedRequest<VRoidUser>('/account');
  }

  /**
   * ユーザーが投稿したキャラクターモデル一覧を取得
   */
  async getMyCharacterModels(options: {
    max_id?: string;
    count?: number;
    publication?: 'all' | 'public' | 'private';
  } = {}): Promise<VRoidAPIResponse<VRoidCharacterModel[]>> {
    const params = new URLSearchParams();
    
    if (options.max_id) params.append('max_id', options.max_id);
    if (options.count) params.append('count', options.count.toString());
    if (options.publication) params.append('publication', options.publication);

    return this.authenticatedRequest(
      `/character_models?${params.toString()}`
    );
  }

  /**
   * ユーザーがいいねしたキャラクターモデル一覧を取得
   */
  async getLikedCharacterModels(options: {
    application_id: string;
    max_id?: string;
    count?: number;
    is_downloadable?: boolean;
    characterization_allowed_user?: 'default' | 'author' | 'everyone';
    violent_expression?: 'default' | 'disallow' | 'allow';
    sexual_expression?: 'default' | 'disallow' | 'allow';
    corporate_commercial_use?: 'default' | 'disallow' | 'allow';
    personal_commercial_use?: 'default' | 'disallow' | 'profit' | 'nonprofit';
  }): Promise<VRoidAPIResponse<VRoidCharacterModel[]>> {
    const params = new URLSearchParams();
    
    params.append('application_id', options.application_id);
    if (options.max_id) params.append('max_id', options.max_id);
    if (options.count) params.append('count', options.count.toString());
    if (options.is_downloadable !== undefined) {
      params.append('is_downloadable', options.is_downloadable.toString());
    }
    if (options.characterization_allowed_user) {
      params.append('characterization_allowed_user', options.characterization_allowed_user);
    }
    if (options.violent_expression) {
      params.append('violent_expression', options.violent_expression);
    }
    if (options.sexual_expression) {
      params.append('sexual_expression', options.sexual_expression);
    }
    if (options.corporate_commercial_use) {
      params.append('corporate_commercial_use', options.corporate_commercial_use);
    }
    if (options.personal_commercial_use) {
      params.append('personal_commercial_use', options.personal_commercial_use);
    }

    return this.authenticatedRequest(`/hearts?${params.toString()}`);
  }

  /**
   * 特定のキャラクターモデルの詳細を取得
   */
  async getCharacterModel(modelId: string): Promise<VRoidAPIResponse<VRoidCharacterModel>> {
    return this.authenticatedRequest(`/character_models/${modelId}`);
  }

  /**
   * キャラクターモデルのダウンロードライセンスを取得
   */
  async getCharacterModelDownloadLicense(modelId: string): Promise<VRoidAPIResponse<VRoidDownloadLicense>> {
    console.log('ダウンロードライセンス取得API呼び出し:', modelId);
    
    try {
      // 🎉 新しいPOST /api/download_licenses エンドポイントを優先使用
      // このエンドポイントは `default` スコープで利用可能であることが確認済み
      const result = await this.authenticatedRequest<VRoidAPIResponse<VRoidDownloadLicense>>(
        `/download_licenses`,
        {
          method: 'POST',
          body: JSON.stringify({
            character_model_id: modelId
          })
        }
      );
      
      console.log('ダウンロードライセンス取得API成功 (POST):', result);
      return result;
    } catch (postError: any) {
      console.log('POST /api/download_licenses エラー、GET方式にフォールバック:', postError.message);
      
      try {
        // フォールバック: 従来のGET方式（権限不足の可能性が高い）
        const result = await this.authenticatedRequest<VRoidAPIResponse<VRoidDownloadLicense>>(
          `/character_models/${modelId}/download_license`
        );
        
        console.log('ダウンロードライセンス取得API成功 (GET):', result);
        return result;
      } catch (error: any) {
        console.error('ダウンロードライセンス取得API失敗 (両方式):', {
          modelId,
          postError: postError.message,
          getError: error.message,
          originalError: error
        });
        
        // より具体的なエラーメッセージを追加
        if (error.message.includes('403') || postError.message.includes('403')) {
          throw new Error(`モデル ${modelId} のダウンロード権限がありません。このモデルはダウンロード不可能に設定されているか、あなたがいいねしていない可能性があります。現在のアプリ設定では、いいねしたモデルのみダウンロード可能です。`);
        } else if (error.message.includes('404')) {
          throw new Error(`モデル ${modelId} が見つかりません。モデルIDを確認してください。`);
        } else {
          throw new Error(`ダウンロードライセンス取得に失敗しました: ${error.message}`);
        }
      }
    }
  }

  /**
   * キャラクターモデルを検索
   */
  async searchCharacterModels(options: {
    keyword: string;
    search_after?: string[];
    count?: number;
    sort?: 'relevance' | 'publication_time';
    is_downloadable?: boolean;
    characterization_allowed_user?: 'default' | 'author' | 'everyone';
    violent_expression?: 'default' | 'disallow' | 'allow';
    sexual_expression?: 'default' | 'disallow' | 'allow';
    corporate_commercial_use?: 'default' | 'disallow' | 'allow';
    personal_commercial_use?: 'default' | 'disallow' | 'profit' | 'nonprofit';
  }): Promise<VRoidAPIResponse<VRoidCharacterModel[]>> {
    const params = new URLSearchParams();
    
    params.append('keyword', options.keyword);
    if (options.search_after) {
      options.search_after.forEach(value => {
        params.append('search_after[]', value);
      });
    }
    if (options.count) params.append('count', options.count.toString());
    if (options.sort) params.append('sort', options.sort);
    if (options.is_downloadable !== undefined) {
      params.append('is_downloadable', options.is_downloadable.toString());
    }
    if (options.characterization_allowed_user) {
      params.append('characterization_allowed_user', options.characterization_allowed_user);
    }
    if (options.violent_expression) {
      params.append('violent_expression', options.violent_expression);
    }
    if (options.sexual_expression) {
      params.append('sexual_expression', options.sexual_expression);
    }
    if (options.corporate_commercial_use) {
      params.append('corporate_commercial_use', options.corporate_commercial_use);
    }
    if (options.personal_commercial_use) {
      params.append('personal_commercial_use', options.personal_commercial_use);
    }

    return this.authenticatedRequest(`/search/character_models?${params.toString()}`);
  }

  /**
   * キャラクターモデルにいいね（ハート）を付ける
   */
  async heartCharacterModel(modelId: string): Promise<VRoidAPIResponse<{}>> {
    return this.authenticatedRequest(`/character_models/${modelId}/heart`, {
      method: 'POST',
    });
  }

  /**
   * キャラクターモデルのいいね（ハート）を取り消す
   */
  async unheartCharacterModel(modelId: string): Promise<VRoidAPIResponse<{}>> {
    return this.authenticatedRequest(`/character_models/${modelId}/heart`, {
      method: 'DELETE',
    });
  }
}

/**
 * NextAuthセッションからVRoidAPIクライアントを作成
 */
export function createVRoidClient(session: any): VRoidAPI | null {
  if (!session?.accessToken) {
    return null;
  }

  return new VRoidAPI(session.accessToken, session.refreshToken);
}

export type { VRoidUser, VRoidCharacterModel };