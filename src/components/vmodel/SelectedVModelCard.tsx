'use client';

import { useState } from 'react';
import Image from 'next/image';
import { useVRoidModels } from '@/hooks/useVRoidModels';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import VModelSelector from './VModelSelector';
import { Download, Heart, ExternalLink } from 'lucide-react';

interface SelectedVModelCardProps {
  showChangeButton?: boolean;
}

export default function SelectedVModelCard({ showChangeButton = true }: SelectedVModelCardProps) {
  const { selectedModel, isConnected, getDownloadUrl, toggleHeart } = useVRoidModels();
  const [isDownloading, setIsDownloading] = useState(false);

  if (!isConnected) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>V体設定</CardTitle>
          <CardDescription>
            VRoidアカウントを連携してV体を選択してください
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (!selectedModel) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>V体未選択</CardTitle>
          <CardDescription>
            使用するVRMアバターを選択してください
          </CardDescription>
        </CardHeader>
        <CardContent>
          {showChangeButton && (
            <VModelSelector onModelSelect={(model) => {
              console.log('モデルが選択されました:', model);
            }} />
          )}
        </CardContent>
      </Card>
    );
  }

  const handleDownload = async () => {
    if (!selectedModel.is_downloadable) return;

    setIsDownloading(true);
    try {
      const downloadUrl = await getDownloadUrl(selectedModel.id);
      
      // ダウンロードリンクを作成してクリック
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = `${selectedModel.name || 'vroid-model'}.vrm`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error: any) {
      console.error('ダウンロードエラー:', error);
      alert(error.message);
    } finally {
      setIsDownloading(false);
    }
  };

  const handleToggleHeart = async () => {
    try {
      await toggleHeart(selectedModel.id, selectedModel.is_hearted);
    } catch (error: any) {
      console.error('いいね切り替えエラー:', error);
      alert(error.message);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>選択中のV体</CardTitle>
            <CardDescription>
              現在使用中のVRMアバター
            </CardDescription>
          </div>
          {showChangeButton && (
            <VModelSelector onModelSelect={(model) => {
              console.log('モデルが変更されました:', model);
            }} />
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex space-x-4">
          {/* アバター画像 */}
          <div className="relative flex-shrink-0">
            <Image
              src={selectedModel.portrait_image.sq150.url}
              alt={selectedModel.name || 'VRoidモデル'}
              width={120}
              height={120}
              className="rounded-lg object-cover"
            />
            {selectedModel.is_private && (
              <Badge 
                variant="outline" 
                className="absolute top-1 left-1 text-xs"
              >
                非公開
              </Badge>
            )}
          </div>

          {/* モデル情報 */}
          <div className="flex-1 space-y-3">
            <div>
              <h3 className="font-semibold text-lg line-clamp-2">
                {selectedModel.name || '無題のモデル'}
              </h3>
              <p className="text-sm text-gray-600">
                作成者: {selectedModel.character.user.name}
              </p>
            </div>

            {/* 統計情報 */}
            <div className="flex space-x-4 text-sm text-gray-500">
              <div className="flex items-center space-x-1">
                <Heart className="h-4 w-4" />
                <span>{selectedModel.heart_count}</span>
              </div>
              <div className="flex items-center space-x-1">
                <Download className="h-4 w-4" />
                <span>{selectedModel.download_count}</span>
              </div>
              <div className="flex items-center space-x-1">
                <ExternalLink className="h-4 w-4" />
                <span>{selectedModel.view_count}</span>
              </div>
            </div>

            {/* ライセンス情報 */}
            {selectedModel.license && (
              <div className="flex flex-wrap gap-1">
                {selectedModel.license.modification !== 'default' && (
                  <Badge variant="secondary" className="text-xs">
                    改変: {selectedModel.license.modification === 'allow' ? '可' : '不可'}
                  </Badge>
                )}
                {selectedModel.license.redistribution !== 'default' && (
                  <Badge variant="secondary" className="text-xs">
                    再配布: {selectedModel.license.redistribution === 'allow' ? '可' : '不可'}
                  </Badge>
                )}
                {selectedModel.license.personal_commercial_use !== 'default' && (
                  <Badge variant="secondary" className="text-xs">
                    商用利用: {selectedModel.license.personal_commercial_use === 'disallow' ? '不可' : '可'}
                  </Badge>
                )}
              </div>
            )}

            {/* アクションボタン */}
            <div className="flex space-x-2">
              {selectedModel.is_downloadable && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleDownload}
                  disabled={isDownloading}
                >
                  {isDownloading ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600"></div>
                  ) : (
                    <>
                      <Download className="h-4 w-4 mr-1" />
                      ダウンロード
                    </>
                  )}
                </Button>
              )}
              
              <Button
                size="sm"
                variant="outline"
                onClick={handleToggleHeart}
              >
                <Heart 
                  className={`h-4 w-4 mr-1 ${
                    selectedModel.is_hearted ? 'fill-red-500 text-red-500' : ''
                  }`} 
                />
                {selectedModel.is_hearted ? 'いいね解除' : 'いいね'}
              </Button>

              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  window.open(`https://hub.vroid.com/characters/${selectedModel.character.id}/models/${selectedModel.id}`, '_blank');
                }}
              >
                <ExternalLink className="h-4 w-4 mr-1" />
                VRoid Hubで見る
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}