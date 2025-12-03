import NextAuth from "next-auth";

declare module "next-auth" {
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
      data?: any;
      userData?: any;
      userDetail?: any;
      extractedInfo?: any;
    };
    vroidData?: {
      userData?: any;
      userDetail?: any;
      extractedInfo?: any;
      rawProfile?: any;
    };
    user: {
      name?: string | null;
      email?: string | null;
      image?: string | null;
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
      data?: any;
      userData?: any;
      userDetail?: any;
      extractedInfo?: any;
    };
  }
}

declare module "next-auth/jwt" {
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
      data?: any;
      userData?: any;
      userDetail?: any;
      extractedInfo?: any;
    };
    picture?: string | null;
  }
}
