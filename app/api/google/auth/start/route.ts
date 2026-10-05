import { NextResponse } from "next/server";
import {
  GOOGLE_OAUTH_STATE_COOKIE,
  googleOAuthAuthorizationUrl,
} from "@/app/googleCalendar/googleCalendarServer";

export async function GET() {
  try {
    const state = crypto.randomUUID();
    const response = NextResponse.redirect(googleOAuthAuthorizationUrl(state));

    response.cookies.set(GOOGLE_OAUTH_STATE_COOKIE, state, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 10 * 60,
    });

    return response;
  } catch (error) {
    console.error("Google Calendar OAuth start failed:", error);
    return NextResponse.json(
      { ok: false, error: "Google Calendar is not configured yet." },
      { status: 500 }
    );
  }
}
