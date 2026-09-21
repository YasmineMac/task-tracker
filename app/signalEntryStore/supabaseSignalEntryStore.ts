import { supabase } from "@/lib/supabase";
import {
  isValidAlcoholEntryUuid,
  normalizeAlcoholEntry,
  type AlcoholEntry,
} from "./alcoholEntryTypes";

type SignalEntryRow = Record<string, unknown>;

function alcoholEntryFromRow(row: SignalEntryRow) {
  return normalizeAlcoholEntry({
    id: row.id,
    signalType: row.signal_type,
    drinkType: row.drink_type,
    quantity: row.quantity,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    alcoholUnits: row.alcohol_units,
    feelingsSymptoms: row.feelings_symptoms,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
}

function alcoholEntryPayload(entry: AlcoholEntry, syncCode: string) {
  return {
    id: entry.id,
    sync_code: syncCode,
    signal_type: "alcohol",
    drink_type: entry.drinkType,
    quantity: entry.quantity,
    started_at: entry.startedAt,
    ended_at: entry.endedAt ?? null,
    alcohol_units: entry.alcoholUnits ?? null,
    feelings_symptoms: entry.feelingsSymptoms ?? null,
  };
}

export async function loadAlcoholEntries(syncCode: string) {
  if (!supabase) {
    console.warn("Skipped alcohol entry load: Supabase env vars are missing");
    return { ok: false, entries: [] as AlcoholEntry[] };
  }

  const { data, error } = await supabase
    .from("signal_entries")
    .select(
      [
        "id",
        "signal_type",
        "drink_type",
        "quantity",
        "started_at",
        "ended_at",
        "alcohol_units",
        "feelings_symptoms",
        "created_at",
        "updated_at",
      ].join(",")
    )
    .eq("sync_code", syncCode)
    .eq("signal_type", "alcohol")
    .order("started_at", { ascending: false });

  if (error) {
    console.warn("Failed to load alcohol entries from Supabase:", error);
    return { ok: false, entries: [] as AlcoholEntry[] };
  }

  const rows = (data ?? []) as unknown as SignalEntryRow[];
  const entries = rows
    .map((row) => alcoholEntryFromRow(row))
    .filter((entry): entry is AlcoholEntry => Boolean(entry));

  if (entries.length !== rows.length) {
    console.warn("Skipped invalid alcohol rows while loading from Supabase", {
      received: rows.length,
      normalized: entries.length,
    });
  }

  return { ok: true, entries };
}

export async function saveAlcoholEntry(entry: AlcoholEntry, syncCode: string) {
  if (!supabase) {
    console.warn("Skipped alcohol entry save: Supabase env vars are missing");
    return false;
  }

  const normalizedEntry = normalizeAlcoholEntry(entry);
  if (!normalizedEntry) {
    console.warn("Skipped alcohol entry save: entry failed normalization", { id: entry.id });
    return false;
  }

  const { error } = await supabase
    .from("signal_entries")
    .upsert(alcoholEntryPayload(normalizedEntry, syncCode), { onConflict: "id" });

  if (error) {
    console.warn("Failed to save alcohol entry to Supabase:", {
      operation: "upsert",
      id: normalizedEntry.id,
      error,
    });
    return false;
  }

  return true;
}

export async function updateAlcoholEntry(entry: AlcoholEntry, syncCode: string) {
  if (!supabase) {
    console.warn("Skipped alcohol entry update: Supabase env vars are missing");
    return false;
  }

  const normalizedEntry = normalizeAlcoholEntry(entry);
  if (!normalizedEntry) {
    console.warn("Skipped alcohol entry update: entry failed normalization", { id: entry.id });
    return false;
  }

  const { data, error } = await supabase
    .from("signal_entries")
    .update(alcoholEntryPayload(normalizedEntry, syncCode))
    .eq("sync_code", syncCode)
    .eq("signal_type", "alcohol")
    .eq("id", normalizedEntry.id)
    .select("id")
    .maybeSingle();

  if (error) {
    console.warn("Failed to update alcohol entry in Supabase:", {
      operation: "update",
      id: normalizedEntry.id,
      error,
    });
    return false;
  }

  if (!data) {
    console.warn("Skipped alcohol entry update: no matching row was updated", { id: normalizedEntry.id });
    return false;
  }

  return true;
}

export async function deleteAlcoholEntry(id: string, syncCode: string) {
  if (!supabase) {
    console.warn("Skipped alcohol entry delete: Supabase env vars are missing");
    return false;
  }

  if (!isValidAlcoholEntryUuid(id)) {
    console.warn("Skipped alcohol entry delete: id is not a Supabase-compatible UUID", { id });
    return false;
  }

  const { data, error } = await supabase
    .from("signal_entries")
    .delete()
    .eq("sync_code", syncCode)
    .eq("signal_type", "alcohol")
    .eq("id", id)
    .select("id")
    .maybeSingle();

  if (error) {
    console.warn("Failed to delete alcohol entry from Supabase:", {
      operation: "delete",
      id,
      error,
    });
    return false;
  }

  if (!data) {
    console.warn("Skipped alcohol entry delete: no matching row was deleted", { id });
    return false;
  }

  return true;
}
