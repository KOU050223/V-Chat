'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useSession } from 'next-auth/react';
import { VRoidAPI, VRoidCharacterModel, createVRoidClient } from '@/lib/vroid';
import { useVModel } from '@/contexts/VModelContext';

interface UseVRoidModelsOptions {
  autoFetch?: boolean;
  includePrivate?: boolean;
}

interface VRoidModelsState {
  myModels: VRoidCharacterModel[];
  likedModels: VRoidCharacterModel[];
  loading: boolean;
  error: string | null;
}

export function useVRoidModels(options: UseVRoidModelsOptions = {}) {
  const { autoFetch = true, includePrivate = true } = options;
  const { data: session } = useSession();
  const { settings, updateSelectedModel } = useVModel();
  const [state, setState] = useState<VRoidModelsState>({
    myModels: [],
    likedModels: [],
    loading: false,
    error: null,
  });

  const vroidClient = useMemo(() => {
    return createVRoidClient(session);
  }, [session]);

  // マイモデル一覧を取得（リトライ機能付き）
  const fetchMyModels = useCallback(async () => {
    if (!vroidClient) {
      setState(prev => ({ 
        ...prev, 
        error: 'VRoidアカウントが連携されていません',
        loading: false 
      }));
      return;
    }

    const fetchWithRetry = async (retries = 3) => {
      for (let i = 0; i < retries; i++) {
        try {
          setState(prev => ({ ...prev, loading: true, error: null }));
          
          const response = await vroidClient.getMyCharacterModels({
            publication: includePrivate ? 'all' : 'public',
            count: 50,
          });

          setState(prev => ({
            ...prev,
            myModels: response.data,
            loading: false,
          }));
          return; // 成功したら終了
        } catch (error: any) {
          console.error(`マイモデル取得エラー (試行 ${i + 1}):`, error);
          
          // OAUTH_FORBIDDEN エラーの場合
          if (error.message.includes('OAuth認証エラー') || error.message.includes('OAUTH_FORBIDDEN')) {
            if (i < retries - 1) {
              // リトライする場合は少し待つ
              await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
              continue;
            } else {
              // 最終試行でも失敗
              setState(prev => ({
                ...prev,
                error: 'マイモデル一覧の取得権限がありません。VRoid Hub Developer Consoleでアプリケーション審査またはタイプ変更が必要です。現在は「いいねしたモデル」と「検索」をご利用ください。',
                myModels: [],
                loading: false,
              }));
              return;
            }
          } else {
            throw error; // その他のエラーは再スロー
          }
        }
      }
    };

    try {
      await fetchWithRetry();
    } catch (error: any) {
      setState(prev => ({
        ...prev,
        error: 'マイモデルの取得に失敗しました',
        loading: false,
      }));
    }
  }, [vroidClient, includePrivate]);

  // いいねしたモデル一覧を取得
  const fetchLikedModels = useCallback(async () => {
    if (!vroidClient) {
      setState(prev => ({ 
        ...prev, 
        error: 'VRoidアカウントが連携されていません',
        loading: false 
      }));
      return;
    }

    try {
      setState(prev => ({ ...prev, loading: true, error: null }));
      
      const clientId = process.env.NEXT_PUBLIC_VROID_CLIENT_ID;
      if (!clientId) {
        setState(prev => ({
          ...prev,
          error: '環境変数 NEXT_PUBLIC_VROID_CLIENT_ID が設定されていません',
          loading: false,
        }));
        return;
      }
      const response = await vroidClient.getLikedCharacterModels({
        application_id: clientId,
        count: 50,
        is_downloadable: true,
      });

      setState(prev => ({
        ...prev,
        likedModels: response.data,
        loading: false,
      }));
    } catch (error: any) {
      console.error('いいねモデル取得エラー:', error);
      setState(prev => ({
        ...prev,
        error: 'いいねしたモデルの取得に失敗しました',
        loading: false,
      }));
    }
  }, [vroidClient]);

  // モデルを検索
  const searchModels = useCallback(async (keyword: string): Promise<VRoidCharacterModel[]> => {
    if (!vroidClient) {
      throw new Error('VRoidアカウントが連携されていません');
    }

    try {
      const response = await vroidClient.searchCharacterModels({
        keyword,
        count: 20,
        is_downloadable: true,
        sort: 'relevance',
      });

      return response.data;
    } catch (error: any) {
      console.error('モデル検索エラー:', error);
      throw new Error('モデルの検索に失敗しました');
    }
  }, [vroidClient]);

  // モデルを選択
  const selectModel = useCallback((model: VRoidCharacterModel | null) => {
    updateSelectedModel(model);
  }, [updateSelectedModel]);

  // モデルの詳細を取得
  const getModelDetails = useCallback(async (modelId: string): Promise<VRoidCharacterModel> => {
    if (!vroidClient) {
      throw new Error('VRoidアカウントが連携されていません');
    }

    try {
      const response = await vroidClient.getCharacterModel(modelId);
      return response.data;
    } catch (error: any) {
      console.error('モデル詳細取得エラー:', error);
      throw new Error('モデルの詳細取得に失敗しました');
    }
  }, [vroidClient]);

  // モデルのダウンロードライセンスURLを取得
  const getDownloadLicense = useCallback(async (modelId: string): Promise<string> => {
    if (!vroidClient) {
      throw new Error('VRoidアカウントが連携されていません');
    }

    try {
      const response = await vroidClient.getCharacterModelDownloadLicense(modelId);
      return response.data.url;
    } catch (error: any) {
      console.error('ダウンロードライセンス取得エラー:', error);
      throw new Error('ダウンロードライセンスの取得に失敗しました');
    }
  }, [vroidClient]);

  // いいね/いいね解除
  const toggleHeart = useCallback(async (modelId: string, isHearted: boolean): Promise<void> => {
    if (!vroidClient) {
      throw new Error('VRoidアカウントが連携されていません');
    }

    try {
      if (isHearted) {
        await vroidClient.unheartCharacterModel(modelId);
      } else {
        await vroidClient.heartCharacterModel(modelId);
      }
      
      // 状態を更新
      setState(prev => ({
        ...prev,
        myModels: prev.myModels.map(model => 
          model.id === modelId ? { ...model, is_hearted: !isHearted } : model
        ),
        likedModels: prev.likedModels.map(model => 
          model.id === modelId ? { ...model, is_hearted: !isHearted } : model
        ),
      }));
    } catch (error: any) {
      console.error('いいね切り替えエラー:', error);
      throw new Error('いいねの切り替えに失敗しました');
    }
  }, [vroidClient]);

  // 設定からモデル情報を取得する処理は VModelContext で管理されるため削除

  // VRoid連携時に自動でモデルを取得
  useEffect(() => {
    if (autoFetch && vroidClient) {
      fetchMyModels();
      fetchLikedModels();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoFetch, vroidClient]);

  return {
    // 状態
    ...state,
    selectedModel: settings.selectedModel,
    isConnected: !!vroidClient,
    
    // アクション
    fetchMyModels,
    fetchLikedModels,
    searchModels,
    selectModel,
    getModelDetails,
    getDownloadLicense,
    toggleHeart,
    
    // ヘルパー
    refresh: () => {
      fetchMyModels();
      fetchLikedModels();
    },
    clearError: () => setState(prev => ({ ...prev, error: null })),
  };
}