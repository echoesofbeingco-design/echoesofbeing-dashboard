/**
 * Google Calendar integration.
 *
 * Nidhi connects her Google account once from the dashboard; we store the
 * refresh token in Firestore (`config/google`) so both this app and the public
 * website can create session events on her calendar.
 *
 * Uses Google's REST API directly via fetch — no `googleapis` dependency.
 *
 * Everything here degrades gracefully: if the integration isn't configured or
 * Google is down, callers get a null/failed result and should still complete
 * the booking. A calendar hiccup must never stop someone booking therapy.
 */

import { getAdminDb } from "@/lib/firebase-admin";

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo";
const EVENTS_URL =
  "https://www.googleapis.com/calendar/v3/calendars/primary/events";

/** calendar.events lets us create/update/delete events on her calendar. */
export const GOOGLE_SCOPES = [
  "https://www.googleapis.com/auth/calendar.events",
  "openid",
  "email",
].join(" ");

const CONFIG_COLLECTION = "config";
const GOOGLE_DOC = "google";

export interface GoogleConnection {
  connected: boolean;
  email?: string;
  refreshToken?: string;
  scope?: string;
  connectedAt?: string;
  connectedBy?: string;
}

/* ─────────────────────────────  config  ───────────────────────────── */

export function getOAuthConfig(): {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
} | null {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri =
    process.env.GOOGLE_OAUTH_REDIRECT_URI ||
    "http://localhost:3001/api/google/callback";

  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret, redirectUri };
}

export function isGoogleConfigured(): boolean {
  return getOAuthConfig() !== null;
}

/* ───────────────────────────  connection  ─────────────────────────── */

export async function getConnection(): Promise<GoogleConnection> {
  try {
    const snap = await getAdminDb()
      .collection(CONFIG_COLLECTION)
      .doc(GOOGLE_DOC)
      .get();
    if (!snap.exists) return { connected: false };
    return (snap.data() as GoogleConnection) ?? { connected: false };
  } catch (error) {
    console.error("google: failed to read connection", error);
    return { connected: false };
  }
}

export async function saveConnection(
  connection: GoogleConnection
): Promise<void> {
  await getAdminDb()
    .collection(CONFIG_COLLECTION)
    .doc(GOOGLE_DOC)
    .set(connection, { merge: true });
}

export async function disconnect(): Promise<void> {
  await getAdminDb().collection(CONFIG_COLLECTION).doc(GOOGLE_DOC).set(
    {
      connected: false,
      refreshToken: "",
      email: "",
      disconnectedAt: new Date().toISOString(),
    },
    { merge: true }
  );
}

/* ──────────────────────────  oauth flow  ──────────────────────────── */

export function buildConsentUrl(state: string): string | null {
  const config = getOAuthConfig();
  if (!config) return null;

  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: "code",
    scope: GOOGLE_SCOPES,
    // offline + consent guarantee we actually receive a refresh token,
    // even if she has authorised this app before.
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state,
  });

  return `${AUTH_URL}?${params.toString()}`;
}

interface TokenResponse {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  error?: string;
  error_description?: string;
}

export async function exchangeCodeForTokens(code: string): Promise<{
  ok: boolean;
  refreshToken?: string;
  accessToken?: string;
  scope?: string;
  error?: string;
}> {
  const config = getOAuthConfig();
  if (!config) return { ok: false, error: "Google credentials are not set." };

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uri: config.redirectUri,
      grant_type: "authorization_code",
    }),
  });

  const data = (await res.json()) as TokenResponse;
  if (!res.ok || data.error) {
    return {
      ok: false,
      error: data.error_description || data.error || "Token exchange failed.",
    };
  }
  if (!data.refresh_token) {
    return {
      ok: false,
      error:
        "Google did not return a refresh token. Remove this app from your Google account permissions and connect again.",
    };
  }

  return {
    ok: true,
    refreshToken: data.refresh_token,
    accessToken: data.access_token,
    scope: data.scope,
  };
}

/** Exchange the stored refresh token for a short-lived access token. */
export async function getAccessToken(): Promise<string | null> {
  const config = getOAuthConfig();
  if (!config) return null;

  const connection = await getConnection();
  if (!connection.connected || !connection.refreshToken) return null;

  try {
    const res = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: config.clientId,
        client_secret: config.clientSecret,
        refresh_token: connection.refreshToken,
        grant_type: "refresh_token",
      }),
    });

    const data = (await res.json()) as TokenResponse;
    if (!res.ok || !data.access_token) {
      console.error("google: refresh failed", data.error_description || data.error);
      // A revoked/expired refresh token can never recover on its own — flag it
      // so the dashboard can prompt for a reconnect.
      if (data.error === "invalid_grant") {
        await saveConnection({ connected: false, refreshToken: "" });
      }
      return null;
    }
    return data.access_token;
  } catch (error) {
    console.error("google: refresh threw", error);
    return null;
  }
}

