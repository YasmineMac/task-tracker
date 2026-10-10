import { NextRequest, NextResponse } from "next/server";
import { syncSelectedGoogleCalendarEvents } from "@/app/googleCalendar/googleCalendarServer";

const SYNC_CODE = process.env.NEXT_PUBLIC_DEMO_MODE === "true" ? "DEMO-TASKS" : "YAS-TEST-001";

export async function GET(request: NextRequest) {
  try {
    const cronSecret = process.env.CRON_SECRET;
    const authorization = request.headers.get("authorization");

    if (!cronSecret || authorization !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ ok: false }, { status: 401 });
    }

    const result = await syncSelectedGoogleCalendarEvents(SYNC_CODE);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error("Google Calendar cron sync failed:", error);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
