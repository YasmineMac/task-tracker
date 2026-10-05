import { NextRequest, NextResponse } from "next/server";
import {
  loadGoogleCalendarSettings,
  updateGoogleCalendarSelected,
} from "@/app/googleCalendar/googleCalendarServer";

const SYNC_CODE = process.env.NEXT_PUBLIC_DEMO_MODE === "true" ? "DEMO-TASKS" : "YAS-TEST-001";

export async function GET() {
  try {
    const settings = await loadGoogleCalendarSettings(SYNC_CODE);
    return NextResponse.json({ ok: true, ...settings });
  } catch (error) {
    console.error("Failed to load Google Calendar settings:", error);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = (await request.json()) as { calendarId?: string; selected?: boolean };
    if (!body.calendarId || typeof body.selected !== "boolean") {
      return NextResponse.json({ ok: false }, { status: 400 });
    }

    await updateGoogleCalendarSelected(SYNC_CODE, body.calendarId, body.selected);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Failed to update Google Calendar selection:", error);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
