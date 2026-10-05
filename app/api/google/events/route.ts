import { NextResponse } from "next/server";
import { loadCachedGoogleCalendarEvents } from "@/app/googleCalendar/googleCalendarServer";

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
