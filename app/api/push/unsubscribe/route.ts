import { NextRequest, NextResponse } from "next/server";
import { disablePushSubscription } from "@/app/pushNotifications/pushSubscriptionServer";

const SYNC_CODE = process.env.NEXT_PUBLIC_DEMO_MODE === "true" ? "DEMO-TASKS" : "YAS-TEST-001";
const MAX_BODY_BYTES = 2048;

function hasValidWriteOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  return !origin || origin === request.nextUrl.origin;
}

async function readSmallJson(request: NextRequest) {
  const text = await request.text();
  if (text.length > MAX_BODY_BYTES) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!hasValidWriteOrigin(request)) return NextResponse.json({ ok: false }, { status: 403 });

    const body = await readSmallJson(request);
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json({ ok: false }, { status: 400 });
    }

    const endpoint = (body as Record<string, unknown>).endpoint;
    if (typeof endpoint !== "string") return NextResponse.json({ ok: false }, { status: 400 });

    await disablePushSubscription(SYNC_CODE, endpoint);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Failed to disable push subscription:", error);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
