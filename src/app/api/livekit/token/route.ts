import { AccessToken } from "livekit-server-sdk";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { roomName, participantName } = await req.json();

    console.log("Token request:", { roomName, participantName });

    const apiKey = process.env.LIVEKIT_API_KEY;
    const apiSecret = process.env.LIVEKIT_API_SECRET;
    const livekitUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL;

    console.log("API Key exists:", !!apiKey);
    console.log("API Secret exists:", !!apiSecret);
    console.log("LiveKit URL:", livekitUrl);

    if (!apiKey || !apiSecret) {
      console.error("LiveKit credentials missing!");
      return NextResponse.json(
        {
          error:
            "LiveKit credentials not configured. Please set LIVEKIT_API_KEY and LIVEKIT_API_SECRET in your environment variables.",
          missingCredentials: {
            apiKey: !apiKey,
            apiSecret: !apiSecret,
          },
        },
        { status: 500 }
      );
    }

    if (!livekitUrl) {
      console.error("LiveKit URL missing!");
      return NextResponse.json(
        {
          error:
            "LiveKit URL not configured. Please set NEXT_PUBLIC_LIVEKIT_URL in your environment variables.",
        },
        { status: 500 }
      );
    }

    const at = new AccessToken(apiKey, apiSecret, {
      identity: participantName,
    });

    at.addGrant({
      roomJoin: true,
      room: roomName,
      canPublish: true,
      canSubscribe: true,
    });

    const token = await at.toJwt();

    console.log("Generated token length:", token.length);
    console.log("Token preview:", token.substring(0, 50) + "...");

    return NextResponse.json({ token });
  } catch (error) {
    console.error("Token generation error:", error);
    return NextResponse.json(
      {
        error: "Failed to generate token",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
