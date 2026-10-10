import { NextRequest, NextResponse } from "next/server";
import {
  loadCachedGoogleCalendarEvents,
  updateGoogleEventCategoryOverride,
} from "@/app/googleCalendar/googleCalendarServer";

const SYNC_CODE = process.env.NEXT_PUBLIC_DEMO_MODE === "true" ? "DEMO-TASKS" : "YAS-TEST-001";

export async function GET() {
  try {
    const events = await loadCachedGoogleCalendarEvents(SYNC_CODE);
    return NextResponse.json({ ok: true, events });
  } catch (error) {
    console.error("Failed to load cached Google Calendar events:", error);
    return NextResponse.json({ ok: false, events: [] }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = (await request.json()) as { eventId?: string; categoryOverride?: string | null };
    if (!body.eventId || !("categoryOverride" in body)) {
      return NextResponse.json({ ok: false }, { status: 400 });
    }

    const event = await updateGoogleEventCategoryOverride(SYNC_CODE, body.eventId, body.categoryOverride ?? null);
    return NextResponse.json({ ok: true, event });
  } catch (error) {
    console.error("Failed to update Google Calendar event override:", error);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
