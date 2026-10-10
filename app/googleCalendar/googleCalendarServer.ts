import "server-only";

import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { isCalendarEventType, type CalendarEventType } from "../calendarEventStore/calendarEventTypes";
import { decryptGoogleToken, encryptGoogleToken } from "./googleTokenCrypto";
import type {
  GoogleCalendarConnectionSummary,
  GoogleCalendarEvent,
  GoogleCalendarSummary,
} from "./googleCalendarTypes";

export const GOOGLE_CALENDAR_READONLY_SCOPE = "https://www.googleapis.com/auth/calendar.readonly";
export const GOOGLE_OAUTH_STATE_COOKIE = "pineapple_google_oauth_state";

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_CALENDAR_LIST_URL = "https://www.googleapis.com/calendar/v3/users/me/calendarList";
const GOOGLE_EVENTS_URL = "https://www.googleapis.com/calendar/v3/calendars";
const GOOGLE_CATEGORY_FALLBACK: CalendarEventType = "personal";
const GOOGLE_CALENDAR_DEFAULT_CATEGORY_BY_ID_OR_SUMMARY = new Map<string, CalendarEventType>([
  ["yasmine.maccallum.laraki@students.iaac.net", "class"],
  ["25/26 iaac precourse", "class"],
  ["yasmine.maccallum@hotmail.com", "personal"],
  ["yasmine.maccallum@gmail.com", "personal"],
  ["ymaccallum.laraki@gmail.com", "personal"],
  ["holidays in spain", "personal"],
]);

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

type GoogleCalendarEventDate = {
  date?: string;
  dateTime?: string;
  timeZone?: string;
};

type GoogleCalendarApiEvent = {
  id?: string;
  summary?: string;
  description?: string;
  location?: string;
  htmlLink?: string;
  start?: GoogleCalendarEventDate;
  end?: GoogleCalendarEventDate;
  status?: string;
  updated?: string;
  etag?: string;
  recurringEventId?: string;
  originalStartTime?: GoogleCalendarEventDate;
};

type GoogleCalendarEventsResponse = {
  items?: GoogleCalendarApiEvent[];
  nextPageToken?: string;
  error?: {
    message?: string;
  };
};

function normalizedCalendarKey(value?: string | null) {
  return (value ?? "").trim().toLowerCase();
}

function defaultCategoryForGoogleCalendar(calendar: Pick<GoogleCalendarListEntry, "id" | "summary">) {
  return (
    GOOGLE_CALENDAR_DEFAULT_CATEGORY_BY_ID_OR_SUMMARY.get(normalizedCalendarKey(calendar.id)) ??
    GOOGLE_CALENDAR_DEFAULT_CATEGORY_BY_ID_OR_SUMMARY.get(normalizedCalendarKey(calendar.summary)) ??
    GOOGLE_CATEGORY_FALLBACK
  );
}

function normalizeGoogleCategory(value: unknown): CalendarEventType {
  return isCalendarEventType(value) ? value : GOOGLE_CATEGORY_FALLBACK;
}

