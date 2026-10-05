import "server-only";

import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { decryptGoogleToken, encryptGoogleToken } from "./googleTokenCrypto";

export const GOOGLE_CALENDAR_READONLY_SCOPE = "https://www.googleapis.com/auth/calendar.readonly";
export const GOOGLE_OAUTH_STATE_COOKIE = "pineapple_google_oauth_state";

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_CALENDAR_LIST_URL = "https://www.googleapis.com/calendar/v3/users/me/calendarList";

type GoogleTokenResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  token_type?: string;
  scope?: string;
  error?: string;
  error_description?: string;
};

export type GoogleCalendarListEntry = {
  id: string;
  summary?: string;
  description?: string;
  primary?: boolean;
  backgroundColor?: string;
  foregroundColor?: string;
  timeZone?: string;
  accessRole?: string;
};

type GoogleCalendarListResponse = {
  items?: GoogleCalendarListEntry[];
  error?: {
    message?: string;
  };
};

function googleEnv() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error("Missing Google OAuth configuration.");
  }

  return { clientId, clientSecret, redirectUri };
}

export function googleOAuthAuthorizationUrl(state: string) {
  const { clientId, redirectUri } = googleEnv();
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: GOOGLE_CALENDAR_READONLY_SCOPE,
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state,
  });

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export async function exchangeGoogleAuthorizationCode(code: string) {
  const { clientId, clientSecret, redirectUri } = googleEnv();
  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });
  const token = (await response.json()) as GoogleTokenResponse;

  if (!response.ok || !token.access_token) {
    throw new Error(token.error_description || token.error || "Google authorization code exchange failed.");
  }

  return token;
}

async function refreshGoogleAccessToken(refreshToken: string) {
  const { clientId, clientSecret } = googleEnv();
  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  const token = (await response.json()) as GoogleTokenResponse;

  if (!response.ok || !token.access_token) {
    throw new Error(token.error_description || token.error || "Google access token refresh failed.");
  }

  return token;
}

export async function fetchGoogleCalendarList(accessToken: string) {
  const response = await fetch(GOOGLE_CALENDAR_LIST_URL, {
    headers: {
      authorization: `Bearer ${accessToken}`,
      accept: "application/json",
    },
  });
  const data = (await response.json()) as GoogleCalendarListResponse;

  if (!response.ok) {
    throw new Error(data.error?.message || "Google Calendar list retrieval failed.");
  }

  return data.items ?? [];
}

export async function getFreshGoogleAccessToken(connectionId: string) {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("google_calendar_connections")
    .select("id, encrypted_access_token, encrypted_refresh_token, expires_at")
    .eq("id", connectionId)
    .single();

  if (error || !data) {
    throw new Error("Google Calendar connection was not found.");
  }

  const expiresAt = Date.parse(String(data.expires_at));
  if (Number.isFinite(expiresAt) && expiresAt > Date.now() + 60_000) {
    return decryptGoogleToken(String(data.encrypted_access_token));
  }

  const refreshToken = decryptGoogleToken(String(data.encrypted_refresh_token));
  const refreshed = await refreshGoogleAccessToken(refreshToken);
  const expiresIn = typeof refreshed.expires_in === "number" ? refreshed.expires_in : 3600;
  const nextExpiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

  const { error: updateError } = await supabase
    .from("google_calendar_connections")
    .update({
      encrypted_access_token: encryptGoogleToken(refreshed.access_token ?? ""),
      expires_at: nextExpiresAt,
      token_type: refreshed.token_type ?? "Bearer",
      granted_scope: refreshed.scope ?? null,
      last_refreshed_at: new Date().toISOString(),
    })
    .eq("id", connectionId);

  if (updateError) {
    throw new Error("Failed to persist refreshed Google access token.");
  }

  return refreshed.access_token ?? "";
}

export async function persistGoogleConnectionAndCalendars(
  syncCode: string,
  token: GoogleTokenResponse,
  calendars: GoogleCalendarListEntry[]
) {
  if (!token.access_token) {
    throw new Error("Google token response did not include an access token.");
  }

  const supabase = createSupabaseServerClient();
  const primaryCalendar = calendars.find((calendar) => calendar.primary) ?? calendars[0];
  const googleAccountId = primaryCalendar?.id;

  if (!googleAccountId) {
    throw new Error("Google Calendar did not return an account calendar identity.");
  }

  const { data: existingConnection, error: existingError } = await supabase
    .from("google_calendar_connections")
    .select("id, encrypted_refresh_token")
    .eq("sync_code", syncCode)
    .eq("google_account_id", googleAccountId)
    .maybeSingle();

  if (existingError) {
    throw new Error("Failed to read existing Google Calendar connection.");
  }

  const refreshToken = token.refresh_token
    ? encryptGoogleToken(token.refresh_token)
    : existingConnection?.encrypted_refresh_token;

  if (!refreshToken) {
    throw new Error("Google did not return a refresh token. Reconnect with consent and offline access.");
  }

  const expiresIn = typeof token.expires_in === "number" ? token.expires_in : 3600;
  const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

  const connectionPayload = {
    sync_code: syncCode,
    google_account_id: googleAccountId,
    google_email: googleAccountId.includes("@") ? googleAccountId : null,
    encrypted_access_token: encryptGoogleToken(token.access_token),
    encrypted_refresh_token: refreshToken,
    token_type: token.token_type ?? "Bearer",
    expires_at: expiresAt,
    granted_scope: token.scope ?? GOOGLE_CALENDAR_READONLY_SCOPE,
    connected_at: new Date().toISOString(),
    last_calendar_discovery_at: new Date().toISOString(),
  };

  const { data: connection, error: upsertError } = await supabase
    .from("google_calendar_connections")
    .upsert(connectionPayload, {
      onConflict: "sync_code,google_account_id",
    })
    .select("id")
    .single();

  if (upsertError || !connection?.id) {
    throw new Error("Failed to persist Google Calendar connection.");
  }

  const { data: existingCalendars, error: calendarsReadError } = await supabase
    .from("google_calendars")
    .select("google_calendar_id, selected")
    .eq("connection_id", connection.id);

  if (calendarsReadError) {
    throw new Error("Failed to read existing Google calendars.");
  }

  const selectedByCalendarId = new Map(
    (existingCalendars ?? []).map((calendar) => [
      String(calendar.google_calendar_id),
      calendar.selected === true,
    ])
  );

  if (calendars.length) {
    const calendarRows = calendars.map((calendar) => ({
      sync_code: syncCode,
      connection_id: connection.id,
      google_calendar_id: calendar.id,
      summary: calendar.summary || calendar.id,
      description: calendar.description ?? null,
      primary_calendar: calendar.primary === true,
      background_color: calendar.backgroundColor ?? null,
      foreground_color: calendar.foregroundColor ?? null,
      selected: selectedByCalendarId.get(calendar.id) ?? calendar.primary === true,
      timezone: calendar.timeZone ?? null,
      access_role: calendar.accessRole ?? null,
    }));

    const { error: calendarsUpsertError } = await supabase
      .from("google_calendars")
      .upsert(calendarRows, {
        onConflict: "connection_id,google_calendar_id",
      });

    if (calendarsUpsertError) {
      throw new Error("Failed to persist Google calendar list.");
    }
  }

  return {
    connectionId: connection.id as string,
    calendarCount: calendars.length,
    primaryCalendarId: primaryCalendar.id,
  };
}
