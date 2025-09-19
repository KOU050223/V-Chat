import { NextAuthOptions } from 'next-auth';
import type { Account, User, Profile } from 'next-auth';
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
    // VRoid Hub OAuth Provider（公式ドキュメント準拠）
    {
      id: 'vroid',
      name: 'VRoid Hub',
      type: 'oauth',
      version: '2.0',
      authorization: {
        url: 'https://hub.vroid.com/oauth/authorize',
        params: {
          scope: 'default',
          response_type: 'code',
        },
      },
      token: {
        url: 'https://hub.vroid.com/oauth/token',
        params: {
          grant_type: 'authorization_code',
        },
      },
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
          console.log('=== VRoid API Raw Response ===');
          console.log('Raw profile data:', JSON.stringify(profile, null, 2));
          console.log('================================');
          return profile;
        }
      },
      clientId: process.env.VROID_CLIENT_ID,
      clientSecret: process.env.VROID_CLIENT_SECRET,
      profile(profile: any) {
        console.log('=== VRoid Profile Debug ===');
        console.log('Full profile:', JSON.stringify(profile, null, 2));
        
        // VRoid APIのレスポンス構造: { data: { user_detail: { ... } } }
        const userData = profile.data || profile;
        const userDetail = userData.user_detail || {};
        
        console.log('userData:', JSON.stringify(userData, null, 2));
        console.log('userDetail:', JSON.stringify(userDetail, null, 2));
        
        // VRoidの実際のデータ構造に基づく抽出
        // user_detail.user がメインのユーザー情報を含んでいる
        const actualUser = userDetail.user || {};
        
        const possibleNames = [
          // 実際のユーザー情報パス（user_detail.user.name）
          actualUser.name,
          actualUser.display_name,
          actualUser.username,
          actualUser.user_name,
          actualUser.nickname,
          // user_detail 直下
          userDetail.name,
          userDetail.display_name,
          userDetail.username,
          userDetail.user_name,
          userDetail.nickname,
          // userData 内
          userData.name,
          userData.display_name,
          userData.username,
          userData.user_name,
          userData.nickname,
          // root 内
          profile.name,
          profile.display_name,
          profile.username,
          profile.given_name,
          profile.family_name,
        ].filter(Boolean);
        
        const possibleIds = [
          // 実際のユーザー情報パス
          actualUser.id,
          actualUser.user_id,
          actualUser.pixiv_user_id,
          // user_detail 直下
          userDetail.id,
          userDetail.user_id,
          // userData 内
          userData.id,
          userData.user_id,
          // root 内
          profile.id,
          profile.sub,
          profile.user_id
        ].filter(Boolean);
        
        const possibleImages = [
          // 実際のユーザー情報パス（user_detail.user.icon）
          actualUser.icon?.sq170?.url,
          actualUser.icon?.sq50?.url,
          actualUser.icon?.url,
          actualUser.avatar?.url,
          // user_detail 直下
          userDetail.icon?.sq170?.url,
          userDetail.icon?.sq50?.url,
          userDetail.icon?.url,
          userDetail.avatar?.url,
          userDetail.profile_image?.url,
          userDetail.image?.url,
          // userData 内
          userData.icon?.sq170?.url,
          userData.icon?.sq50?.url,
          userData.icon?.url,
          userData.avatar?.url,
          // root 内
          profile.icon?.sq170?.url,
          profile.icon?.sq50?.url,
          profile.icon?.url,
          profile.avatar?.url,
          profile.picture
        ].filter(Boolean);
        
        const possibleEmails = [
          // 実際のユーザー情報パス
          actualUser.email,
          actualUser.email_address,
          // user_detail 直下
          userDetail.email,
          userDetail.email_address,
          // userData 内
          userData.email,
          userData.email_address,
          // root 内
          profile.email,
          profile.email_address
        ].filter(Boolean);
        
        // より良い名前とIDを選択
        let selectedName = 'VRoid User';
        let selectedId = 'unknown';
        
        if (possibleIds.length > 0 && possibleIds[0] !== 'unknown') {
          selectedId = possibleIds[0].toString();
        }
        
        // 実際の名前があれば、それを優先
        const realNames = possibleNames.filter(name => 
          name && 
          !name.includes('VRoid User') && 
          name.trim().length > 0 &&
          name !== 'unknown'
        );
        
        if (realNames.length > 0) {
          selectedName = realNames[0];
        } else if (selectedId !== 'unknown') {
          // 実際の名前がない場合は、IDを使って表示
          selectedName = `VRoid User #${selectedId}`;
        }
        
        const result = {
          id: selectedId,
          name: selectedName,
          email: possibleEmails[0] || null,
          image: possibleImages[0] || null,
          vroidProfile: {
            ...profile,
            // 詳細情報を展開
            userData,
            userDetail,
            actualUser, // 実際のユーザー情報も追加
            extractedInfo: {
              availableNames: possibleNames,
              availableIds: possibleIds,
              availableImages: possibleImages,
              availableEmails: possibleEmails,
              // デバッグ用の詳細情報
              dataStructure: {
                hasUserData: !!userData,
                hasUserDetail: !!userDetail,
                hasActualUser: !!actualUser,
                actualUserKeys: actualUser ? Object.keys(actualUser) : [],
                userDetailKeys: userDetail ? Object.keys(userDetail) : [],
                userDataKeys: userData ? Object.keys(userData) : [],
              }
            }
          },
        };
        
        console.log('Data structure analysis:');
        console.log('- userData exists:', !!userData);
        console.log('- userDetail exists:', !!userDetail);
        console.log('- actualUser exists:', !!actualUser);
        console.log('- actualUser keys:', actualUser ? Object.keys(actualUser) : []);
        console.log('- actualUser.name:', actualUser?.name);
        console.log('- actualUser.id:', actualUser?.id);
        console.log('- actualUser.icon:', actualUser?.icon);
        console.log('Possible names found:', possibleNames);
        console.log('Possible IDs found:', possibleIds);
        console.log('Possible images found:', possibleImages);
        console.log('Possible emails found:', possibleEmails);
        console.log('Selected name:', selectedName);
        console.log('Selected ID:', selectedId);
        console.log('Extracted profile result:', result);
        console.log('========================');
        
        return result;
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
        
        // アクセストークンの有効期限を設定
        if (account.expires_at) {
          token.exp = account.expires_at;
        } else if (account.expires_in) {
          token.exp = Math.floor(Date.now() / 1000) + (account.expires_in as number);
        }
        
        // Vroid認証の場合、追加情報を保存
        if (account.provider === 'vroid') {
          token.vroidProfile = (user as any).vroidProfile;
          // ユーザー情報もトークンに保存
          token.name = user.name || 'VRoid User';
          token.picture = user.image;
          token.sub = user.id || 'unknown';
          console.log('VRoid profile stored in token:', token.vroidProfile);
          console.log('VRoid user info stored:', { name: token.name, picture: token.picture, sub: token.sub });
          console.log('Token expires at:', token.exp ? new Date((token.exp as number) * 1000).toISOString() : 'unknown');
        }
      }
      
      // アクセストークンが期限切れかチェック（リフレッシュトークンがある場合）
      if (token.accessToken && token.refreshToken && token.provider === 'vroid') {
        try {
          // トークンの有効期限をチェック（expiresAtがある場合）
          const now = Math.floor(Date.now() / 1000);
          const tokenExpiry = (token.exp as number) || 0;
          
          // トークンが30分以内に期限切れになる場合はリフレッシュを試行
          const TOKEN_REFRESH_THRESHOLD_SECONDS = 30 * 60; // 30分
          if (tokenExpiry > 0 && (tokenExpiry - now) < TOKEN_REFRESH_THRESHOLD_SECONDS) {
            console.log('Token is expiring soon, attempting refresh');
            
            const refreshResponse = await fetch('https://hub.vroid.com/oauth/token', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
              },
              body: new URLSearchParams({
                grant_type: 'refresh_token',
                refresh_token: token.refreshToken as string,
                client_id: process.env.VROID_CLIENT_ID!,
                client_secret: process.env.VROID_CLIENT_SECRET!,
              }),
            });
            
            if (refreshResponse.ok) {
              const refreshedTokens = await refreshResponse.json();
              console.log('Token refreshed successfully');
              
              token.accessToken = refreshedTokens.access_token;
              if (refreshedTokens.refresh_token) {
                token.refreshToken = refreshedTokens.refresh_token;
              }
              if (refreshedTokens.expires_in) {
                token.exp = Math.floor(Date.now() / 1000) + refreshedTokens.expires_in;
              }
            } else {
              console.error('Token refresh failed:', refreshResponse.status, refreshResponse.statusText);
              // リフレッシュに失敗した場合は既存のトークンを使用
            }
          } else {
            console.log('Existing VRoid token is still valid');
          }
        } catch (refreshError) {
          console.error('Token refresh error:', refreshError);
          // エラーが発生した場合は既存のトークンを使用
        }
      }
      
      return token;
    },
    async session({ session, token }) {
      console.log('Session callback called:', { session, token });
      
      session.accessToken = token.accessToken as string;
      session.refreshToken = token.refreshToken as string;
      session.provider = token.provider as string;
      
      // トークンから詳細なユーザー情報を復元
      if (token.name && token.name !== 'VRoid User' && session.user) {
        session.user.name = token.name;
      }
      if (token.picture && session.user) {
        session.user.image = token.picture;
      }
      
      // VRoidプロファイルから情報を追加抽出
      if (token.vroidProfile && session.user) {
        const vroidData = token.vroidProfile as any;
        
        // 実際のユーザー情報から名前と画像を再抽出
        if (vroidData.actualUser) {
          const actualUser = vroidData.actualUser;
          
          // 名前の再設定（より正確な値を使用）
          if (actualUser.name && session.user.name === 'VRoid User') {
            session.user.name = actualUser.name;
          }
          
          // 画像の再設定
          if (actualUser.icon?.sq170?.url && !session.user.image) {
            session.user.image = actualUser.icon.sq170.url;
          }
        }
      }
      
      if (token.vroidProfile) {
        session.vroidProfile = token.vroidProfile;
        
        // vroidProfileから追加情報を抽出してセッションに含める
        const vroidData = token.vroidProfile as any;
        session.vroidData = {
          userData: vroidData.userData,
          userDetail: vroidData.userDetail,
          extractedInfo: vroidData.extractedInfo,
          // 元のプロファイル情報も保持
          rawProfile: {
            data: vroidData.data,
            error: vroidData.error,
            _links: vroidData._links,
          }
        };
        
        console.log('VRoid detailed data added to session:', session.vroidData);
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
    async signIn({ user, account, profile, email, credentials }: { 
      user: User; 
      account: Account | null; 
      profile?: Profile; 
      email?: { verificationRequest?: boolean } | string; 
      credentials?: Record<string, any>; 
    }) {
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