import React from 'react';
import VRMViewer from '@/components/vmodel/VRMViewer';
import VRMDisplayManager from '@/lib/vrmDisplayManager';
import { Button } from '@/components/ui/button';
import { VRoidCharacterModel } from '@/lib/vroid';

/**
 * VRM表示の使用例
 */

// 💡 推奨: モデルIDを使用（URL直接読み込み + 賢いキャッシュ）
function RecommendedVRMDisplay({ model }: { model: VRoidCharacterModel }) {
  const [errorDetails, setErrorDetails] = React.useState<string | null>(null);
  
  return (
    <div className="space-y-2">
      <VRMViewer
        modelId={model.id}
        modelName={model.name || undefined}
        useCache={true} // キャッシュ有効
        width={400}
        height={600}
        onLoadStart={() => {
          console.log('VRM loading started');
          setErrorDetails(null);
        }}
        onLoadComplete={(vrm) => {
          console.log('VRM loaded:', vrm);
          setErrorDetails(null);
        }}
        onLoadError={(error) => {
          console.error('VRM load error:', error);
          setErrorDetails(error.message || String(error));
        }}
      />
      
      {errorDetails && (
        <div className="p-3 bg-red-50 border border-red-200 rounded text-sm">
          <div className="font-semibold text-red-800">エラー詳細:</div>
          <div className="text-red-700 mt-1">{errorDetails}</div>
          {model.is_hearted ? null : (
            <div className="text-red-600 mt-2 text-xs">
              💡 ヒント: このモデルにいいね（ハート）していない場合、アクセスできない可能性があります
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// 🔄 レガシー: URL直接指定（既存コードとの互換性）
function LegacyVRMDisplay({ vrmUrl }: { vrmUrl: string }) {
  const [errorDetails, setErrorDetails] = React.useState<string | null>(null);
  
  return (
    <div className="space-y-2">
      <VRMViewer
        vrmUrl={vrmUrl}
        useCache={false} // キャッシュなし
        width={400}
        height={600}
        onLoadStart={() => setErrorDetails(null)}
        onLoadError={(error) => setErrorDetails(error.message || String(error))}
      />
      
      {errorDetails && (
        <div className="p-3 bg-red-50 border border-red-200 rounded text-sm">
          <div className="font-semibold text-red-800">読み込みエラー:</div>
          <div className="text-red-700 mt-1">{errorDetails}</div>
          <div className="text-red-600 mt-2 text-xs">
            💡 ヒント: CORSポリシーやネットワークの問題が原因の可能性があります
          </div>
        </div>
      )}
    </div>
  );
}

// 💾 特殊: Blob直接指定（ダウンロード済みファイル）
function BlobVRMDisplay({ vrmBlob }: { vrmBlob: Blob }) {
  return (
    <VRMViewer
      vrmBlob={vrmBlob}
      width={400}
      height={600}
    />
  );
}

// 🎮 インタラクティブ: ダウンロード機能付き
function InteractiveVRMDisplay({ model }: { model: VRoidCharacterModel }) {
  const handleDownload = async () => {
    const displayManager = new VRMDisplayManager();
    await displayManager.downloadVRM(model.id, model.name || undefined);
  };

  return (
    <div className="space-y-4">
      <VRMViewer
        modelId={model.id}
        modelName={model.name || undefined}
        useCache={true}
        width={400}
        height={600}
      />
      
      <div className="flex gap-2">
        <Button onClick={handleDownload}>
          📥 VRMダウンロード
        </Button>
        
        <Button variant="outline" onClick={() => {
          // キャッシュ情報表示
          const displayManager = new VRMDisplayManager();
          displayManager.getCacheInfo().then(console.log);
        }}>
          💾 キャッシュ情報
        </Button>
      </div>
    </div>
  );
}

export {
  RecommendedVRMDisplay,
  LegacyVRMDisplay,
  BlobVRMDisplay,
  InteractiveVRMDisplay
};
