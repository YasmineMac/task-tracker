import { NextRequest, NextResponse } from "next/server";
import {
  GOOGLE_OAUTH_STATE_COOKIE,
  exchangeGoogleAuthorizationCode,
  fetchGoogleCalendarList,
  persistGoogleConnectionAndCalendars,
} from "@/app/googleCalendar/googleCalendarServer";

const SYNC_CODE = process.env.NEXT_PUBLIC_DEMO_MODE === "true" ? "DEMO-TASKS" : "YAS-TEST-001";

function redirectToPlanner(request: NextRequest, status: "connected" | "error", detail?: string) {
  const url = new URL("/", request.url);
  url.searchParams.set("tab", "planner");
  url.searchParams.set("googleCalendar", status);
  if (detail) url.searchParams.set("detail", detail);
  return NextResponse.redirect(url);
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const code = params.get("code");
  const state = params.get("state");
  const expectedState = request.cookies.get(GOOGLE_OAUTH_STATE_COOKIE)?.value;

  if (!code || !state || !expectedState || state !== expectedState) {
    return redirectToPlanner(request, "error", "state");
  }

  try {
    const token = await exchangeGoogleAuthorizationCode(code);
    const calendars = await fetchGoogleCalendarList(token.access_token ?? "");
    await persistGoogleConnectionAndCalendars(SYNC_CODE, token, calendars);

    const response = redirectToPlanner(request, "connected");
    response.cookies.delete(GOOGLE_OAUTH_STATE_COOKIE);
    return response;
  } catch (error) {
    console.error("Google Calendar OAuth callback failed:", error);
    const response = redirectToPlanner(request, "error", "callback");
    response.cookies.delete(GOOGLE_OAUTH_STATE_COOKIE);
    return response;
  }
}