function nullableGoogleCategory(value: unknown): CalendarEventType | null {
  return isCalendarEventType(value) ? value : null;
}

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
    .select("google_calendar_id, selected, visible_in_planner, default_category")
    .eq("connection_id", connection.id);

  if (calendarsReadError) {
    throw new Error("Failed to read existing Google calendars.");
  }

  const existingByCalendarId = new Map(
    (existingCalendars ?? []).map((calendar) => [String(calendar.google_calendar_id), calendar])
  );

  if (calendars.length) {
    const calendarRows = calendars.map((calendar) => {
      const existing = existingByCalendarId.get(calendar.id);
      return {
        sync_code: syncCode,
        connection_id: connection.id,
        google_calendar_id: calendar.id,
        summary: calendar.summary || calendar.id,
        description: calendar.description ?? null,
        primary_calendar: calendar.primary === true,
        background_color: calendar.backgroundColor ?? null,
        foreground_color: calendar.foregroundColor ?? null,
        selected: existing ? existing.selected === true : calendar.primary === true,
        visible_in_planner: existing ? existing.visible_in_planner !== false : true,
        default_category:
          existing && isCalendarEventType(existing.default_category)
            ? existing.default_category
            : defaultCategoryForGoogleCalendar(calendar),
        timezone: calendar.timeZone ?? null,
        access_role: calendar.accessRole ?? null,
      };
    });

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

function googleConnectionFromRow(row: Record<string, unknown>): GoogleCalendarConnectionSummary {
  return {
    id: String(row.id),
    googleAccountId: String(row.google_account_id ?? ""),
    googleEmail: typeof row.google_email === "string" ? row.google_email : null,
    connectedAt: typeof row.connected_at === "string" ? row.connected_at : null,
    lastCalendarDiscoveryAt:
      typeof row.last_calendar_discovery_at === "string" ? row.last_calendar_discovery_at : null,
  };
}

function googleCalendarFromRow(row: Record<string, unknown>): GoogleCalendarSummary {
  return {
    id: String(row.id),
    connectionId: String(row.connection_id),
    googleCalendarId: String(row.google_calendar_id),
    summary: String(row.summary ?? "Calendar"),
    primary: row.primary_calendar === true,
    backgroundColor: typeof row.background_color === "string" ? row.background_color : null,
    foregroundColor: typeof row.foreground_color === "string" ? row.foreground_color : null,
    selected: row.selected === true,
    visibleInPlanner: row.visible_in_planner !== false,
    defaultCategory: normalizeGoogleCategory(row.default_category),
    timezone: typeof row.timezone === "string" ? row.timezone : null,
    accessRole: typeof row.access_role === "string" ? row.access_role : null,
  };
}

function googleEventFromRow(row: Record<string, unknown>): GoogleCalendarEvent {
  return {
    id: String(row.id),
    connectionId: String(row.connection_id),
    googleCalendarRowId: String(row.google_calendar_row_id),
    googleCalendarId: String(row.google_calendar_id),
    googleEventId: String(row.google_event_id),
    googleInstanceId: String(row.google_instance_id),
    title: String(row.title ?? "Untitled Google event"),
    description: typeof row.description === "string" ? row.description : null,
    location: typeof row.location === "string" ? row.location : null,
    htmlLink: typeof row.html_link === "string" ? row.html_link : null,
    allDay: row.all_day === true,
    startAt: typeof row.start_at === "string" ? row.start_at : null,
    endAt: typeof row.end_at === "string" ? row.end_at : null,
    startDate: typeof row.start_date === "string" ? row.start_date : null,
    endDate: typeof row.end_date === "string" ? row.end_date : null,
    timezone: typeof row.timezone === "string" ? row.timezone : null,
    status: typeof row.status === "string" ? row.status : null,
    googleUpdatedAt: typeof row.google_updated_at === "string" ? row.google_updated_at : null,
    etag: typeof row.etag === "string" ? row.etag : null,
    recurringEventId: typeof row.recurring_event_id === "string" ? row.recurring_event_id : null,
    calendarSummary: String(row.calendar_summary ?? "Google Calendar"),
    calendarColor: typeof row.calendar_color === "string" ? row.calendar_color : null,
    calendarDefaultCategory: normalizeGoogleCategory(row.calendar_default_category),
    categoryOverride: nullableGoogleCategory(row.category_override),
    resolvedCategory:
      nullableGoogleCategory(row.category_override) ??
      normalizeGoogleCategory(row.calendar_default_category),
  };
}

export async function loadGoogleCalendarSettings(syncCode: string) {
  const supabase = createSupabaseServerClient();
  const { data: connectionsData, error: connectionsError } = await supabase
    .from("google_calendar_connections")
    .select("id, google_account_id, google_email, connected_at, last_calendar_discovery_at")
    .eq("sync_code", syncCode)
    .order("connected_at", { ascending: false });

  if (connectionsError) throw new Error("Failed to load Google Calendar connections.");

  const { data: calendarsData, error: calendarsError } = await supabase
    .from("google_calendars")
    .select(
      "id, connection_id, google_calendar_id, summary, primary_calendar, background_color, foreground_color, selected, timezone, access_role"
        + ", visible_in_planner, default_category"
    )
    .eq("sync_code", syncCode)
    .order("primary_calendar", { ascending: false })
    .order("summary", { ascending: true });

  if (calendarsError) throw new Error("Failed to load Google calendars.");

  return {
    connections: (connectionsData ?? []).map((row) => googleConnectionFromRow(row as unknown as Record<string, unknown>)),
    calendars: (calendarsData ?? []).map((row) => googleCalendarFromRow(row as unknown as Record<string, unknown>)),
  };
}

export async function updateGoogleCalendarSelected(syncCode: string, calendarId: string, selected: boolean) {
  const supabase = createSupabaseServerClient();
  const { error } = await supabase
    .from("google_calendars")
    .update({ selected })
    .eq("sync_code", syncCode)
    .eq("id", calendarId);

  if (error) throw new Error("Failed to update Google calendar selection.");
}

export async function updateGoogleCalendarSettings(
  syncCode: string,
  calendarId: string,
  changes: { selected?: boolean; visibleInPlanner?: boolean; defaultCategory?: string }
) {
  const update: Record<string, unknown> = {};
  if (typeof changes.selected === "boolean") update.selected = changes.selected;
  if (typeof changes.visibleInPlanner === "boolean") update.visible_in_planner = changes.visibleInPlanner;
  if (isCalendarEventType(changes.defaultCategory)) update.default_category = changes.defaultCategory;

  if (Object.keys(update).length === 0) {
    throw new Error("No valid Google calendar setting was provided.");
  }

  const supabase = createSupabaseServerClient();
  const { error } = await supabase
    .from("google_calendars")
    .update(update)
    .eq("sync_code", syncCode)
    .eq("id", calendarId);

  if (error) throw new Error("Failed to update Google calendar settings.");
}

function subtractOneDay(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day - 1));
  return parsed.toISOString().slice(0, 10);
}

