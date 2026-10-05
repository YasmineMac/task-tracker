export type GoogleCalendarConnectionSummary = {
  id: string;
  googleAccountId: string;
  googleEmail: string | null;
  connectedAt: string | null;
  lastCalendarDiscoveryAt: string | null;
};

export type GoogleCalendarSummary = {
  id: string;
  connectionId: string;
  googleCalendarId: string;
  summary: string;
  primary: boolean;
  backgroundColor: string | null;
  foregroundColor: string | null;
  selected: boolean;
  timezone: string | null;
  accessRole: string | null;
};

export type GoogleCalendarEvent = {
  id: string;
  connectionId: string;
  googleCalendarRowId: string;
  googleCalendarId: string;
  googleEventId: string;
  googleInstanceId: string;
  title: string;
  description: string | null;
  location: string | null;
  htmlLink: string | null;
  allDay: boolean;
  startAt: string | null;
  endAt: string | null;
  startDate: string | null;
  endDate: string | null;
  timezone: string | null;
  status: string | null;
  googleUpdatedAt: string | null;
  etag: string | null;
  recurringEventId: string | null;
  calendarSummary: string;
  calendarColor: string | null;
};
