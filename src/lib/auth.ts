import { NextAuthOptions } from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import GitHubProvider from 'next-auth/providers/github';
import CredentialsProvider from 'next-auth/providers/credentials';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '@/lib/firebaseConfig';

// デバッグ用ログ
if (process.env.NODE_ENV !== 'production') {
  console.log('NextAuth config loaded');
  console.log('VROID_CLIENT_ID:', process.env.VROID_CLIENT_ID ? '✓ 設定済み' : '✗ 未設定');
  console.log('VROID_CLIENT_SECRET:', process.env.VROID_CLIENT_SECRET ? '✓ 設定済み' : '✗ 未設定');
  console.log('NEXTAUTH_SECRET:', process.env.NEXTAUTH_SECRET ? '✓ 設定済み' : '✗ 未設定');
  console.log('NEXTAUTH_URL:', process.env.NEXTAUTH_URL);

  // AccessDeniedエラーの詳細をログ出力
  console.log('Expected redirect URI:', `${process.env.NEXTAUTH_URL}/api/auth/callback/vroid`);
}

export const authOptions: NextAuthOptions = {
  debug: true, // デバッグログを有効化
  providers: [
    // VRoid Hub OAuth（NextAuthで管理）のみ
    // Vroid OAuth Provider（カスタムプロバイダー）
    {
      id: 'vroid',
      name: 'VRoid Hub',
      type: 'oauth',
      authorization: {
        url: 'https://hub.vroid.com/oauth/authorize',
        params: {
          scope: 'default',
          response_type: 'code',
        },
      },
      token: 'https://hub.vroid.com/oauth/token',
      userinfo: {
        url: 'https://hub.vroid.com/api/account',
        async request({ tokens, provider }) {
          console.log('Userinfo request for VRoid:', { tokens, provider });
          
          const response = await fetch('https://hub.vroid.com/api/account', {
            headers: {
              'X-Api-Version': '11',
              'Authorization': `Bearer ${tokens.access_token}`,
            },
          });
          
          console.log('VRoid userinfo response status:', response.status);
          
          if (!response.ok) {
            const errorText = await response.text();
            console.error('VRoid userinfo error:', errorText);
            throw new Error(`VRoid API error: ${response.status} ${errorText}`);
          }
          
          const profile = await response.json();
          console.log('VRoid userinfo profile:', profile);
          return profile;
        }
      },
      clientId: process.env.VROID_CLIENT_ID,
      clientSecret: process.env.VROID_CLIENT_SECRET,
      profile(profile: any) {
        console.log('VRoid profile received:', profile);
        return {
          id: profile.id?.toString() || profile.user_id?.toString() || 'unknown',
          name: profile.name || profile.display_name || 'Unknown User',
          email: profile.email || null,
          image: profile.icon?.sq170?.url || profile.avatar_url || null,
          vroidProfile: profile,
        };
      },
    },
  ],
  pages: {
    signIn: '/login',
    error: '/login',
  },
  callbacks: {
    async jwt({ token, user, account }) {
      console.log('JWT callback called:', { user, account, token });
      
      if (account && user) {
        console.log('Setting tokens from account:', account);
        token.accessToken = account.access_token;
        token.refreshToken = account.refresh_token;
        token.provider = account.provider;
        
        // Vroid認証の場合、追加情報を保存
        if (account.provider === 'vroid') {
          token.vroidProfile = (user as any).vroidProfile;
          console.log('VRoid profile stored in token:', token.vroidProfile);
        }
      }
      return token;
    },
    async session({ session, token }) {
      console.log('Session callback called:', { session, token });
      
      session.accessToken = token.accessToken as string;
      session.refreshToken = token.refreshToken as string;
      session.provider = token.provider as string;
      
      if (token.vroidProfile) {
        session.vroidProfile = token.vroidProfile;
      }
      
      console.log('Final session:', session);
      return session;
    },
    async redirect({ url, baseUrl }) {
      console.log('Redirect callback called:', { url, baseUrl });
      
      // 認証後は常にダッシュボードにリダイレクト
      if (url.startsWith('/')) return `${baseUrl}/dashboard`;
      if (new URL(url).origin === baseUrl) return url;
      return `${baseUrl}/dashboard`;
    },
    async signIn({ user, account, profile, email, credentials }: Parameters<SignInCallback>[0]) {
      console.log('SignIn callback called:', { user, account, profile, email, credentials });
      
      // VRoid認証の場合の特別な処理
      if (account?.provider === 'vroid') {
        console.log('VRoid sign-in detected');
        console.log('VRoid account details:', account);
        console.log('VRoid profile details:', profile);
        
        // より寛容な検証（VRoidプロファイルの構造が異なる可能性）
        if (!profile) {
          console.error('VRoid profile is null or undefined');
          return false;
        }
        
        console.log('VRoid profile validation passed');
      }
      
      return true;
    },
  },
  session: {
    strategy: 'jwt',
  },
  secret: process.env.NEXTAUTH_SECRET,
};