function googleApiEventToPayload(
  event: GoogleCalendarApiEvent,
  calendar: GoogleCalendarSummary,
  syncCode: string,
  seenAt: string
) {
  const googleEventId = event.id;
  if (!googleEventId || !event.start) return null;

  const allDay = Boolean(event.start.date);
  const startDate = event.start.date ?? null;
  const exclusiveEndDate = event.end?.date ?? null;
  const endDate = allDay && exclusiveEndDate ? subtractOneDay(exclusiveEndDate) : null;
  const startAt = event.start.dateTime ?? null;
  const endAt = event.end?.dateTime ?? null;
  const originalStartAt = event.originalStartTime?.dateTime ?? null;
  const originalStartDate = event.originalStartTime?.date ?? null;
  const instanceId = event.recurringEventId
    ? `${event.recurringEventId}:${originalStartAt ?? originalStartDate ?? googleEventId}`
    : googleEventId;

  if (allDay && !startDate) return null;
  if (!allDay && !startAt) return null;

  return {
    sync_code: syncCode,
    connection_id: calendar.connectionId,
    google_calendar_row_id: calendar.id,
    google_calendar_id: calendar.googleCalendarId,
    google_event_id: googleEventId,
    google_instance_id: instanceId,
    title: event.summary || "(No title)",
    description: event.description ?? null,
    location: event.location ?? null,
    html_link: event.htmlLink ?? null,
    all_day: allDay,
    start_at: allDay ? null : startAt,
    end_at: allDay ? null : endAt,
    start_date: allDay ? startDate : null,
    end_date: allDay ? endDate : null,
    timezone: event.start.timeZone ?? event.end?.timeZone ?? calendar.timezone,
    status: event.status ?? null,
    google_updated_at: event.updated ?? null,
    etag: event.etag ?? null,
    recurring_event_id: event.recurringEventId ?? null,
    original_start_at: originalStartAt,
    original_start_date: originalStartDate,
    raw: event as Record<string, unknown>,
    last_seen_at: seenAt,
  };
}

async function fetchGoogleEventsForCalendar(
  accessToken: string,
  calendarId: string,
  timeMin: string,
  timeMax: string
) {
  const events: GoogleCalendarApiEvent[] = [];
  let pageToken = "";

  do {
    const params = new URLSearchParams({
      singleEvents: "true",
      orderBy: "startTime",
      showDeleted: "true",
      timeMin,
      timeMax,
      maxResults: "2500",
    });
    if (pageToken) params.set("pageToken", pageToken);

    const response = await fetch(`${GOOGLE_EVENTS_URL}/${encodeURIComponent(calendarId)}/events?${params}`, {
      headers: {
        authorization: `Bearer ${accessToken}`,
        accept: "application/json",
      },
    });
    const data = (await response.json()) as GoogleCalendarEventsResponse;

    if (!response.ok) {
      throw new Error(data.error?.message || "Google event sync failed.");
    }

    events.push(...(data.items ?? []));
    pageToken = data.nextPageToken ?? "";
  } while (pageToken);

  return events;
}

