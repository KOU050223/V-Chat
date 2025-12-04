"use client";

import { useState } from "react";
import {
  useVModel,
  exportVModelSettings,
  importVModelSettings,
} from "@/contexts/VModelContext";
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
} from "@/components/ui";
import { Download, Upload, Trash2, Settings } from "lucide-react";

export default function VModelSettings() {
  const { settings, updatePreferences, clearSettings } = useVModel();
  const [importData, setImportData] = useState("");
  const [isImporting, setIsImporting] = useState(false);

  const handleExport = () => {
    try {
      const exportedData = exportVModelSettings();
      const blob = new Blob([exportedData], { type: "application/json" });
      const url = URL.createObjectURL(blob);

      const link = document.createElement("a");
      link.href = url;
      link.download = `v-chat-vmodel-settings-${new Date().toISOString().split("T")[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("設定のエクスポートエラー:", error);
      alert("設定のエクスポートに失敗しました");
    }
  };

  const handleImport = async () => {
    if (!importData.trim()) {
      alert("インポートデータを入力してください");
      return;
    }

    setIsImporting(true);
    try {
      importVModelSettings(importData);
      alert("設定がインポートされました。ページが再読み込みされます。");
    } catch (error) {
      console.error("設定のインポートエラー:", error);
      alert("設定のインポートに失敗しました。データを確認してください。");
    } finally {
      setIsImporting(false);
    }
  };

  const handleClearSettings = () => {
    if (confirm("すべてのV体設定を削除しますか？この操作は取り消せません。")) {
      clearSettings();
      alert("設定がクリアされました");
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Settings className="h-5 w-5" />
            <span>V体設定</span>
          </CardTitle>
          <CardDescription>
            V体の表示や動作に関する設定を管理します
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* 基本設定 */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium">基本設定</h3>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>自動ダウンロード</Label>
                <div className="text-sm text-gray-500">
                  V体選択時に自動的にVRMファイルをダウンロードします
                </div>
              </div>
              <Switch
                checked={settings.preferences.autoDownload}
                onCheckedChange={(checked) =>
                  updatePreferences({ autoDownload: checked })
                }
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>非公開モデルを表示</Label>
                <div className="text-sm text-gray-500">
                  マイモデル一覧で非公開モデルも表示します
                </div>
              </div>
              <Switch
                checked={settings.preferences.showPrivateModels}
                onCheckedChange={(checked) =>
                  updatePreferences({ showPrivateModels: checked })
                }
              />
            </div>

            <div className="space-y-2">
              <Label>デフォルトソート</Label>
              <Select
                value={settings.preferences.defaultSort}
                onValueChange={(value: "latest" | "popular" | "hearts") =>
                  updatePreferences({ defaultSort: value })
                }
              >
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="latest">最新順</SelectItem>
                  <SelectItem value="popular">人気順</SelectItem>
                  <SelectItem value="hearts">いいね順</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* 現在の設定情報 */}
          <div className="space-y-4 pt-4 border-t">
            <h3 className="text-lg font-medium">設定情報</h3>

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <Label>選択中のV体</Label>
                <p className="text-gray-600">
                  {settings.selectedModel
                    ? settings.selectedModel.name || "無題のモデル"
                    : "未選択"}
                </p>
              </div>
              <div>
                <Label>最終更新</Label>
                <p className="text-gray-600">
                  {new Date(settings.lastUpdated).toLocaleString("ja-JP")}
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* データ管理 */}
      <Card>
        <CardHeader>
          <CardTitle>データ管理</CardTitle>
          <CardDescription>
            V体設定のバックアップと復元を行います
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* エクスポート */}
          <div className="space-y-2">
            <Label>設定のエクスポート</Label>
            <div className="flex space-x-2">
              <Button
                onClick={handleExport}
                variant="outline"
                className="flex-1"
              >
                <Download className="h-4 w-4 mr-2" />
                設定をダウンロード
              </Button>
            </div>
            <p className="text-xs text-gray-500">
              現在の設定をJSONファイルとしてダウンロードします
            </p>
          </div>

          {/* インポート */}
          <div className="space-y-2">
            <Label>設定のインポート</Label>
            <div className="space-y-2">
              <Input
                placeholder="エクスポートしたJSONデータを貼り付け..."
                value={importData}
                onChange={(e) => setImportData(e.target.value)}
                className="min-h-[100px]"
                style={{ resize: "vertical" }}
              />
              <Button
                onClick={handleImport}
                disabled={!importData.trim() || isImporting}
                className="w-full"
              >
                <Upload className="h-4 w-4 mr-2" />
                {isImporting ? "インポート中..." : "設定をインポート"}
              </Button>
            </div>
            <p className="text-xs text-gray-500">
              エクスポートしたJSONデータを貼り付けて設定を復元します
            </p>
          </div>

          {/* クリア */}
          <div className="space-y-2 pt-4 border-t">
            <Label className="text-red-600">危険な操作</Label>
            <Button
              onClick={handleClearSettings}
              variant="destructive"
              className="w-full"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              すべての設定をクリア
            </Button>
            <p className="text-xs text-gray-500">
              V体の選択状態や設定がすべて削除されます。この操作は取り消せません。
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
