'use client';

import { useState } from 'react';
import Image from 'next/image';
import { useVRoidModels } from '@/hooks/useVRoidModels';
import { VRoidCharacterModel } from '@/lib/vroid';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle,
  DialogTrigger 
} from '@/components/ui/dialog';
import { Heart, Download, Search, RefreshCw } from 'lucide-react';

interface VModelSelectorProps {
  onModelSelect?: (model: VRoidCharacterModel | null) => void;
}

export default function VModelSelector({ onModelSelect }: VModelSelectorProps) {
  const {
    myModels,
    likedModels,
    selectedModel,
    loading,
    error,
    isConnected,
    selectModel,
    searchModels,
    getDownloadLicense,
    toggleHeart,
    refresh,
    clearError,
  } = useVRoidModels({ enableMyModels: false }); // マイモデル取得を無効化

  const [searchKeyword, setSearchKeyword] = useState('');
  const [searchResults, setSearchResults] = useState<VRoidCharacterModel[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [downloadingModels, setDownloadingModels] = useState<Set<string>>(new Set());

  const handleDownload = async (modelId: string) => {
    setDownloadingModels(prev => new Set(prev).add(modelId));
    try {
      const downloadUrl = await getDownloadLicense(modelId);
      
      // ダウンロードリンクを作成してクリック
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = `vroid-model-${modelId}.vrm`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error: any) {
      console.error('ダウンロードエラー:', error);
      alert(error.message);
    } finally {
      setDownloadingModels(prev => {
        const newSet = new Set(prev);
        newSet.delete(modelId);
        return newSet;
      });
    }
  };

  const handleToggleHeart = async (modelId: string, isHearted: boolean) => {
    try {
      await toggleHeart(modelId, isHearted);
    } catch (error: any) {
      console.error('いいね切り替えエラー:', error);
      alert(error.message);
    }
  };

  if (!isConnected) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>V体選択</CardTitle>
          <CardDescription>
            VRoidアカウントの連携が必要です
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-600">
            ダッシュボードでVRoidアカウントを連携してください。
          </p>
        </CardContent>
      </Card>
    );
  }

  // エラー表示を改善
  if (error && (
    error.includes('OAuth認証エラー') || 
    error.includes('アクセス権限がありません') ||
    error.includes('OAUTH_FORBIDDEN')
  )) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>V体選択</CardTitle>
          <CardDescription className="text-red-600">
            VRoid Hub API権限エラー
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="bg-red-50 border border-red-200 rounded-md p-4">
              <h4 className="text-sm font-medium text-red-800 mb-2">権限エラーの詳細</h4>
              <p className="text-sm text-red-700 whitespace-pre-line">{error}</p>
            </div>
            
            <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
              <h4 className="text-sm font-medium text-blue-800 mb-2">対処方法</h4>
              <ol className="text-sm text-blue-700 space-y-1 list-decimal list-inside">
                <li>VRoid Hub Developer Consoleでアプリケーション設定を確認</li>
                <li>リダイレクトURI: <code className="bg-blue-100 px-1 rounded">http://localhost:3000/api/auth/callback/vroid</code></li>
                <li>必要に応じてアプリケーション審査を申請</li>
                <li>現在は「いいねしたモデル」と「検索」機能が利用可能です</li>
              </ol>
            </div>

            <div className="flex space-x-2">
              <Button 
                onClick={refresh} 
                variant="outline" 
                size="sm"
                disabled={loading}
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                再試行
              </Button>
              <Button 
                onClick={() => window.open('https://hub.vroid.com/oauth/applications', '_blank')} 
                variant="outline" 
                size="sm"
              >
                Developer Console
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // マイモデルが取得できない場合の判定
  const hasMyModelsPermission = !error || !error.includes('投稿モデル一覧の取得権限がありません');


  const handleSearch = async () => {
    if (!searchKeyword.trim()) return;

    setSearchLoading(true);
    try {
      const results = await searchModels(searchKeyword);
      setSearchResults(results);
    } catch (error: any) {
      console.error('検索エラー:', error);
    } finally {
      setSearchLoading(false);
    }
  };

  const handleModelSelect = (model: VRoidCharacterModel) => {
    selectModel(model);
    onModelSelect?.(model);
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button className="w-full">
          {selectedModel ? 'V体を変更' : 'V体を選択'}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle>V体選択</DialogTitle>
          <DialogDescription>
            使用するVRMアバターを選択してください
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-md">
            <p className="text-sm">{error}</p>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={clearError}
              className="mt-2"
            >
              閉じる
            </Button>
          </div>
        )}

        <div className="overflow-y-auto">
          <Tabs defaultValue={hasMyModelsPermission ? "my-models" : "liked-models"} className="space-y-4">
            <div className="flex items-center justify-between">
              <TabsList className={`grid w-full max-w-md ${hasMyModelsPermission ? 'grid-cols-3' : 'grid-cols-2'}`}>
                {hasMyModelsPermission && (
                  <TabsTrigger value="my-models">マイモデル</TabsTrigger>
                )}
                <TabsTrigger value="liked-models">いいね</TabsTrigger>
                <TabsTrigger value="search">検索</TabsTrigger>
              </TabsList>
              
              <Button
                variant="outline"
                size="sm"
                onClick={refresh}
                disabled={loading}
              >
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                更新
              </Button>
            </div>

            {hasMyModelsPermission && (
              <TabsContent value="my-models" className="space-y-4">
              <div className="text-sm text-gray-600">
                あなたが投稿したモデル ({myModels.length}件)
              </div>
              {loading ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                  <p className="mt-2 text-sm text-gray-600">読み込み中...</p>
                </div>
              ) : (
                <VModelGrid 
                  models={myModels}
                  selectedModel={selectedModel}
                  onSelect={handleModelSelect}
                  onDownload={handleDownload}
                  onToggleHeart={handleToggleHeart}
                  downloadingModels={downloadingModels}
                />
              )}
            </TabsContent>
            )}

            <TabsContent value="liked-models" className="space-y-4">
              <div className="text-sm text-gray-600">
                いいねしたモデル ({likedModels.length}件)
              </div>
              {loading ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                  <p className="mt-2 text-sm text-gray-600">読み込み中...</p>
                </div>
              ) : (
                <VModelGrid 
                  models={likedModels}
                  selectedModel={selectedModel}
                  onSelect={handleModelSelect}
                  onDownload={handleDownload}
                  onToggleHeart={handleToggleHeart}
                  downloadingModels={downloadingModels}
                />
              )}
            </TabsContent>

            <TabsContent value="search" className="space-y-4">
              <div className="flex space-x-2">
                <Input
                  placeholder="モデルを検索..."
                  value={searchKeyword}
                  onChange={(e) => setSearchKeyword(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                />
                <Button 
                  onClick={handleSearch}
                  disabled={searchLoading || !searchKeyword.trim()}
                >
                  <Search className="h-4 w-4" />
                  検索
                </Button>
              </div>
              
              {searchLoading ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                  <p className="mt-2 text-sm text-gray-600">検索中...</p>
                </div>
              ) : searchResults.length > 0 ? (
                <>
                  <div className="text-sm text-gray-600">
                    検索結果 ({searchResults.length}件)
                  </div>
                  <VModelGrid 
                    models={searchResults}
                    selectedModel={selectedModel}
                    onSelect={handleModelSelect}
                    onDownload={handleDownload}
                    onToggleHeart={handleToggleHeart}
                    downloadingModels={downloadingModels}
                  />
                </>
              ) : searchKeyword && (
                <div className="text-center py-8 text-gray-500">
                  検索結果が見つかりませんでした
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
}

interface VModelGridProps {
  models: VRoidCharacterModel[];
  selectedModel: VRoidCharacterModel | null;
  onSelect: (model: VRoidCharacterModel) => void;
  onDownload: (modelId: string) => void;
  onToggleHeart: (modelId: string, isHearted: boolean) => void;
  downloadingModels: Set<string>;
}

function VModelGrid({ 
  models, 
  selectedModel, 
  onSelect, 
  onDownload, 
  onToggleHeart,
  downloadingModels 
}: VModelGridProps) {
  if (models.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        モデルが見つかりませんでした
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {models.map((model) => (
        <VModelCard
          key={model.id}
          model={model}
          isSelected={selectedModel?.id === model.id}
          onSelect={() => onSelect(model)}
          onDownload={onDownload}
          onToggleHeart={onToggleHeart}
          isDownloading={downloadingModels.has(model.id)}
        />
      ))}
    </div>
  );
}

interface VModelCardProps {
  model: VRoidCharacterModel;
  isSelected: boolean;
  onSelect: () => void;
  onDownload: (modelId: string) => void;
  onToggleHeart: (modelId: string, isHearted: boolean) => void;
  isDownloading: boolean;
}

function VModelCard({ 
  model, 
  isSelected, 
  onSelect, 
  onDownload, 
  onToggleHeart,
  isDownloading 
}: VModelCardProps) {
  return (
    <Card className={`cursor-pointer transition-all ${
      isSelected ? 'ring-2 ring-blue-500 bg-blue-50' : 'hover:shadow-md'
    }`}>
      <div className="relative">
        <Image
          src={model.portrait_image.sq300.url}
          alt={model.name || 'VRoidモデル'}
          width={300}
          height={300}
          className="w-full h-48 object-cover rounded-t-lg"
        />
        {isSelected && (
          <div className="absolute top-2 left-2">
            <Badge className="bg-blue-500">選択中</Badge>
          </div>
        )}
        <div className="absolute top-2 right-2 space-y-1">
          {model.is_downloadable && (
            <Badge variant="secondary" className="text-xs">
              DL可能
            </Badge>
          )}
          {model.is_private && (
            <Badge variant="outline" className="text-xs">
              非公開
            </Badge>
          )}
        </div>
      </div>
      
      <CardContent className="p-4">
        <div className="space-y-2">
          <h3 className="font-medium text-sm line-clamp-2">
            {model.name || '無題のモデル'}
          </h3>
          
          <div className="flex items-center justify-between text-xs text-gray-500">
            <span>❤️ {model.heart_count}</span>
            <span>📥 {model.download_count}</span>
          </div>
          
          <div className="flex space-x-1">
            <Button
              size="sm"
              variant={isSelected ? "default" : "outline"}
              className="flex-1"
              onClick={onSelect}
            >
              {isSelected ? '選択中' : '選択'}
            </Button>
            
            {model.is_downloadable && (
              <Button
                size="sm"
                variant="outline"
                onClick={(e) => {
                  e.stopPropagation();
                  onDownload(model.id);
                }}
                disabled={isDownloading}
              >
                {isDownloading ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600"></div>
                ) : (
                  <Download className="h-4 w-4" />
                )}
              </Button>
            )}
            
            <Button
              size="sm"
              variant="outline"
              onClick={(e) => {
                e.stopPropagation();
                onToggleHeart(model.id, model.is_hearted);
              }}
            >
              <Heart 
                className={`h-4 w-4 ${
                  model.is_hearted ? 'fill-red-500 text-red-500' : ''
                }`} 
              />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}