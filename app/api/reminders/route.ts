import { NextRequest, NextResponse } from "next/server";
import {
  deleteReminderPreference,
  loadReminderPreference,
  upsertReminderPreference,
  validateReminderPreferenceInput,
  validateReminderSource,
} from "@/app/reminderPreferences/reminderPreferenceServer";

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

export async function GET(request: NextRequest) {
  try {
    const source = validateReminderSource(
      request.nextUrl.searchParams.get("sourceType"),
      request.nextUrl.searchParams.get("sourceId")
    );
    if (!source) return NextResponse.json({ ok: false }, { status: 400 });

    const preference = await loadReminderPreference(SYNC_CODE, source.sourceType, source.sourceId);
    return NextResponse.json({ ok: true, preference });
  } catch (error) {
    console.error("Failed to load reminder preference:", error);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    if (!hasValidWriteOrigin(request)) return NextResponse.json({ ok: false }, { status: 403 });

    const input = validateReminderPreferenceInput(await readSmallJson(request));
    if (!input) return NextResponse.json({ ok: false }, { status: 400 });

    const preference = await upsertReminderPreference(SYNC_CODE, input);
    return NextResponse.json({ ok: true, preference });
  } catch (error) {
    console.error("Failed to save reminder preference:", error);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    if (!hasValidWriteOrigin(request)) return NextResponse.json({ ok: false }, { status: 403 });

    const body = await readSmallJson(request);
    if (!body || typeof body !== "object") return NextResponse.json({ ok: false }, { status: 400 });
    const record = body as Record<string, unknown>;
    const source = validateReminderSource(record.sourceType, record.sourceId);
    if (!source) return NextResponse.json({ ok: false }, { status: 400 });

    await deleteReminderPreference(SYNC_CODE, source.sourceType, source.sourceId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Failed to reset reminder preference:", error);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
