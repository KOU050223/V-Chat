// VRoid Hub API クライアント（公式APIドキュメントv11準拠）

interface VRoidTokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
}

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
  private baseURL = 'https://api.vroid.com/v1';
  private accessToken?: string;
  private refreshToken?: string;

  constructor(accessToken?: string, refreshToken?: string) {
    this.accessToken = accessToken;
    this.refreshToken = refreshToken;
  }

  /**
   * アクセストークンをリフレッシュ
   */
  async refreshAccessToken(): Promise<VRoidTokenResponse> {
    if (!this.refreshToken) {
      throw new Error('Refresh token is not available');
    }

    const response = await fetch('https://oauth2.vroid.com/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: this.refreshToken,
        client_id: process.env.VROID_CLIENT_ID!,
        client_secret: process.env.VROID_CLIENT_SECRET!,
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to refresh token: ${response.status}`);
    }

    const tokenData: VRoidTokenResponse = await response.json();
    this.accessToken = tokenData.access_token;
    this.refreshToken = tokenData.refresh_token;

    return tokenData;
  }

  /**
   * 認証済みAPIリクエストを送信
   */
  private async authenticatedRequest<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    if (!this.accessToken) {
      throw new Error('Access token is not available');
    }

    const response = await fetch(`${this.baseURL}${endpoint}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    // トークンが期限切れの場合、リフレッシュして再試行
    if (response.status === 401 && this.refreshToken) {
      await this.refreshAccessToken();
      return this.authenticatedRequest(endpoint, options);
    }

    if (!response.ok) {
      throw new Error(`API request failed: ${response.status}`);
    }

    return response.json();
  }

  /**
   * ユーザー情報を取得
   */
  async getMe(): Promise<VRoidUser> {
    return this.authenticatedRequest<VRoidUser>('/me');
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
      `/account/character_models?${params.toString()}`
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
  if (!session?.accessToken || session.provider !== 'vroid') {
    return null;
  }

  return new VRoidAPI(session.accessToken, session.refreshToken);
}

export type { VRoidUser, VRoidCharacterModel, VRoidTokenResponse };