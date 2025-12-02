"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useMemo,
  useCallback,
} from "react";
import {
  useSession,
  signOut as nextAuthSignOut,
  signIn,
} from "next-auth/react";
import {
  User,
  onAuthStateChanged,
  signOut,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  GithubAuthProvider,
  sendPasswordResetEmail,
  sendEmailVerification,
  updateProfile,
} from "firebase/auth";
import { auth } from "@/lib/firebaseConfig";

interface AuthContextType {
  user: User | null;
  nextAuthSession: any; // NextAuthセッション
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (
    email: string,
    password: string,
    displayName: string
  ) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  loginWithGithub: () => Promise<void>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  sendVerificationEmail: () => Promise<void>;
  // アカウントリンク機能
  linkVRoidAccount: () => Promise<void>;
  unlinkVRoidAccount: () => Promise<void>;
  isVRoidLinked: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  nextAuthSession: null,
  loading: true,
  login: async () => {},
  register: async () => {},
  loginWithGoogle: async () => {},
  loginWithGithub: async () => {},
  logout: async () => {},
  resetPassword: async () => {},
  sendVerificationEmail: async () => {},
  linkVRoidAccount: async () => {},
  unlinkVRoidAccount: async () => {},
  isVRoidLinked: false,
});

export const useAuth = () => {
  return useContext(AuthContext);
};

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [linkedAccounts, setLinkedAccounts] = useState<string[]>([]);
  const { data: nextAuthSession, status: nextAuthStatus } = useSession();

  // VRoidアカウントがリンクされているかチェック
  const isVRoidLinked =
    nextAuthSession?.provider === "vroid" || linkedAccounts.includes("vroid");

  // 開発用ログ（最小限に制限）
  // デバッグが必要な場合は以下のコメントアウトを解除
  /*
  if (process.env.NODE_ENV === 'development') {
    console.log('AuthProvider state:', {
      user: user ? 'Firebase user found' : 'No Firebase user',
      nextAuthSession: nextAuthSession ? 'NextAuth session found' : 'No NextAuth session',
      nextAuthStatus,
      loading,
      isVRoidLinked,
      linkedAccounts
    });
  }
  */

  useEffect(() => {
    if (!auth) {
      // NextAuthのみでロード状態を管理
      setLoading(nextAuthStatus === "loading");
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      // Firebase認証とNextAuth認証の両方のロード状態を考慮
      setLoading(nextAuthStatus === "loading");
    });

    return unsubscribe;
  }, [nextAuthStatus]);

  const login = useCallback(async (email: string, password: string) => {
    if (!auth) {
      throw new Error("Firebase Auth is not initialized");
    }

    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (error: any) {
      throw new Error(error.message);
    }
  }, []);

  const register = useCallback(
    async (email: string, password: string, displayName: string) => {
      if (!auth) {
        throw new Error("Firebase Auth is not initialized");
      }

      try {
        const userCredential = await createUserWithEmailAndPassword(
          auth,
          email,
          password
        );
        await updateProfile(userCredential.user, { displayName });
        await sendEmailVerification(userCredential.user);
      } catch (error: any) {
        throw new Error(error.message);
      }
    },
    []
  );

  const loginWithGoogle = useCallback(async () => {
    if (!auth) {
      throw new Error("Firebase Auth is not initialized");
    }

    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (error: any) {
      throw new Error(error.message);
    }
  }, []);

  const loginWithGithub = useCallback(async () => {
    if (!auth) {
      throw new Error("Firebase Auth is not initialized");
    }

    try {
      const provider = new GithubAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (error: any) {
      throw new Error(error.message);
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      // Firebase認証からログアウト
      if (auth && user) {
        await signOut(auth);
      }

      // NextAuth認証からログアウト
      if (nextAuthSession) {
        await nextAuthSignOut({ callbackUrl: "/login" });
      } else if (user) {
        // Firebase認証のみの場合は手動リダイレクト
        window.location.href = "/login";
      }
    } catch (error: any) {
      console.error("Logout error:", error);
      throw new Error(error.message);
    }
  }, [user, nextAuthSession]);

  const resetPassword = useCallback(async (email: string) => {
    if (!auth) {
      throw new Error("Firebase Auth is not initialized");
    }

    try {
      await sendPasswordResetEmail(auth, email);
    } catch (error: any) {
      throw new Error(error.message);
    }
  }, []);

  const sendVerificationEmail = useCallback(async () => {
    if (!auth || !user) {
      throw new Error(
        "Firebase Auth is not initialized or user is not logged in"
      );
    }

    try {
      await sendEmailVerification(user);
    } catch (error: any) {
      throw new Error(error.message);
    }
  }, [user]);

  // VRoidアカウントをリンク
  const linkVRoidAccount = useCallback(async () => {
    if (!user) {
      throw new Error("Firebase認証が必要です。先にログインしてください。");
    }

    try {
      // VRoidアカウントと連携（ポップアップウィンドウで開く）
      const result = await signIn("vroid", {
        redirect: false,
        callbackUrl: "/dashboard",
      });

      if (result?.error) {
        throw new Error("VRoidアカウントの連携に失敗しました");
      }

      // 成功時にリンク済みアカウントリストを更新
      setLinkedAccounts((prev) => [
        ...prev.filter((acc) => acc !== "vroid"),
        "vroid",
      ]);

      console.log("VRoidアカウント連携完了");
    } catch (error: any) {
      throw new Error(error.message);
    }
  }, [user]);

  // VRoidアカウントのリンクを解除
  const unlinkVRoidAccount = useCallback(async () => {
    try {
      // NextAuthセッションを終了（VRoidセッションのみ）
      if (nextAuthSession?.provider === "vroid") {
        await nextAuthSignOut({ redirect: false });
      }

      // リンク済みアカウントリストから削除
      setLinkedAccounts((prev) => prev.filter((acc) => acc !== "vroid"));

      console.log("VRoidアカウント連携解除完了");
    } catch (error: any) {
      throw new Error(error.message);
    }
  }, [nextAuthSession]);

  // Context valueをuseMemoでメモ化
  const value = useMemo(
    () => ({
      user,
      nextAuthSession,
      loading,
      login,
      register,
      loginWithGoogle,
      loginWithGithub,
      logout,
      resetPassword,
      sendVerificationEmail,
      linkVRoidAccount,
      unlinkVRoidAccount,
      isVRoidLinked,
    }),
    [
      user,
      nextAuthSession,
      loading,
      login,
      register,
      loginWithGoogle,
      loginWithGithub,
      logout,
      resetPassword,
      sendVerificationEmail,
      linkVRoidAccount,
      unlinkVRoidAccount,
      isVRoidLinked,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
