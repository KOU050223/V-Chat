"use client";

import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import Image from "next/image";

export default function Home() {
  const { user, nextAuthSession, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    console.log("Home page redirect logic:", {
      loading,
      user: user ? "Firebase user exists" : "No Firebase user",
      nextAuthSession: nextAuthSession
        ? "NextAuth session exists"
        : "No NextAuth session",
      userObject: user,
      nextAuthSessionObject: nextAuthSession,
    });

    if (!loading) {
      // Firebase認証またはNextAuth認証のいずれかでログイン済み
      if (user || nextAuthSession) {
        console.log("User authenticated, redirecting to dashboard");
        router.push("/dashboard");
      } else {
        console.log("No authentication found, redirecting to login");
        router.push("/login");
      }
    }
  }, [user, nextAuthSession, loading, router]);

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