export async function syncSelectedGoogleCalendarEvents(syncCode: string) {
  const supabase = createSupabaseServerClient();
  const { calendars } = await loadGoogleCalendarSettings(syncCode);
  const selectedCalendars = calendars.filter((calendar) => calendar.selected);
  const now = new Date();
  const windowStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const windowEnd = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000).toISOString();
  const seenAt = new Date().toISOString();
  let synced = 0;
  let errors = 0;

  for (const calendar of selectedCalendars) {
    try {
      const accessToken = await getFreshGoogleAccessToken(calendar.connectionId);
      const googleEvents = await fetchGoogleEventsForCalendar(
        accessToken,
        calendar.googleCalendarId,
        windowStart,
        windowEnd
      );
      const payloads = googleEvents
        .map((event) => googleApiEventToPayload(event, calendar, syncCode, seenAt))
        .filter((event): event is NonNullable<typeof event> => Boolean(event));

      if (payloads.length) {
        const { error: upsertError } = await supabase
          .from("google_calendar_events")
          .upsert(payloads, { onConflict: "connection_id,google_calendar_id,google_instance_id" });

        if (upsertError) throw new Error("Failed to upsert Google events.");
        synced += payloads.length;
      }

      const returnedIds = payloads.map((event) => event.google_instance_id);
      let staleQuery = supabase
        .from("google_calendar_events")
        .update({ status: "stale" })
        .eq("sync_code", syncCode)
        .eq("google_calendar_row_id", calendar.id)
        .neq("status", "cancelled")
        .or(`start_at.gte.${windowStart},start_date.gte.${windowStart.slice(0, 10)}`)
        .or(`start_at.lte.${windowEnd},start_date.lte.${windowEnd.slice(0, 10)}`);

      if (returnedIds.length) {
        staleQuery = staleQuery.not("google_instance_id", "in", `(${returnedIds.map((id) => `"${id.replace(/"/g, '\\"')}"`).join(",")})`);
      }

      const { error: staleError } = await staleQuery;
      if (staleError) throw new Error("Failed to reconcile stale Google events.");
    } catch (error) {
      errors += 1;
      console.error(`Failed to sync Google calendar ${calendar.googleCalendarId}:`, error);
    }
  }

  return { synced, errors };
}

export async function loadCachedGoogleCalendarEvents(syncCode: string) {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("google_calendar_events")
    .select(
      [
        "id",
        "connection_id",
        "google_calendar_row_id",
        "google_calendar_id",
        "google_event_id",
        "google_instance_id",
        "title",
        "description",
        "location",
        "html_link",
        "all_day",
        "start_at",
        "end_at",
        "start_date",
        "end_date",
        "timezone",
        "status",
        "google_updated_at",
        "etag",
        "recurring_event_id",
        "google_calendars!inner(summary,background_color,selected,visible_in_planner,default_category)",
        "google_calendar_event_overrides(category_override)",
      ].join(",")
    )
    .eq("sync_code", syncCode)
    .eq("google_calendars.selected", true)
    .eq("google_calendars.visible_in_planner", true)
    .neq("status", "cancelled")
    .neq("status", "stale")
    .order("start_date", { ascending: true })
    .order("start_at", { ascending: true });

  if (error) throw new Error("Failed to load cached Google events.");

  return (data ?? []).map((rawRow) => {
    const row = rawRow as unknown as Record<string, unknown>;
    const calendar = row.google_calendars as { summary?: string; background_color?: string; default_category?: string } | null;
    const overrides = row.google_calendar_event_overrides as Array<{ category_override?: string | null }> | null;
    const override = Array.isArray(overrides) ? overrides[0] : null;
    return googleEventFromRow({
      ...row,
      calendar_summary: calendar?.summary,
      calendar_color: calendar?.background_color,
      calendar_default_category: calendar?.default_category,
      category_override: override?.category_override,
    });
  });
}

export async function updateGoogleEventCategoryOverride(
  syncCode: string,
  eventId: string,
  categoryOverride: string | null
) {
  const supabase = createSupabaseServerClient();
  const { data: event, error: eventError } = await supabase
    .from("google_calendar_events")
    .select("id, sync_code, connection_id, google_calendar_id, google_instance_id")
    .eq("sync_code", syncCode)
    .eq("id", eventId)
    .single();

  if (eventError || !event) {
    throw new Error("Google event was not found.");
  }

  if (categoryOverride === null || categoryOverride === "") {
    const { error } = await supabase
      .from("google_calendar_event_overrides")
      .delete()
      .eq("sync_code", syncCode)
      .eq("google_calendar_event_row_id", eventId);
    if (error) throw new Error("Failed to clear Google event category override.");
  } else if (isCalendarEventType(categoryOverride)) {
    const { error } = await supabase
      .from("google_calendar_event_overrides")
      .upsert(
        {
          sync_code: syncCode,
          google_calendar_event_row_id: event.id,
          connection_id: event.connection_id,
          google_calendar_id: event.google_calendar_id,
          google_instance_id: event.google_instance_id,
          category_override: categoryOverride,
        },
        { onConflict: "google_calendar_event_row_id" }
      );
    if (error) throw new Error("Failed to save Google event category override.");
  } else {
    throw new Error("Invalid Google event category override.");
  }

  const events = await loadCachedGoogleCalendarEvents(syncCode);
  return events.find((item) => item.id === eventId) ?? null;
}
