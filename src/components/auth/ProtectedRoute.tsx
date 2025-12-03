"use client";

import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireAuth?: boolean;
  redirectTo?: string;
}

export default function ProtectedRoute({
  children,
  requireAuth = true,
  redirectTo = "/login",
}: ProtectedRouteProps) {
  const { user, nextAuthSession, loading } = useAuth();
  const router = useRouter();

  // Firebase または NextAuth のいずれかで認証されているかチェック
  const isAuthenticated = user || nextAuthSession;

  console.log("ProtectedRoute check:", {
    requireAuth,
    isAuthenticated,
    user: user ? "Firebase user" : "No Firebase user",
    nextAuthSession: nextAuthSession
      ? "NextAuth session"
      : "No NextAuth session",
    loading,
  });

  useEffect(() => {
    if (!loading) {
      if (requireAuth && !isAuthenticated) {
        console.log(
          "Authentication required but not found, redirecting to:",
          redirectTo
        );
        router.push(redirectTo);
      } else if (!requireAuth && isAuthenticated) {
        console.log(
          "User authenticated but page does not require auth, redirecting to dashboard"
        );
        router.push("/dashboard");
      }
    }
  }, [isAuthenticated, loading, requireAuth, redirectTo, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-r from-blue-50 to-indigo-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">読み込み中...</p>
        </div>
      </div>
    );
  }

  if (requireAuth && !isAuthenticated) {
    return null;
  }

  if (!requireAuth && isAuthenticated) {
    return null;
  }

  return <>{children}</>;
}
