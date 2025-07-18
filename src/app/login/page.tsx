'use client';

import Login from '@/components/auth/Login';
import ProtectedRoute from '@/components/auth/ProtectedRoute';

export default function LoginPage() {
  return (
    <ProtectedRoute requireAuth={false}>
      <Login />
    </ProtectedRoute>
  );
}