'use client';

import { useAuth } from "@/contexts/AuthContext";
import Login from "@/components/auth/Login";
import { Button } from "@/components/ui/button";
import Image from "next/image";

export default function Home() {
  const { user, loading, logout } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-r from-blue-50 to-indigo-100">
        <div className="mb-8">
          <Image
            src="/v-chat_icon.png"
            alt="V-Chat Icon"
            width={80}
            height={80}
            priority
            className="animate-pulse"
          />
        </div>
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <p className="mt-4 text-gray-600">読み込み中...</p>
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
          <div className="flex justify-center sm:justify-start mb-6">
            <Image
              src="/v-chat_logo.png"
              alt="V-Chat Logo"
              width={300}
              height={90}
              priority
              className="h-16 w-auto"
            />
          </div>
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
