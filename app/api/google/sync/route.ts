import { NextResponse } from "next/server";
import { syncSelectedGoogleCalendarEvents } from "@/app/googleCalendar/googleCalendarServer";

const SYNC_CODE = process.env.NEXT_PUBLIC_DEMO_MODE === "true" ? "DEMO-TASKS" : "YAS-TEST-001";

export async function POST() {
  try {
    const result = await syncSelectedGoogleCalendarEvents(SYNC_CODE);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error("Failed to sync Google Calendar events:", error);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
