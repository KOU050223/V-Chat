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
  url: string;
  expires_at: string;
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
   * 認証済みAPIリクエストを送信
   */
  private async authenticatedRequest<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const method = options.method || 'GET';
    
    let url = `${this.baseURL}?endpoint=${encodeURIComponent(endpoint)}`;
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

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(errorData.error || `API request failed: ${response.status}`);
    }

    const result = await response.json();
    
    // VRoid APIのエラーレスポンスをチェック
    if (result.error && result.error.message && result.error.code) {
      throw new Error(`VRoid API エラー: ${result.error.code} - ${result.error.message}`);
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
    return this.authenticatedRequest(
      `/character_models/${modelId}/download_license`
    );
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

  return new VRoidAPI();
}

export type { VRoidUser, VRoidCharacterModel };