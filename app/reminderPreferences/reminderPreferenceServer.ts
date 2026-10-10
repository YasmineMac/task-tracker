import "server-only";

import { createSupabaseServerClient } from "@/lib/supabaseServer";
import {
  REMINDER_MODES,
  REMINDER_OFFSET_UNITS,
  REMINDER_SOURCE_TYPES,
  type ReminderMode,
  type ReminderOffsetUnit,
  type ReminderPreference,
  type ReminderPreferenceInput,
  type ReminderSourceType,
} from "./reminderPreferenceTypes";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_OFFSET_MINUTES = 365 * 24 * 60;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function preferenceFromRow(row: Record<string, unknown>): ReminderPreference {
  return {
    id: String(row.id),
    sourceType: row.source_type as ReminderSourceType,
    sourceId: String(row.source_id),
    reminderMode: row.reminder_mode as ReminderMode,
    offsetAmount: typeof row.offset_amount === "number" ? row.offset_amount : null,
    offsetUnit: typeof row.offset_unit === "string" ? (row.offset_unit as ReminderOffsetUnit) : null,
    metadata: isRecord(row.metadata) ? row.metadata : {},
    createdAt: typeof row.created_at === "string" ? row.created_at : undefined,
    updatedAt: typeof row.updated_at === "string" ? row.updated_at : undefined,
  };
}

function offsetToMinutes(amount: number, unit: ReminderOffsetUnit) {
  if (unit === "days") return amount * 24 * 60;
  if (unit === "hours") return amount * 60;
  return amount;
}

export function validateReminderSource(sourceType: unknown, sourceId: unknown) {
  if (typeof sourceType !== "string" || !REMINDER_SOURCE_TYPES.has(sourceType as ReminderSourceType)) {
    return null;
  }
  if (typeof sourceId !== "string" || !UUID_PATTERN.test(sourceId)) {
    return null;
  }
  return { sourceType: sourceType as ReminderSourceType, sourceId };
}

export function validateReminderPreferenceInput(value: unknown): ReminderPreferenceInput | null {
  if (!isRecord(value)) return null;
  const source = validateReminderSource(value.sourceType, value.sourceId);
  if (!source) return null;

  if (typeof value.reminderMode !== "string" || !REMINDER_MODES.has(value.reminderMode as ReminderMode)) {
    return null;
  }

  const reminderMode = value.reminderMode as ReminderMode;
  if (reminderMode === "offset") {
    const amount = Number(value.offsetAmount);
    const unit = value.offsetUnit;
    if (
      !Number.isInteger(amount) ||
      amount <= 0 ||
      typeof unit !== "string" ||
      !REMINDER_OFFSET_UNITS.has(unit as ReminderOffsetUnit) ||
      offsetToMinutes(amount, unit as ReminderOffsetUnit) > MAX_OFFSET_MINUTES
    ) {
      return null;
    }
    return {
      ...source,
      reminderMode,
      offsetAmount: amount,
      offsetUnit: unit as ReminderOffsetUnit,
    };
  }

  if (value.offsetAmount !== null && value.offsetAmount !== undefined) return null;
  if (value.offsetUnit !== null && value.offsetUnit !== undefined) return null;

  return {
    ...source,
    reminderMode,
    offsetAmount: null,
    offsetUnit: null,
  };
}

export async function reminderSourceExists(syncCode: string, sourceType: ReminderSourceType, sourceId: string) {
  const supabase = createSupabaseServerClient();
  if (sourceType === "google_event") {
    const { data, error } = await supabase
      .from("google_calendar_events")
      .select("id")
      .eq("sync_code", syncCode)
      .eq("id", sourceId)
      .neq("status", "cancelled")
      .neq("status", "stale")
      .maybeSingle();
    return !error && Boolean(data);
  }

  if (sourceType === "calendar_event") {
    const { data, error } = await supabase
      .from("calendar_events")
      .select("id")
      .eq("sync_code", syncCode)
      .eq("id", sourceId)
      .maybeSingle();
    return !error && Boolean(data);
  }

  const { data, error } = await supabase
    .from("tasks")
    .select("id")
    .eq("sync_code", syncCode)
    .eq("id", sourceId)
    .is("deleted_at", null)
    .maybeSingle();
  return !error && Boolean(data);
}

export async function loadReminderPreference(
  syncCode: string,
  sourceType: ReminderSourceType,
  sourceId: string
) {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("reminder_preferences")
    .select("*")
    .eq("sync_code", syncCode)
    .eq("source_type", sourceType)
    .eq("source_id", sourceId)
    .maybeSingle();

  if (error) throw new Error("Failed to load reminder preference.");
  return data ? preferenceFromRow(data as Record<string, unknown>) : null;
}

export async function upsertReminderPreference(syncCode: string, input: ReminderPreferenceInput) {
  if (!(await reminderSourceExists(syncCode, input.sourceType, input.sourceId))) {
    throw new Error("Reminder source was not found.");
  }

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("reminder_preferences")
    .upsert(
      {
        sync_code: syncCode,
        source_type: input.sourceType,
        source_id: input.sourceId,
        reminder_mode: input.reminderMode,
        offset_amount: input.reminderMode === "offset" ? input.offsetAmount ?? null : null,
        offset_unit: input.reminderMode === "offset" ? input.offsetUnit ?? null : null,
        metadata: {},
      },
      { onConflict: "sync_code,source_type,source_id" }
    )
    .select("*")
    .single();

  if (error || !data) throw new Error("Failed to save reminder preference.");
  return preferenceFromRow(data as Record<string, unknown>);
}

export async function deleteReminderPreference(
  syncCode: string,
  sourceType: ReminderSourceType,
  sourceId: string
) {
  if (!(await reminderSourceExists(syncCode, sourceType, sourceId))) {
    throw new Error("Reminder source was not found.");
  }

  const supabase = createSupabaseServerClient();
  const { error } = await supabase
    .from("reminder_preferences")
    .delete()
    .eq("sync_code", syncCode)
    .eq("source_type", sourceType)
    .eq("source_id", sourceId);

  if (error) throw new Error("Failed to reset reminder preference.");
}
