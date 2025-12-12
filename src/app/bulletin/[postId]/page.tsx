import { Metadata, ResolvingMetadata } from "next";
import { getAdminFirestore } from "@/lib/firebase-admin";
import ClientPage from "./ClientPage";

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
        title = `${data.title} - V-Chat 掲示板`;
        description = data.content?.substring(0, 100) || "投稿の詳細";
      }
    }
  } catch (error) {
    console.error("OGP Metadata Fetch Error:", error);
  }

  return {
    title: title,
    description: description,
    openGraph: {
      title: title,
      description: description,
      type: "article",
      locale: "ja_JP",
      url: `/bulletin/${postId}`,
      siteName: "V-Chat",
      images: [
        {
          url: "/v-chat_icon.png", // TODO: Custom OG Image generation if needed
          width: 512,
          height: 512,
        },
      ],
    },
    twitter: {
      card: "summary",
      title: title,
      description: description,
      images: ["/v-chat_icon.png"],
    },
  };
}

export default async function Page({ params }: Props) {
  return <ClientPage params={params} />;
}
