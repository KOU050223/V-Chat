import NextAuth from 'next-auth';

declare module 'next-auth' {
  interface Session {
    accessToken?: string;
    refreshToken?: string;
    provider?: string;
    vroidProfile?: {
      id: string;
      name: string;
      icon?: {
        sq170?: { url: string };
        sq50?: { url: string };
      };
    };
  }

  interface User {
    vroidProfile?: {
      id: string;
      name: string;
      icon?: {
        sq170?: { url: string };
        sq50?: { url: string };
      };
    };
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    accessToken?: string;
    refreshToken?: string;
    provider?: string;
    vroidProfile?: {
      id: string;
      name: string;
      icon?: {
        sq170?: { url: string };
        sq50?: { url: string };
      };
    };
  }
}