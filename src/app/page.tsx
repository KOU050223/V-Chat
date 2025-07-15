'use client';

import { useAuth } from "@/contexts/AuthContext";
import Login from "@/components/auth/Login";
import { Button } from "@/components/ui/button";

export default function Home() {
  const { user, loading, logout } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  return (
    <div className="grid grid-rows-[20px_1fr_20px] items-center justify-items-center min-h-screen p-8 pb-20 gap-16 sm:p-20 font-[family-name:var(--font-geist-sans)]">
      <main className="flex flex-col gap-[32px] row-start-2 items-center sm:items-start">
        <div className="text-center sm:text-left">
          <h1 className="text-4xl sm:text-6xl font-bold tracking-tight">
            V-Chat
          </h1>
          <p className="text-lg text-gray-600 mt-4">
            こんにちは、{user.displayName || user.email}さん！
          </p>
        </div>
        
        <div className="flex gap-4">
          <Button>チャットを開始</Button>
          <Button variant="outline" onClick={logout}>
            ログアウト
          </Button>
        </div>
      </main>
    </div>
  );
}
