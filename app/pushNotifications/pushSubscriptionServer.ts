import "server-only";

import { createSupabaseServerClient } from "@/lib/supabaseServer";

const MAX_ENDPOINT_LENGTH = 2048;
const MAX_KEY_LENGTH = 512;

type PushSubscriptionInput = {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
};

function isSafePushEndpoint(value: unknown): value is string {
  if (typeof value !== "string" || value.length < 20 || value.length > MAX_ENDPOINT_LENGTH) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:";
  } catch {
    return false;
  }
}

function isSafePushKey(value: unknown): value is string {
  return typeof value === "string" && value.length >= 16 && value.length <= MAX_KEY_LENGTH;
}

export function validatePushSubscriptionInput(value: unknown): PushSubscriptionInput | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const keys = record.keys;
  if (!keys || typeof keys !== "object" || Array.isArray(keys)) return null;
  const keyRecord = keys as Record<string, unknown>;

  if (!isSafePushEndpoint(record.endpoint)) return null;
  if (!isSafePushKey(keyRecord.p256dh) || !isSafePushKey(keyRecord.auth)) return null;

  return {
    endpoint: record.endpoint,
    keys: {
      p256dh: keyRecord.p256dh,
      auth: keyRecord.auth,
    },
  };
}

export async function savePushSubscription(
  syncCode: string,
  subscription: PushSubscriptionInput,
  userAgent: string | null
) {
  const supabase = createSupabaseServerClient();
  const { error } = await supabase.from("push_subscriptions").upsert(
    {
      sync_code: syncCode,
      endpoint: subscription.endpoint,
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
      user_agent: userAgent,
      disabled_at: null,
      last_seen_at: new Date().toISOString(),
      metadata: {},
    },
    { onConflict: "endpoint" }
  );

  if (error) throw new Error("Failed to save push subscription.");
}

export async function disablePushSubscription(syncCode: string, endpoint: string) {
  if (!isSafePushEndpoint(endpoint)) throw new Error("Invalid push subscription endpoint.");

  const supabase = createSupabaseServerClient();
  const { error } = await supabase
    .from("push_subscriptions")
    .update({ disabled_at: new Date().toISOString() })
    .eq("sync_code", syncCode)
    .eq("endpoint", endpoint);

  if (error) throw new Error("Failed to disable push subscription.");
}
