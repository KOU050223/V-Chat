"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import { VRoidCharacterModel } from "@/lib/vroid";
import { useAuth } from "./AuthContext";

interface VModelSettings {
  selectedModelId: string | null;
  selectedModel: VRoidCharacterModel | null;
  lastUpdated: string;
  preferences: {
    autoDownload: boolean;
    showPrivateModels: boolean;
    defaultSort: "latest" | "popular" | "hearts";
  };
}

interface VModelContextType {
  settings: VModelSettings;
  updateSelectedModel: (model: VRoidCharacterModel | null) => void;
  updatePreferences: (
    preferences: Partial<VModelSettings["preferences"]>
  ) => void;
  clearSettings: () => void;
  isLoading: boolean;
}

const defaultSettings: VModelSettings = {
  selectedModelId: null,
  selectedModel: null,
  lastUpdated: new Date().toISOString(),
  preferences: {
    autoDownload: false,
    showPrivateModels: true,
    defaultSort: "latest",
  },
};

const VModelContext = createContext<VModelContextType>({
  settings: defaultSettings,
  updateSelectedModel: () => {},
  updatePreferences: () => {},
  clearSettings: () => {},
  isLoading: true,
});

export const useVModel = () => {
  const context = useContext(VModelContext);
  if (!context) {
    throw new Error("useVModel must be used within a VModelProvider");
  }
  return context;
};

interface VModelProviderProps {
  children: ReactNode;
}

export const VModelProvider = ({ children }: VModelProviderProps) => {
  const { user, nextAuthSession } = useAuth();
  const [settings, setSettings] = useState<VModelSettings>(defaultSettings);
  const [isLoading, setIsLoading] = useState(true);

  // ユーザー固有のストレージキーを生成
  const getStorageKey = () => {
    const userId = user?.uid || nextAuthSession?.user?.id || "anonymous";
    return `v-chat-vmodel-settings-${userId}`;
  };

  // 設定をローカルストレージから読み込み
  const loadSettings = () => {
    try {
      const storageKey = getStorageKey();
      const saved = localStorage.getItem(storageKey);

      if (saved) {
        const parsedSettings = JSON.parse(saved) as VModelSettings;

        // バージョン互換性チェック
        const mergedSettings: VModelSettings = {
          ...defaultSettings,
          ...parsedSettings,
          preferences: {
            ...defaultSettings.preferences,
            ...parsedSettings.preferences,
          },
        };

        setSettings(mergedSettings);
      }
    } catch (error) {
      console.error("V体設定の読み込みに失敗:", error);
      setSettings(defaultSettings);
    } finally {
      setIsLoading(false);
    }
  };

  // 設定をローカルストレージに保存
  const saveSettings = (newSettings: VModelSettings) => {
    try {
      const storageKey = getStorageKey();
      localStorage.setItem(storageKey, JSON.stringify(newSettings));
    } catch (error) {
      console.error("V体設定の保存に失敗:", error);
    }
  };

  // 選択されたモデルを更新
  const updateSelectedModel = (model: VRoidCharacterModel | null) => {
    const newSettings: VModelSettings = {
      ...settings,
      selectedModelId: model?.id || null,
      selectedModel: model,
      lastUpdated: new Date().toISOString(),
    };

    setSettings(newSettings);
    saveSettings(newSettings);
  };

  // 設定を更新
  const updatePreferences = (
    newPreferences: Partial<VModelSettings["preferences"]>
  ) => {
    const newSettings: VModelSettings = {
      ...settings,
      preferences: {
        ...settings.preferences,
        ...newPreferences,
      },
      lastUpdated: new Date().toISOString(),
    };

    setSettings(newSettings);
    saveSettings(newSettings);
  };

  // 設定をクリア
  const clearSettings = () => {
    try {
      const storageKey = getStorageKey();
      localStorage.removeItem(storageKey);
      setSettings(defaultSettings);
    } catch (error) {
      console.error("V体設定のクリアに失敗:", error);
    }
  };

  // ユーザーが変更された時に設定を再読み込み
  useEffect(() => {
    if (user || nextAuthSession) {
      loadSettings();
    } else {
      setSettings(defaultSettings);
      setIsLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid, nextAuthSession?.user?.id]);

  // 定期的にバックアップを作成（1時間ごと）
  useEffect(() => {
    const interval = setInterval(
      () => {
        if (settings.selectedModel) {
          saveSettings(settings);
        }
      },
      60 * 60 * 1000
    ); // 1時間

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings]);

  const value: VModelContextType = {
    settings,
    updateSelectedModel,
    updatePreferences,
    clearSettings,
    isLoading,
  };

  return (
    <VModelContext.Provider value={value}>{children}</VModelContext.Provider>
  );
};

// 設定のエクスポート/インポート機能
export const exportVModelSettings = (): string => {
  try {
    const allKeys = Object.keys(localStorage).filter((key) =>
      key.startsWith("v-chat-vmodel-settings-")
    );

    const allSettings: Record<string, VModelSettings> = {};

    allKeys.forEach((key) => {
      const settings = localStorage.getItem(key);
      if (settings) {
        allSettings[key] = JSON.parse(settings);
      }
    });

    return JSON.stringify(allSettings, null, 2);
  } catch (error) {
    console.error("設定のエクスポートに失敗:", error);
    throw error;
  }
};

export const importVModelSettings = (settingsJson: string): void => {
  try {
    const allSettings = JSON.parse(settingsJson) as Record<
      string,
      VModelSettings
    >;

    Object.entries(allSettings).forEach(([key, settings]) => {
      if (key.startsWith("v-chat-vmodel-settings-")) {
        localStorage.setItem(key, JSON.stringify(settings));
      }
    });

    // ページをリロードして新しい設定を反映
    window.location.reload();
  } catch (error) {
    console.error("設定のインポートに失敗:", error);
    throw error;
  }
};
