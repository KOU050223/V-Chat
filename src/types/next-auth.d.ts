import type { DefaultSession } from "next-auth";

// VRoid プロフィールデータの型定義
interface VRoidIcon {
  sq170?: { url: string };
  sq50?: { url: string };
  url?: string;
}

interface VRoidUser {
  id?: string | number;
  name?: string;
  display_name?: string;
  username?: string;
  user_name?: string;
  nickname?: string;
  email?: string;
  email_address?: string;
  icon?: VRoidIcon;
  avatar?: { url?: string };
}

interface VRoidUserDetail {
  user?: VRoidUser;
  id?: string | number;
  name?: string;
  display_name?: string;
  username?: string;
  email?: string;
  icon?: VRoidIcon;
  avatar?: { url?: string };
}

interface VRoidData {
  user_detail?: VRoidUserDetail;
  id?: string | number;
  name?: string;
  username?: string;
  email?: string;
}

interface VRoidExtractedInfo {
  availableNames?: string[];
  availableIds?: (string | number)[];
  availableImages?: string[];
  availableEmails?: string[];
  dataStructure?: {
    hasUserData?: boolean;
    hasUserDetail?: boolean;
    hasActualUser?: boolean;
    actualUserKeys?: string[];
    userDetailKeys?: string[];
    userDataKeys?: string[];
  };
}

interface VRoidProfileBase {
  id: string;
  name: string;
  icon?: VRoidIcon;
  data?: VRoidData;
  userData?: VRoidData;
  userDetail?: VRoidUserDetail;
  actualUser?: VRoidUser;
  extractedInfo?: VRoidExtractedInfo;
}

interface VRoidRawProfile {
  data?: Record<string, unknown>;
  error?: string;
  _links?: Record<string, unknown>;
}

declare module "next-auth" {
  interface Session extends DefaultSession {
    accessToken?: string;
    refreshToken?: string;
    provider?: string;
    error?: string; // エラー情報を追加
    vroidProfile?: VRoidProfileBase;
    vroidData?: {
      userData?: VRoidData;
      userDetail?: VRoidUserDetail;
      extractedInfo?: VRoidExtractedInfo;
      rawProfile?: VRoidRawProfile;
    };
    user: {
      id?: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
    };
  }

  interface User {
    vroidProfile?: VRoidProfileBase;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    accessToken?: string;
    refreshToken?: string;
    provider?: string;
    error?: string; // エラー情報を追加
    vroidProfile?: VRoidProfileBase;
    picture?: string | null;
  }
}
