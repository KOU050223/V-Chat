import { Metadata, ResolvingMetadata } from "next";
import { getAdminFirestore } from "@/lib/firebase-admin";
import ClientPage from "./ClientPage";

// Firebase Adminを使用するためNode.jsランタイムを明示的に指定
export const runtime = "nodejs";

type Props = {
  params: Promise<{ postId: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

export async function generateMetadata(
  { params }: Props,
  parent: ResolvingMetadata
): Promise<Metadata> {
  // read route params
  const { postId } = await params;

  // fetch data
  let title = "掲示板 - V-Chat";
  let description = "詳細";

  try {
    const db = getAdminFirestore();
    const docRef = db.collection("bulletin_posts").doc(postId);
    const docSnap = await docRef.get();

    if (docSnap.exists) {
      const data = docSnap.data();
      if (data) {
        title =
          data.title && typeof data.title === "string"
            ? `${data.title} - V-Chat 掲示板`
            : "掲示板 - V-Chat";
        description =
          data.content && typeof data.content === "string"
            ? data.content.substring(0, 100)
            : "投稿の詳細";
      }
    }
  } catch (error) {
    console.error("OGP Metadata Fetch Error:", error);
  }

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://v-chat.uomi.dev";
  const absoluteUrl = new URL(`/bulletin/${postId}`, baseUrl).toString();
  const absoluteImageUrl = new URL("/v-chat_icon.png", baseUrl).toString();

  return {
    title: title,
    description: description,
    openGraph: {
      title: title,
      description: description,
      type: "article",
      locale: "ja_JP",
      url: absoluteUrl,
      siteName: "V-Chat",
      images: [
        {
          url: absoluteImageUrl,
          width: 512,
          height: 512,
        },
      ],
    },
    twitter: {
      card: "summary",
      title: title,
      description: description,
      images: [absoluteImageUrl],
    },
  };
}

export default async function Page({ params }: Props) {
  return <ClientPage params={params} />;
}