export async function fetchAccountEmail(
  accessToken: string
): Promise<string | undefined> {
  try {
    const res = await fetch(USERINFO_URL, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) return undefined;
    const data = (await res.json()) as { email?: string };
    return data.email;
  } catch {
    return undefined;
  }
}

/* ────────────────────────────  events  ────────────────────────────── */

export interface CreateEventInput {
  summary: string;
  description?: string;
  /** ISO 8601 UTC instants. */
  startISO: string;
  endISO: string;
  timezone: string;
  attendeeEmail?: string;
  attendeeName?: string;
  /** Adds a Google Meet link to the event. */
  withMeet?: boolean;
}

export interface CreatedEvent {
  eventId: string;
  htmlLink?: string;
  meetLink?: string;
}

/**
 * Create the session on her calendar, inviting the client as an attendee so
 * Google emails them an invite that lands in their own calendar.
 * Returns null (never throws) when the integration is unavailable.
 */
export async function createEvent(
  input: CreateEventInput
): Promise<CreatedEvent | null> {
  const accessToken = await getAccessToken();
  if (!accessToken) return null;

  const body: Record<string, unknown> = {
    summary: input.summary,
    description: input.description ?? "",
    start: { dateTime: input.startISO, timeZone: input.timezone },
    end: { dateTime: input.endISO, timeZone: input.timezone },
    reminders: { useDefault: true },
  };

  if (input.attendeeEmail) {
    body.attendees = [
      { email: input.attendeeEmail, displayName: input.attendeeName },
    ];
  }

  if (input.withMeet !== false) {
    body.conferenceData = {
      createRequest: {
        // Must be unique per request; Google dedupes on it.
        requestId: `eob-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
        conferenceSolutionKey: { type: "hangoutsMeet" },
      },
    };
  }

  try {
    const params = new URLSearchParams({
      conferenceDataVersion: "1",
      sendUpdates: "all",
    });
    const res = await fetch(`${EVENTS_URL}?${params.toString()}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const data = (await res.json()) as {
      id?: string;
      htmlLink?: string;
      hangoutLink?: string;
      error?: { message?: string };
    };

    if (!res.ok || !data.id) {
      console.error("google: create event failed", data.error?.message ?? data);
      return null;
    }

    return {
      eventId: data.id,
      htmlLink: data.htmlLink,
      meetLink: data.hangoutLink,
    };
  } catch (error) {
    console.error("google: create event threw", error);
    return null;
  }
}

/**
 * Move an existing event to a new time.
 *
 * A PATCH keeps the same event id and Meet link, and with sendUpdates=all
 * Google emails the guest an "event updated" notice automatically — so the
 * client's existing calendar entry simply shifts rather than being cancelled
 * and recreated. Returns the (unchanged) links, or null if the event is gone.
 */
export async function updateEventTime(
  eventId: string,
  input: { startISO: string; endISO: string; timezone: string }
): Promise<CreatedEvent | null> {
  const accessToken = await getAccessToken();
  if (!accessToken) return null;

  try {
    const res = await fetch(
      `${EVENTS_URL}/${encodeURIComponent(eventId)}?sendUpdates=all`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          start: { dateTime: input.startISO, timeZone: input.timezone },
          end: { dateTime: input.endISO, timeZone: input.timezone },
        }),
      }
    );

    const data = (await res.json()) as {
      id?: string;
      htmlLink?: string;
      hangoutLink?: string;
      error?: { message?: string };
    };

    if (!res.ok || !data.id) {
      console.error("google: update event failed", data.error?.message ?? data);
      return null;
    }

    return {
      eventId: data.id,
      htmlLink: data.htmlLink,
      meetLink: data.hangoutLink,
    };
  } catch (error) {
    console.error("google: update event threw", error);
    return null;
  }
}

/** Remove a session from the calendar (used when a booking is cancelled). */
export async function deleteEvent(eventId: string): Promise<boolean> {
  const accessToken = await getAccessToken();
  if (!accessToken) return false;

  try {
    const res = await fetch(
      `${EVENTS_URL}/${encodeURIComponent(eventId)}?sendUpdates=all`,
      {
        method: "DELETE",
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );
    // 410 = already deleted, which is fine.
    return res.ok || res.status === 410;
  } catch (error) {
    console.error("google: delete event threw", error);
    return false;
  }
}
