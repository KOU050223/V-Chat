'use client';

import { useSearchParams } from 'next/navigation';
import { useEffect, useState, Suspense } from 'react';
import Login from '@/components/auth/Login';
import ProtectedRoute from '@/components/auth/ProtectedRoute';

function LoginContent() {
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const errorParam = searchParams.get('error');
    if (errorParam) {
      console.log('Login error:', errorParam);
      setError(errorParam);
    }
  }, [searchParams]);

  return (
    <>
      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-md">
          <p className="text-red-600 text-sm">
            認証エラー: {error}
            {error === 'OAuthSignin' && (
              <span className="block mt-1">
                OAuth設定に問題があります。環境変数を確認してください。
              </span>
            )}
          </p>
        </div>
      )}
      <Login />
    </>
  );
}

export default function LoginPage() {
  return (
    <ProtectedRoute requireAuth={false}>
      <Suspense fallback={<div>Loading...</div>}>
        <LoginContent />
      </Suspense>
    </ProtectedRoute>
  );
}